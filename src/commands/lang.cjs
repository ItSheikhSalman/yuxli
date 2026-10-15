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
      roman: "ur",
      romanurdu: "ur",
      "رومن": "ur",
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
        auto: tr("Auto (follows each message)", "تلقائي (حسب لغة رسالتك)", "Auto (har message ki zuban ke mutabiq)"),
        ur: "Roman Urdu (رومن اردو) [Default]",
        ar: tr("Arabic", "العربية الفصحى", "Arabic (العربية)"),
        en: tr("English", "الإنجليزية", "English"),
      };
      const text = tr(
        `🌐 *Bot Language*

⚙️ *Current Language:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — Roman Urdu (رومن اردو) [Default - always Roman Urdu]
• \`${prefix}lang en\` — English always
• \`${prefix}lang ar\` — Modern Standard Arabic always
• \`${prefix}lang auto\` — follow the language of each message

Commands, !help, TTS and the AI assistant all reply in it.

🔢 *To convert digits* use \`${prefix}digit\` — e.g. \`${prefix}digit 12345\``,
        `🌐 *لغة البوت*

⚙️ *اللغة الحالية:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — الرومانية الأردية (Roman Urdu) دائمًا
• \`${prefix}lang ar\` — العربية الفصحى دائماً
• \`${prefix}lang en\` — English always
• \`${prefix}lang auto\` — تلقائي حسب لغة الرسالة

ستستخدمها جميع الأوامر و!help والصوت والذكاء الاصطناعي في الردود.

🔢 *لتحويل الأرقام* استخدم \`${prefix}digit\` — مثال: \`${prefix}digit 12345\``,
        `🌐 *Bot Ki Zuban (Language)*

⚙️ *Mojuda Zuban:* \`${labels[currentLang] || currentLang}\`
• \`${prefix}lang ur\` — Roman Urdu (Default - hamesha Roman Urdu me jawab de)
• \`${prefix}lang en\` — Hamesha English me jawab de
• \`${prefix}lang ar\` — Hamesha Arabic me jawab de
• \`${prefix}lang auto\` — Har message ki apni zuban ke mutabiq

Commands, !help, TTS aur AI assistant sab isi zuban me reply karein gy.

🔢 *Digits convert karne ke liye:* \`${prefix}digit 12345\``
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
              `🔢 Digits badalne ke liye \`${prefix}digit\` use karein:\n• \`${prefix}digit ${firstArg} ${args.slice(1).join(" ")}\`\n• ya \`${prefix}digit ${args.slice(1).join(" ")}\``,
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
              `⚠️ Maazrat, bot ki language sirf bot owner aur admins change kar sakte hain.\n_Digits badalne ke liye \`${prefix}digit\` use karein._`,
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
            text: "✅ Bot ki default zuban *Roman Urdu* pe set kar di gayi hy. Saari commands, AI, aur text-to-speech ab Roman Urdu me reply karein gy.\n✅ Bot language set to *Roman Urdu* (رومن اردو).",
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
