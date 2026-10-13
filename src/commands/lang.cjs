// file: src/commands/lang.cjs
const logger = require("../utils/logger.cjs");
const settings = require("../config/settings.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const { isOwnerJidSync, isBotAdminUserSync } = require("../utils/permissions.cjs");
const { tr } = require("../utils/i18n.cjs");

module.exports = {
  name: "lang",
  aliases: ["language", "لغة"],
  description: {
    en: "Shows or changes the bot's language.",
    ar: "يعرض لغة البوت أو يغيّرها.",
  },
  usage: {
    en: "lang [ur|en|ar|auto]",
    ar: "lang [ur|en|ar|auto]",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const prefix = runtimeConfig.getPrefix();
    const currentLang = settings.get("bot_language") || "auto";

    const rawFirst = args?.[0] ? String(args[0]).toLowerCase().trim() : "";
    const LANG_MAP = {
      ur: "ur",
      urdu: "ur",
      "اردو": "ur",
      ar: "ar",
      arabic: "ar",
      en: "en",
      english: "en",
      auto: "auto",
    };
    const firstArg = LANG_MAP[rawFirst] || "";

    if (!args || args.length === 0) {
      const labels = {
        auto: tr("Auto (follows each message)", "تلقائي (حسب لغة رسالتك)", "آٹو (ہر میسج کی زبان کے مطابق)"),
        ur: "اردو (Urdu)",
        ar: tr("Arabic", "العربية الفصحى"),
        en: tr("English", "الإنجليزية"),
      };
      const text = tr(
        `🌐 *Bot language*

⚙️ *Current:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — Urdu (اردو) always
• \`${prefix}lang en\` — English always
• \`${prefix}lang ar\` — Modern Standard Arabic always
• \`${prefix}lang auto\` — follow the language of each message

Commands, !help, TTS and the AI all answer in it.

🔢 *To convert digits* use \`${prefix}digit\` — e.g. \`${prefix}digit 12345\``,
        `🌐 *لغة البوت*

⚙️ *اللغة الحالية:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — الأردية (اردو) دائمًا
• \`${prefix}lang ar\` — العربية الفصحى دائماً
• \`${prefix}lang en\` — English always
• \`${prefix}lang auto\` — تلقائي حسب لغة الرسالة

ستستخدمها جميع الأوامر و!help والصوت والذكاء الاصطناعي في الردود.

🔢 *لتحويل الأرقام* استخدم \`${prefix}digit\` — مثال: \`${prefix}digit 12345\``,
        `🌐 *بوٹ کی زبان*

⚙️ *موجودہ زبان:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — ہمیشہ اردو میں جواب دے
• \`${prefix}lang en\` — ہمیشہ انگلش میں جواب دے
• \`${prefix}lang ar\` — ہمیشہ عربی میں جواب دے
• \`${prefix}lang auto\` — ہر میسج کی اپنی زبان کے مطابق

تمام کمانڈز، !help، ٹیکسٹ ٹو وائس (TTS) اور AI اسی زبان میں جواب دیں گے۔

🔢 *ہندسے تبدیل کرنے کے لیے:* \`${prefix}digit 12345\``
      );
      await sock.sendMessage(chatId, { text }, { quoted: msg });
      return;
    }

    if (firstArg) {
      if (args.length > 1) {
        await sock.sendMessage(
          chatId,
          {
            text: tr(
              `🔢 To convert digits, use \`${prefix}digit\`:\n• \`${prefix}digit ${firstArg} ${args.slice(1).join(" ")}\`\n• or \`${prefix}digit ${args.slice(1).join(" ")}\` to detect the direction.`,
              `🔢 لتحويل الأرقام استخدم \`${prefix}digit\`:\n• \`${prefix}digit ${firstArg} ${args.slice(1).join(" ")}\`\n• أو \`${prefix}digit ${args.slice(1).join(" ")}\` للتحويل التلقائي.`,
            ),
          },
          { quoted: msg },
        );
        return;
      }

      const isOwner = isOwnerJidSync(sender);
      const isAdmin = isBotAdminUserSync(sender);
      if (!isOwner && !isAdmin) {
        await sock.sendMessage(
          chatId,
          {
            text: tr(
              `⚠️ Sorry, only the bot owner and admins can change the bot's language.\n_To convert digits, use \`${prefix}digit\`._`,
              `⚠️ عذراً، تغيير لغة البوت متاح لمالك البوت والمسؤولين فقط.\n_لتحويل الأرقام استخدم \`${prefix}digit\`._`,
            ),
          },
          { quoted: msg },
        );
        return;
      }

      settings.set("bot_language", firstArg);
      logger.info(`[Language] Bot response language set to: ${firstArg}`);

      if (firstArg === "ur") {
        await sock.sendMessage(
          chatId,
          {
            text: "✅ بوٹ کی زبان *اردو* پر سیٹ کر دی گئی ہے۔ تمام کمانڈز، AI اور ٹیکسٹ ٹو وائس اب اردو میں جواب دیں گے۔\n✅ Bot language set to *Urdu* (اردو).",
          },
          { quoted: msg },
        );
      } else if (firstArg === "ar") {
        await sock.sendMessage(
          chatId,
          {
            text: "✅ تم ضبط لغة البوت على *العربية الفصحى*. ستكون ردود الأوامر والذكاء الاصطناعي بالعربية دائمًا.",
          },
          { quoted: msg },
        );
      } else if (firstArg === "en") {
        await sock.sendMessage(
          chatId,
          {
            text: "✅ Bot language set to *English*. Commands and the AI assistant will now always answer in English.",
          },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          chatId,
          {
            text: tr(
              "✅ Language set to *Auto*. The bot will answer each message in the language it is written in.",
              "✅ تم ضبط اللغة على *التلقائي (Auto)*. سيرد البوت بحسب لغة كل رسالة ترسلها له تلقائياً.",
              "✅ زبان *آٹو (Auto)* پر سیٹ کر دی گئی۔ بوٹ ہر میسج کی زبان کے مطابق جواب دے گا۔"
            ),
          },
          { quoted: msg },
        );
      }
      return;
    }

    await sock.sendMessage(
      chatId,
      {
        text: tr(
          `❌ Unknown option.\nUse:\n• \`${prefix}lang ur\` / \`${prefix}lang en\` / \`${prefix}lang ar\` / \`${prefix}lang auto\` for the bot's language\n• \`${prefix}digit 12345\` to convert digits`,
          `❌ خيار غير صحيح.\nاستخدم:\n• \`${prefix}lang ur\` / \`${prefix}lang ar\` / \`${prefix}lang en\` / \`${prefix}lang auto\` للغة البوت\n• \`${prefix}digit 12345\` لتحويل الأرقام`,
          `❌ غلط آپشن۔\nاستعمال کریں:\n• \`${prefix}lang ur\` / \`${prefix}lang en\` / \`${prefix}lang ar\` / \`${prefix}lang auto\`\n• ہندسوں کے لیے: \`${prefix}digit 12345\``
        ),
      },
      { quoted: msg },
    );
  },
};
