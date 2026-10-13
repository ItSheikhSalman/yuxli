// Document & PDF Reader & Processing Utility
// Supports PDF, TXT, MD, CSV, Code files
// Completely FREE, zero npm dependencies!

const zlib = require("node:zlib");
const logger = require("./logger.cjs");
const settings = require("../config/settings.cjs");
const { GoogleGenAI } = require("@google/genai");
const { assertProviderBaseUrl } = require("./providerUrl.cjs");
const { baseMimeType, INLINE_MEDIA_LIMIT } = require("./geminiMedia.cjs");

/**
 * Extracts raw readable text from a PDF Buffer without external packages.
 * Parses PDF streams (FlateDecode decompressed via zlib) and extracts text tokens.
 */
function extractRawPdfText(pdfBuffer) {
  try {
    const raw = pdfBuffer.toString("binary");
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    const extractedChunks = [];

    while ((match = streamRegex.exec(raw)) !== null) {
      const streamData = Buffer.from(match[1], "binary");
      let decompressed = null;

      try {
        decompressed = zlib.inflateSync(streamData).toString("utf-8");
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamData).toString("utf-8");
        } catch {
          // Uncompressed stream
          decompressed = streamData.toString("utf-8");
        }
      }

      if (decompressed) {
        // Extract text from (text) Tj and [(text)] TJ
        const tjRegex = /\((.*?)\)\s*Tj/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
          extractedChunks.push(tjMatch[1]);
        }

        const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
        let arrayMatch;
        while ((arrayMatch = arrayTjRegex.exec(decompressed)) !== null) {
          const parts = arrayMatch[1].match(/\((.*?)\)/g);
          if (parts) {
            extractedChunks.push(parts.map((p) => p.slice(1, -1)).join(""));
          }
        }
      }
    }

    const fullText = extractedChunks.join(" ").replace(/\\([()\\])/g, "$1").trim();
    return fullText;
  } catch (err) {
    logger.warn({ err }, "[docReader] Local PDF text extraction encountered an error");
    return "";
  }
}

/**
 * Extracts plain text from any buffer (text, code, markdown, csv, or pdf).
 */
function extractTextFromBuffer(buffer, mimeType = "", fileName = "") {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  const isText =
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("csv") ||
    /\.(txt|md|csv|json|py|js|ts|html|css|java|c|cpp|sql|xml|log)$/i.test(name);

  if (isText) {
    return buffer.toString("utf-8");
  }

  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  if (isPdf) {
    return extractRawPdfText(buffer);
  }

  // Fallback try utf-8
  return buffer.toString("utf-8");
}

let geminiClientCache = { key: null, baseUrl: null, client: null };

function getGeminiClient() {
  const key = settings.get("gemini_api_key");
  if (!key) return null;
  const baseUrl = assertProviderBaseUrl(settings.get("gemini_base_url"), { allowLoopback: true });
  if (geminiClientCache.key !== key || geminiClientCache.baseUrl !== baseUrl) {
    geminiClientCache = {
      key,
      baseUrl,
      client: new GoogleGenAI({ apiKey: key, httpOptions: { baseUrl } }),
    };
  }
  return geminiClientCache.client;
}

/**
 * Analyzes document content with AI or local extraction.
 *
 * @param {Object} options
 * @param {Buffer} options.buffer Document file buffer
 * @param {string} options.mimeType MIME type
 * @param {string} options.fileName Original filename
 * @param {"explain" | "summary" | "topics" | "quiz"} options.mode Processing mode
 * @param {string} [options.customPrompt] Optional extra instructions from user
 */
async function processDocument({ buffer, mimeType = "application/pdf", fileName = "document.pdf", mode = "explain", customPrompt = "" }) {
  const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const genAI = getGeminiClient();
  const modelName = settings.get("gemini_model") || "gemini-2.0-flash";

  // System instruction based on mode
  let systemPrompt = "";
  if (mode === "explain") {
    systemPrompt =
      "You are an expert tutor. Carefully read the attached document and provide a clear, comprehensive, easy-to-understand explanation. Break down complex ideas into simple concepts with examples. Reply in clear Urdu / Roman Urdu (or bilingual English if technical terms are used). Use bullet points and bold headings.";
  } else if (mode === "summary" || mode === "short") {
    systemPrompt =
      "You are an expert academic summarizer. Provide a concise, high-yield summary of the attached document. Highlight only the core takeaways, crucial points, and executive summary. Keep it short and to the point in bullet format in Urdu / Roman Urdu (or bilingual English).";
  } else if (mode === "topics") {
    systemPrompt =
      "You are an academic syllabus analyzer. Extract all main topics, subtopics, core formulas, key definitions, and important exam questions found in this document. Structure it systematically with clear numbering and bullet points.";
  } else if (mode === "quiz") {
    systemPrompt =
      "You are a quiz master. Create 5 multiple-choice questions (MCQs) and 2 short conceptual questions based on this document, with correct answers and brief explanations at the end. Make it great for student practice.";
  }

  if (customPrompt) {
    systemPrompt += `\n\nUser specific instruction: ${customPrompt}`;
  }

  // If Gemini is available, use Gemini's native multimodal file ingestion!
  if (genAI) {
    try {
      const parts = [];

      if (isPdf) {
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        });
      } else {
        // Plain text / code / csv
        const textContent = buffer.toString("utf-8");
        parts.push({
          text: `[Document Content: ${fileName}]\n\n${textContent.slice(0, 50000)}`,
        });
      }

      parts.push({ text: systemPrompt });

      const response = await genAI.models.generateContent({
        model: modelName,
        contents: parts,
      });

      const resultText = response?.text || "";
      if (resultText.trim()) {
        return {
          success: true,
          text: resultText.trim(),
          source: "gemini",
          fileName,
        };
      }
    } catch (aiErr) {
      logger.warn({ err: aiErr }, "[docReader] Gemini document processing failed, trying text fallback");
    }
  }

  // Fallback: Local Text Extraction
  const extracted = extractTextFromBuffer(buffer, mimeType, fileName);
  if (!extracted || extracted.trim().length === 0) {
    return {
      success: false,
      text: "⚠️ Is document sy text extract nahi ho saka. Agar scanned image PDF hai to panel me Gemini API key set karein taakay direct OCR read ho saky.",
      source: "local_failed",
      fileName,
    };
  }

  // Local basic summary if AI is not available
  const snippet = extracted.slice(0, 1500).trim();
  const wordCount = extracted.split(/\s+/).length;

  return {
    success: true,
    text: `📄 *Document: ${fileName}*\n📊 *Words:* ~${wordCount}\n\n*Preview/Extracted Text:*\n${snippet}...\n\n💡 _Tip: Gemini API key set karne par AI full explanation aur topics automatically generate karega._`,
    source: "local",
    fileName,
  };
}

module.exports = {
  extractTextFromBuffer,
  processDocument,
};
