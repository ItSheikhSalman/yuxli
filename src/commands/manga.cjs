// file: src/commands/manga.cjs
//
// MangaSter: Manga Discovery Command
// Powered by AHM7 MangaSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "manga",
  aliases: ["manhwa", "manhua"],
  description: {
    en: "Searches manga and manhwa catalogs for ratings, synopses, chapter counts, and genres.",
    ur: "مانگا اور مانہوا کی تفصیلات، ابواب اور ریٹنگ تلاش کریں.",
    ar: "البحث في كتالوج المانجا والمانهوا لمعرفة التقييم وعدد الفصول والقصة.",
  },
  usage: {
    en: "!manga <title>",
    ur: "!manga <نام>",
    ar: "!manga <اسم المانجا>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "manga");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("manga")) {
      return await sock.sendMessage(chatId, { text: "⚠️ MangaSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "📖 *Manga & Manhwa Finder*\n\n" +
              "Search popular manga, manhwa, and webtoons.\n\n" +
              "Usage: `!manga <title>`\n" +
              "Examples:\n" +
              "• `!manga Solo Leveling`\n" +
              "• `!manga One Piece`\n" +
              "• `!manga Jujutsu Kaisen`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("manga", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(data) ? data : (data.results || data.manga || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, { text: `📖 No manga found for "${query}".` }, { quoted: msg });
      }

      const item = list[0];
      const title = item.title || item.name || query;
      const score = item.score || item.rating || "N/A";
      const status = item.status || "Unknown";
      const chapters = item.chapters || item.chapterCount || "Ongoing";
      const genres = Array.isArray(item.genres) ? item.genres.join(", ") : (item.genre || "N/A");
      const synopsis = (item.synopsis || item.description || "No description provided.").slice(0, 450);

      let reply = `📖 *${title}*\n` +
                  `⭐ *Rating:* ${score} / 10\n` +
                  `📊 *Status:* ${status}\n` +
                  `📚 *Chapters:* ${chapters}\n` +
                  `🏷️ *Genres:* ${genres}\n\n` +
                  `📝 *Synopsis:*\n${synopsis}...\n`;

      if (item.url || item.link) {
        reply += `\n🔗 *Link:* ${item.url || item.link}`;
      }

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[MangaSter] Search failed");
      await sock.sendMessage(chatId, { text: `❌ Manga search error: ${err.message}` }, { quoted: msg });
    }
  },
};
