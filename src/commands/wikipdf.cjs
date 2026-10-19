// file: src/commands/wikipdf.cjs
//
// Wikster: Wikipedia to Academic PDF Generator Command
// Powered by AHM7 Wikster

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "wikipdf",
  aliases: ["wikipaper", "wikidoc", "wikibook"],
  description: {
    en: "Compiles and downloads any Wikipedia article into a beautifully formatted, paginated academic PDF document.",
    ur: "ویکیپیڈیا کے کسی بھی موضوع کا مکمل تحقیقی پی ڈی ایف (PDF) دستاویز ڈاؤن لوڈ کریں.",
    ar: "توليد ملف PDF أكاديمي منسق لأي مقال في ويكيبيديا.",
  },
  usage: {
    en: "!wikipdf <article title or topic>",
    ur: "!wikipdf <موضوع یا عنوان>",
    ar: "!wikipdf <عنوان المقال>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "wikipdf");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("wikipdf")) {
      return await sock.sendMessage(chatId, { text: "⚠️ Wikster service is currently disabled by administrator." }, { quoted: msg });
    }

    const title = args.join(" ").trim();
    if (!title) {
      return await sock.sendMessage(chatId, {
        text: "📚 *Wikster Academic PDF Generator*\n\n" +
              "Generate complete, print-ready PDF research documents from Wikipedia.\n\n" +
              "Usage: `!wikipdf <topic>`\n" +
              "Examples:\n" +
              "• `!wikipdf Quantum computing`\n" +
              "• `!wikipdf Albert Einstein`\n" +
              "• `!wikipdf Pakistan movement`",
      }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, `📚 Compiling academic PDF for "${title}"... Please wait...`, { replyTo: msg });

    try {
      const res = await requestAhm7("wikipdf", {
        params: { title },
        responseType: "arraybuffer",
        expectedFormat: "pdf",
        category: "document",
        timeout: 40_000,
      });

      if (status?.remove) await status.remove();

      const safeFilename = `${title.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 50).trim() || "Wikipedia"}.pdf`;

      await sock.sendMessage(chatId, {
        document: res.buffer,
        mimetype: "application/pdf",
        fileName: safeFilename,
        caption: `📖 *Wikipedia Document:* "${title}"\n📄 Formatted and compiled by YUXLI Wikster Engine`,
      }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, title }, "[Wikster] Failed to generate Wikipedia PDF");
      const errText = `❌ Could not generate Wikipedia PDF: ${err.message || "Article not found or upstream timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
