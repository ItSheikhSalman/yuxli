// file: src/commands/unovel.cjs
//
// UNovelSter: Urdu Novels & Classic Literature Command
// Powered by AHM7 UNovelSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "unovel",
  aliases: ["urdunovel", "adab"],
  description: {
    en: "Searches Urdu literature, romantic/social novels, and classic digests.",
    ur: "اردو ناولز، ادبی کتب اور ڈائجسٹ کی تفصیلات تلاش کریں.",
    ar: "البحث في الروايات والقصص الأدبية الأردية الكلاسيكية.",
  },
  usage: {
    en: "!unovel <novel or author name>",
    ur: "!unovel <ناول یا مصنف کا نام>",
    ar: "!unovel <اسم الرواية>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "unovel");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("unovel")) {
      return await sock.sendMessage(chatId, { text: "⚠️ UNovelSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "📖 *اردو ناول تلاش کریں (UNovelSter)*\n\n" +
              "مشہور اردو ناولز اور ادیبوں کی کتب تلاش کریں.\n\n" +
              "استعمال: `!unovel <ناول کا نام>`\n" +
              "مثال: `!unovel پیر کامل` یا `!unovel نمرہ احمد`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("unovel", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(data) ? data : (data.novels || data.results || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, { text: `📖 معذرت، "${query}" کے نام سے کوئی اردو ناول نہیں ملا.` }, { quoted: msg });
      }

      let reply = `📚 *اردو ناولز برائے "${query}":*\n\n`;
      list.slice(0, 5).forEach((n, idx) => {
        const title = n.title || n.name || "بے نام ناول";
        const author = n.author || n.writer || "معلوم نہیں";
        const link = n.url || n.link || n.download || "";
        reply += `*${idx + 1}. ${title}*\n` +
                 `✍️ *مصنف:* ${author}\n` +
                 (link ? `🔗 *ڈاؤن لوڈ یا مطالعہ:* ${link}\n` : "") +
                 `\n`;
      });

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[UNovelSter] Search failed");
      await sock.sendMessage(chatId, { text: `❌ اردو ناول سرچ میں خرابی: ${err.message}` }, { quoted: msg });
    }
  },
};
