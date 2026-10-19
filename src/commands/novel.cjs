// file: src/commands/novel.cjs
//
// NovelSter: Web Novels & Fiction Discovery Command
// Powered by AHM7 NovelSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "novel",
  aliases: ["lightnovel", "webnovel"],
  description: {
    en: "Searches English web novels, light novels, and serialized fiction.",
    ur: "انگلش ویب ناولز، لائٹ ناولز اور فکشن کی تفصیلات تلاش کریں.",
    ar: "البحث في الروايات الخفيفة والروايات الرقمية والقصص المسلسلة.",
  },
  usage: {
    en: "!novel <title>",
    ur: "!novel <نام>",
    ar: "!novel <عنوان الرواية>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "novel");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("novel")) {
      return await sock.sendMessage(chatId, { text: "⚠️ NovelSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "📚 *NovelSter Web Novel Finder*\n\n" +
              "Search fantasy, progression, and light novels.\n\n" +
              "Usage: `!novel <title>`\n" +
              "Examples:\n" +
              "• `!novel Shadow Slave`\n" +
              "• `!novel Lord of the Mysteries`\n" +
              "• `!novel Omniscient Reader`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("novel", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(data) ? data : (data.novels || data.results || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, { text: `📚 No web novels found for "${query}".` }, { quoted: msg });
      }

      const item = list[0];
      const title = item.title || item.name || query;
      const author = item.author || "Unknown";
      const rating = item.rating || item.score || "N/A";
      const chapters = item.chapters || "N/A";
      const desc = (item.description || item.synopsis || "No description provided.").slice(0, 450);

      let reply = `📚 *${title}*\n` +
                  `✍️ *Author:* ${author}\n` +
                  `⭐ *Rating:* ${rating}\n` +
                  `📖 *Chapters:* ${chapters}\n\n` +
                  `📝 *Summary:*\n${desc}...\n`;

      if (item.url || item.link) {
        reply += `\n🔗 *Read:* ${item.url || item.link}`;
      }

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[NovelSter] Search failed");
      await sock.sendMessage(chatId, { text: `❌ Novel search error: ${err.message}` }, { quoted: msg });
    }
  },
};
