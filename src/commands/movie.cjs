// file: src/commands/movie.cjs
//
// CineSearch: Movies & TV Shows Discovery Command
// Powered by AHM7 CineSearch

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "movie",
  aliases: ["cine", "film", "series", "imdb"],
  description: {
    en: "Searches movie and TV series databases for ratings, storylines, release years, cast, and streaming details.",
    ur: "فلموں اور ڈراموں کی ریٹنگ، کہانی اور تفصیلات تلاش کریں.",
    ar: "البحث عن الأفلام والمسلسلات لمعرفة التقييمات والقصة وطاقم العمل.",
  },
  usage: {
    en: "!movie <title>",
    ur: "!movie <فلم کا نام>",
    ar: "!movie <اسم الفيلم>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "movie");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("movie")) {
      return await sock.sendMessage(chatId, { text: "⚠️ CineSearch service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "🎬 *CineSearch Cinema Database*\n\n" +
              "Search movies, series, and anime with ratings and summaries.\n\n" +
              "Usage: `!movie <title>`\n" +
              "Example: `!movie Inception`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("movie", {
        params: { q: query },
        timeout: 20_000,
      });

      const items = Array.isArray(data) ? data : (data.results || data.movies || [data]);
      if (items.length === 0 || !items[0] || (!items[0].title && !items[0].name)) {
        return await sock.sendMessage(chatId, { text: `🎬 No cinema results found for "${query}".` }, { quoted: msg });
      }

      const m = items[0];
      const title = m.title || m.name || query;
      const year = m.year || m.release_date || "N/A";
      const rating = m.rating || m.imdbRating || m.vote_average || "N/A";
      const genres = Array.isArray(m.genres) ? m.genres.join(", ") : (m.genre || "N/A");
      const plot = m.plot || m.overview || m.description || "No synopsis available.";
      const cast = Array.isArray(m.cast) ? m.cast.slice(0, 5).join(", ") : (m.actors || "N/A");

      let reply = `🎬 *${title}* (${year})\n` +
                  `⭐ *Rating:* ${rating} / 10\n` +
                  `🎭 *Genre:* ${genres}\n` +
                  `👥 *Cast:* ${cast}\n\n` +
                  `📖 *Synopsis:*\n${plot.slice(0, 450)}...\n`;

      if (m.link || m.url || m.trailer) {
        reply += `\n🔗 *More Info:* ${m.link || m.url || m.trailer}`;
      }

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[CineSearch] Search error");
      await sock.sendMessage(chatId, { text: `❌ CineSearch error: ${err.message}` }, { quoted: msg });
    }
  },
};
