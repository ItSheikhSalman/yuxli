// Mode & Mood selection command for the AI assistant
// Allows users to switch between roasting, happy, serious, empathetic, dramatic, or auto mode.

const { MODES, getChatMode, setChatMode, normalizeMode } = require("../services/aiMood.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const { tr } = require("../utils/i18n.cjs");

module.exports = {
  name: "mode",
  aliases: ["mood", "aimode", "مزاج", "مود"],
  description: {
    en: "Changes or views the AI's reply mode: roasting, happy, serious, empathetic, dramatic, or auto.",
    ur: "AI کے جواب دینے کا مزاج بدلیں یا دیکھیں: روسٹنگ، خوش مزاج، سنجیدہ، ہمدرد، ڈرامائی، یا آٹو۔",
    ar: "تغيير أو عرض وضع ردود الذكاء الاصطناعي: القصف، السعادة، الجدية، التعاطف، الدراما، أو التلقائي.",
  },
  usage: {
    en: "mode\nmode roast\nmode happy\nmode serious\nmode empathetic\nmode dramatic\nmode auto",
    ur: "mode\nmode roast (روسٹنگ موڈ)\nmode happy (خوش موڈ)\nmode serious (سنجیدہ موڈ)\nmode empathetic (ہمدرد موڈ)\nmode dramatic (ڈرامائی موڈ)\nmode auto (خودکار موڈ)",
    ar: "mode\nmode roast\nmode happy\nmode serious\nmode empathetic\nmode dramatic\nmode auto",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const prefix = runtimeConfig.getPrefix();
    const action = (args[0] || "").toLowerCase().trim();

    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    const currentMode = getChatMode(chatId);
    const currentMeta = MODES[currentMode] || MODES.auto;

    // If no argument or "list", show current mode and available options
    if (!action || action === "list" || action === "help") {
      const modeList = Object.values(MODES)
        .map((m) => {
          const isCurrent = m.id === currentMode ? " *(Active ✓)*" : "";
          const desc = tr(m.description.en, m.description.ar, m.description.ur);
          return `• \`${prefix}mode ${m.id}\` — ${m.emoji} *${m.label}*${isCurrent}\n   _${desc}_`;
        })
        .join("\n\n");

      const text = tr(
        `🎭 *AI Mood & Personality Mode*

Current Mode: ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)

*Available Modes:*
${modeList}

💡 *Tip:* In *Auto* mode, the AI naturally roasts, cheers, or consoles you based on your emojis and words!
Try: \`${prefix}mode roast\` or \`${prefix}mode happy\``,
        `🎭 *أوضاع ومزاج الذكاء الاصطناعي*

الوضع الحالي: ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)

*الأوضاع المتاحة:*
${modeList}

💡 *تلميح:* في الوضع التلقائي *Auto*، يتكيف الذكاء الاصطناعي تلقائيًا مع مشاعرك وتعبيراتك!
جرب: \`${prefix}mode roast\` أو \`${prefix}mode happy\``,
        `🎭 *AI موڈ اور مزاج کنٹرول*

موجودہ موڈ: ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)

*دستیاب موڈز:*
${modeList}

💡 *مشورہ:* آٹو (*Auto*) موڈ میں AI آپ کے الفاظ، تاثرات اور ایموجیز کے مطابق خودکار طور پر روسٹ یا خوشی کا انداز اپنا لیتا ہے!
آزما کر دیکھیں: \`${prefix}mode roast\` یا \`${prefix}mode happy\``
      );

      return reply(text);
    }

    const resolvedMode = normalizeMode(action);
    if (!resolvedMode) {
      return reply(
        tr(
          `❌ Unknown mode "${action}".\nAvailable: \`auto\`, \`roast\`, \`happy\`, \`serious\`, \`empathetic\`, \`dramatic\`.\nUse \`${prefix}mode\` to view details.`,
          `❌ وضع غير معروف "${action}".\nالأوضاع المتاحة: \`auto\`، \`roast\`، \`happy\`، \`serious\`، \`empathetic\`، \`dramatic\`.\nاستخدم \`${prefix}mode\` للتفاصيل.`,
          `❌ نامعلوم موڈ "${action}"۔\nدستیاب موڈز: \`auto\`, \`roast\`, \`happy\`, \`serious\`, \`empathetic\`, \`dramatic\`۔\nتفصیل کے لیے \`${prefix}mode\` لکھیں۔`
        )
      );
    }

    setChatMode(chatId, resolvedMode);
    const newMeta = MODES[resolvedMode];

    return reply(
      tr(
        `✅ Mode updated to ${newMeta.emoji} *${newMeta.label}*!\n\n${tr(newMeta.description.en, newMeta.description.ar, newMeta.description.ur)}`,
        `✅ تم تغيير الوضع إلى ${newMeta.emoji} *${newMeta.label}* بنجاح!\n\n${tr(newMeta.description.en, newMeta.description.ar, newMeta.description.ur)}`,
        `✅ AI موڈ کامیابی سے ${newMeta.emoji} *${newMeta.label}* میں تبدیل کر دیا گیا!\n\n${tr(newMeta.description.en, newMeta.description.ar, newMeta.description.ur)}`
      )
    );
  },
};
