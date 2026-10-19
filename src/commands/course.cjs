// file: src/commands/course.cjs
//
// AHM7 Courses: Free Educational Courses Discovery Command
// Powered by AHM7 Courses

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "course",
  aliases: ["courses", "freecourses", "study"],
  description: {
    en: "Finds free computer science, programming, AI, and design courses from top educational providers.",
    ur: "مفت پروگرامنگ، کمپیوٹر سائنس اور آن لائن کورسز تلاش کریں.",
    ar: "البحث عن دورات تدريبية مجانية في البرمجة والذكاء الاصطناعي والتصميم.",
  },
  usage: {
    en: "!course <topic or skill>",
    ur: "!course <موضوع یا مہارت>",
    ar: "!course <الموضوع>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;

    if (!isServiceEnabled("courses")) {
      return await sock.sendMessage(chatId, { text: "⚠️ Courses service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "🎓 *Free Educational Courses Finder*\n\n" +
              "Discover free university and tech certifications.\n\n" +
              "Usage: `!course <topic>`\n" +
              "Examples:\n" +
              "• `!course Python`\n" +
              "• `!course Machine Learning`\n" +
              "• `!course Web Development`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("courses", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(data) ? data : (data.courses || data.results || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, { text: `🎓 No free courses found for "${query}". Try broader search terms like "Python", "React", or "Data Science".` }, { quoted: msg });
      }

      let reply = `🎓 *Free Courses for "${query}":*\n\n`;
      list.slice(0, 5).forEach((c, idx) => {
        const title = c.title || c.name || "Untitled Course";
        const platform = c.platform || c.provider || c.source || "Online";
        const link = c.url || c.link || c.enrollUrl || "";
        reply += `*${idx + 1}. ${title}*\n` +
                 `🏛️ *Provider:* ${platform}\n` +
                 (link ? `🔗 *Enroll:* ${link}\n` : "") +
                 `\n`;
      });

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[Courses] Search failed");
      await sock.sendMessage(chatId, { text: `❌ Course search error: ${err.message}` }, { quoted: msg });
    }
  },
};
