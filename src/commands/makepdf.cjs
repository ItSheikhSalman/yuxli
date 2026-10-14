// Command: !makepdf (Creates custom PDF notes from text or reply)
// 100% Free & Zero Dependency!

const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const { unwrapMessage, visibleText, quotedOf } = require("../utils/messageContent.cjs");
const { createDocumentPdf } = require("../utils/pdfGenerator.cjs");

module.exports = {
  name: "makepdf",
  aliases: ["topdf", "pdfmake", "createpdf"],
  description: {
    en: "Creates a formatted downloadable PDF file from any text or replied message.",
    ar: "إنشاء ملف PDF منسق وجاهز للتحميل من أي نص أو رد.",
  },
  usage: {
    en: "!makepdf <Title> | <Content>\n!makepdf ai <Topic> — Auto-generate study notes PDF\n!makepdf urdu <Topic> — Auto-generate Urdu notes PDF\nReply to any message with: !makepdf [Title]",
    ar: "!makepdf <العنوان> | <المحتوى>\n!makepdf ai <الموضوع>\n!makepdf urdu <الموضوع>",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);

    try {
      const quoted = quotedOf(msg);
      let content = "";
      let title = "Student Notes";
      let selectedTheme = "navy";

      const fullInput = args.join(" ").trim();

      // Detect theme flag
      const themeMatch = fullInput.match(/theme:([a-zA-Z]+)/i) || fullInput.match(/--(navy|emerald|violet|midnight|crimson|amber)/i);
      if (themeMatch) {
        selectedTheme = themeMatch[1].toLowerCase();
      }

      const firstArg = (args[0] || "").toLowerCase();

      // Feature: AI & Urdu Study Notes Auto-Generation
      if ((firstArg === "ai" || firstArg === "urdu") && !quoted) {
        const topic = args.slice(1).join(" ").replace(/theme:[a-zA-Z]+/i, "").replace(/--(navy|emerald|violet|midnight|crimson|amber)/i, "").trim();
        if (!topic) {
          return await sock.sendMessage(chatId, {
            text: `⚠️ *Topic batayein:* Jaise \`!makepdf ${firstArg} Quantum Computing\` ya \`!makepdf urdu نظریہ پاکستان\``,
          });
        }

        await sock.sendMessage(chatId, {
          text: `🤖 *AI Study Notes Tayyar Ho Rahy Hain...*\n📚 *Topic:* ${topic}\n🎨 *Theme:* ${selectedTheme}\n⏳ Please wait kuch seconds...`,
        });

        const { getProvider, hasProvider } = require("../services/aiRouter.cjs");
        const { runAgent } = require("../services/aiAgent.cjs");
        const settings = require("../config/settings.cjs");

        let providerName = settings.get("ai_provider") || "gemini";
        const activeProv = getProvider();
        if (!activeProv || !activeProv.isConfigured()) {
          if (hasProvider("flipia")) {
            providerName = "flipia";
          }
        }

        const isUrduAi = firstArg === "urdu";
        const prompt = isUrduAi
          ? `You are an expert academic professor. Write comprehensive, high-yield, beautifully formatted study notes completely in Urdu on the topic: "${topic}". Structure using markdown: start with # Title, ## Section Headings, * key bullet points, 1. steps, and > important exam tips. Write purely in Urdu.`
          : `You are an expert academic tutor. Write comprehensive, high-yield study notes on the topic: "${topic}". Use markdown: start with # Title, ## Section Headings, * bullet points, and > key takeaways/tips.`;

        try {
          const aiRes = await runAgent(
            sock,
            chatId,
            prompt,
            { isGroup: false, invokedName: "makepdf", provider: providerName },
            [],
            "",
            true,
          );
          content = (aiRes?.text || aiRes || "").trim();
          title = topic;
        } catch (e) {
          logger.error({ err: e }, "[makepdf] AI note generation failed");
          content = `Notes on ${topic}\n\n* Topic: ${topic}\n* Summary generated via Levix Suite`;
          title = topic;
        }
      } else if (quoted) {
        content = visibleText(quoted);
        title = args.join(" ").replace(/theme:[a-zA-Z]+/i, "").replace(/--(navy|emerald|violet|midnight|crimson|amber)/i, "").trim() || "Study Notes";
      } else {
        if (!fullInput) {
          return await sock.sendMessage(chatId, {
            text:
              "📄 *Make PDF Command (جدید نوٹس)*\n\n" +
              "Aap kisi bhi text ya topic ka PDF bana saktay hain:\n\n" +
              "1️⃣ *Direct:* `!makepdf Chapter 1 | # Overview\n* Point 1\n* Point 2`\n" +
              "2️⃣ *AI Notes:* `!makepdf ai Quantum Computing` (Auto-generated notes!)\n" +
              "3️⃣ *Urdu Notes:* `!makepdf urdu تحریک پاکستان` (مکمل اردو نوٹس!)\n" +
              "4️⃣ *Reply:* Kisi bhi message par reply karein: `!makepdf Physics Notes`\n\n" +
              "🎨 *Themes:* `theme:navy`, `theme:emerald`, `theme:violet`, `theme:midnight`, `theme:crimson`, `theme:amber`\n\n" +
              "✨ 100% Free, Urdu & English supported, beautiful A4 PDF download!",
          });
        }

        if (fullInput.includes("|")) {
          const parts = fullInput.split("|");
          title = parts[0].trim();
          content = parts.slice(1).join("|").trim();
        } else {
          content = fullInput;
        }
      }

      if (!content || !content.trim()) {
        return await sock.sendMessage(chatId, {
          text: "⚠️ PDF banane ke liye text likhein ya kisi message par reply karein.",
        });
      }

      await sock.sendMessage(chatId, {
        text: `⏳ *${title}* ka PDF generate ho raha hai...`,
      });

      // Check if replying to an image or message contains an image
      let attachedImage = null;
      try {
        const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
        const { downloadMedia } = require("../utils/geminiMedia.cjs");
        const ownInner = unwrapMessage(msg.message);
        const quotedInner = quoted ? unwrapMessage(quoted) : null;
        const imgMsg = ownInner?.imageMessage || quotedInner?.imageMessage;
        if (imgMsg) {
          attachedImage = await downloadMedia(downloadContentFromMessage, imgMsg, "image");
        }
      } catch (e) {
        logger.debug({ err: e }, "[makepdf] Image attachment extract skipped");
      }

      const pdfBuffer = await createDocumentPdf({
        title,
        subtitle: `Created for @${senderId.split("@")[0]}  •  ${new Date().toLocaleDateString()}`,
        content: content.trim(),
        footer: "Levix Smart Student Suite",
        imageBuffer: attachedImage,
        theme: selectedTheme,
      });

      const cleanFileName = `${title.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, "_") || "Notes"}.pdf`;

      await sock.sendMessage(
        chatId,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: cleanFileName,
          caption: `✅ *PDF Tayyar Hai!*\n📄 *File:* ${cleanFileName}\n🎨 *Theme:* ${selectedTheme}\n📊 *Size:* ${(pdfBuffer.length / 1024).toFixed(1)} KB`,
        },
        { quoted: msg },
      );
    } catch (err) {
      logger.error({ err, command: "makepdf" }, "Error in makepdf command");
      await sock.sendMessage(chatId, {
        text: `❌ Error generating PDF: ${err.message || "Unknown error"}`,
      });
    }
  },
};
