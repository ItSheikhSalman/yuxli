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
    en: "!makepdf <Title> | <Content>\nOr reply to any text message with: !makepdf [Title]",
    ar: "!makepdf <العنوان> | <المحتوى>",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);

    try {
      const quoted = quotedOf(msg);
      let content = "";
      let title = "Student Notes";

      if (quoted) {
        content = visibleText(quoted);
        title = args.join(" ") || "Study Notes";
      } else {
        const fullInput = args.join(" ");
        if (!fullInput) {
          return await sock.sendMessage(chatId, {
            text:
              "📄 *Make PDF Command*\n\n" +
              "Aap kisi bhi text ka PDF bana saktay hain:\n\n" +
              "1️⃣ *Direct:* `!makepdf Chapter 1 Notes | # Overview\n* Point 1\n* Point 2`\n" +
              "2️⃣ *Reply:* Kisi bhi lambi chat ya summary par reply karein: `!makepdf Physics Notes`\n\n" +
              "✨ Free, fast aur beautifully formatted A4 PDF download milay ga!",
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

      const pdfBuffer = createDocumentPdf({
        title,
        subtitle: `Created for @${senderId.split("@")[0]}  •  ${new Date().toLocaleDateString()}`,
        content: content.trim(),
        footer: "Yuxli Student Productivity Suite",
      });

      const cleanFileName = `${title.replace(/[^a-zA-Z0-9_-]/g, "_") || "Notes"}.pdf`;

      await sock.sendMessage(
        chatId,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: cleanFileName,
          caption: `✅ *PDF Tayyar Hai!*\n📄 *File:* ${cleanFileName}\n📊 *Size:* ${(pdfBuffer.length / 1024).toFixed(1)} KB`,
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
