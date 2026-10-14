// Command: !doc (PDF & Document Reader, Summarizer, Explainer & PDF Generator)
// 100% Free, runs smoothly on Render, Windows, Linux, Docker!

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const { unwrapMessage, quotedOf } = require("../utils/messageContent.cjs");
const { downloadMedia } = require("../utils/geminiMedia.cjs");
const { processDocument, extractTextFromBuffer } = require("../utils/docReader.cjs");
const { createDocumentPdf } = require("../utils/pdfGenerator.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const { tr } = require("../utils/i18n.cjs");

module.exports = {
  name: "doc",
  aliases: ["pdf", "readpdf", "summarizepdf", "docreader"],
  description: {
    en: "Reads PDFs and text documents: explain, summarize, extract key topics, or convert to notes PDF.",
    ar: "قراءة وتحليل ملفات الـ PDF والمستندات وتلخيصها وتحويلها إلى PDF.",
  },
  usage: {
    en: "!doc explain (reply to PDF/text file)\n!doc short\n!doc topics\n!doc quiz\n!doc topdf [title]",
    ar: "!doc explain\n!doc short\n!doc topics\n!doc topdf",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);

    try {
      // Find document in current message or quoted message
      const own = unwrapMessage(msg.message);
      const quoted = quotedOf(msg);
      const quotedInner = quoted ? unwrapMessage(quoted) : null;

      const docMessage = own.documentMessage || quotedInner?.documentMessage;

      if (!docMessage) {
        return await sock.sendMessage(chatId, {
          text:
            "📚 *PDF & Document Reader & Study Assistant*\n\n" +
            "Kisi bhi *PDF* ya *Text file* ko bhejo ya us par reply karke command do:\n\n" +
            "🔹 `!doc explain` — Poore document ki tafseeli wazahat (detailed explanation)\n" +
            "🔹 `!doc short` — Mukhtasar khulasa (concise summary & key points)\n" +
            "🔹 `!doc topics` — Main topics, syllabus points aur formulas nikalna\n" +
            "🔹 `!doc quiz` — Is document par practice quiz & MCQs banana\n" +
            "🔹 `!doc topdf [title]` — Notes ka naya PDF bana kar download bhejna\n\n" +
            "💡 _Tip: Free Gemini AI se Urdu / Roman Urdu me asaan jawab milta hai!_",
        });
      }

      const subCommand = args[0] ? args[0].toLowerCase() : "explain";
      const customPrompt = args.slice(1).join(" ");

      let mode = "explain";
      let wantPdfOutput = false;

      if (subCommand === "short" || subCommand === "summary" || subCommand === "khulasa") {
        mode = "summary";
      } else if (subCommand === "topics" || subCommand === "main" || subCommand === "points") {
        mode = "topics";
      } else if (subCommand === "quiz" || subCommand === "mcqs" || subCommand === "test") {
        mode = "quiz";
      } else if (subCommand === "topdf" || subCommand === "pdf" || subCommand === "makepdf") {
        wantPdfOutput = true;
        mode = "summary";
      }

      const status = await createStatus(
        sock,
        chatId,
        "📖 Document read aur analyze ho raha hai... Please wait...",
        { replyTo: msg },
      );

      // Download document buffer
      const buffer = await downloadMedia(downloadContentFromMessage, docMessage, "document");
      const fileName = docMessage.fileName || "document.pdf";
      const mimeType = docMessage.mimetype || "application/pdf";

      logger.info({ fileName, mimeType, size: buffer.length, mode }, "[Doc] Processing document");

      const result = await processDocument({
        buffer,
        mimeType,
        fileName,
        mode,
        customPrompt,
      });

      if (!result.success && !result.text) {
        if (status?.finish) await status.finish("❌ Document read karne me masla aaya. File format check karein.");
        else await sock.sendMessage(chatId, { text: "❌ Document read karne me masla aaya. File format check karein." });
        return;
      }

      const responseText = result.text;

      // If user requested a PDF file back
      if (wantPdfOutput || subCommand === "topdf" || subCommand === "makepdf") {
        if (status?.update) await status.update("📑 PDF generate ho raha hai...");

        const pdfTitle = args.slice(1).join(" ") || `Summary - ${fileName.replace(/\.[^/.]+$/, "")}`;
        const generatedPdf = await createDocumentPdf({
          title: pdfTitle,
          subtitle: `Generated for @${senderId.split("@")[0]} | ${new Date().toLocaleDateString()}`,
          content: responseText,
          footer: "Yuxli Smart Student Suite",
        });

        await sock.sendMessage(
          chatId,
          {
            document: generatedPdf,
            mimetype: "application/pdf",
            fileName: `${pdfTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
            caption: `✅ *Aapka PDF Tayyar Hai!*\n📄 *Title:* ${pdfTitle}\n\n*Highlights:*\n${responseText.slice(0, 400)}...`,
          },
          { quoted: msg },
        );

        if (status?.finish) await status.finish("✅ PDF bhej diya gaya hai!");
      } else {
        // Send formatted text response
        const titleBadge =
          mode === "explain"
            ? "📖 *DOCUMENT EXPLANATION & SUMMARY*"
            : mode === "topics"
              ? "🎯 *MAIN TOPICS & KEY POINTS*"
              : mode === "quiz"
                ? "📝 *PRACTICE QUIZ & QUESTIONS*"
                : "⚡ *CONCISE SUMMARY*";

        const replyMessage =
          `${titleBadge}\n` +
          `📁 *File:* ${fileName}\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `${responseText}\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `💡 _Is ka PDF download karne ke liye reply karein: ` +
          `\`!doc topdf ${fileName.replace(/\.[^/.]+$/, "")}\`_`;

        if (status?.finish) {
          await status.finish(replyMessage);
        } else {
          await sock.sendMessage(chatId, { text: replyMessage }, { quoted: msg });
        }
      }
    } catch (err) {
      logger.error({ err, command: "doc" }, "Error in doc command");
      await sock.sendMessage(chatId, {
        text: `❌ Error reading document: ${err.message || "Unknown error"}`,
      });
    }
  },
};
