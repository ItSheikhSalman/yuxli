// Chat AI Auto-Reply Mode Toggle Command
// - !autoreply mention: Auto-reply only when bot is mentioned/quoted
// - !autoreply all: Auto-reply to every message in this chat
// - !autoreply off: Do not auto-reply in this chat

const { getChatAutoReply, setChatAutoReply } = require("../services/aiAutoReply.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");

module.exports = {
  name: "autoreply",
  aliases: ["autorespond", "replymode", "mentiononly", "آٹو_ریپلائی"],
  description: {
    en: "Configure auto AI reply behavior: mention (only when tagged), all (every message), or off.",
    ur: "AI آٹو ریپلائی کنٹرول: mention (صرف مینشن پر)، all (ہر میسج پر خودکار جواب)، یا off۔",
    ar: "التحكم في الرد التلقائي للذكاء الاصطناعي: mention (عند الإشارة فقط)، all (لكل الرسائل)، أو off.",
  },
  usage: {
    en: "autoreply\nautoreply mention\nautoreply all\nautoreply off",
    ur: "autoreply (چیک کریں)\nautoreply mention (صرف مینشن پر جواب دے)\nautoreply all (ہر میسج پر خودکار جواب دے)\nautoreply off (آٹو ریپلائی بند)",
    ar: "autoreply\nautoreply mention\nautoreply all\nautoreply off",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });
    const prefix = runtimeConfig.getPrefix();
    const action = (args[0] || "").toLowerCase().trim();

    const current = getChatAutoReply(chatId);

    if (!action || action === "status") {
      let label = "Mention Only (@bot tag ya quote karne pe)";
      if (current === "all") label = "All Messages (Real human ki tarha har msg pe)";
      if (current === "off") label = "Disabled (Off)";

      return reply(
        `🤖 *AI Auto-Reply Setting (Is Chat Ke Liye):*

Current Mode: *${label}*

💡 *Available Modes:*
• \`${prefix}autoreply mention\` — Sirf tab reply kare jab @bot mention ya quote ho (groups ke liye best)
• \`${prefix}autoreply all\` — Har message ka khud-ba-khud insaan ki tarha reply kare!
• \`${prefix}autoreply off\` — Is chat me auto-reply band karein`
      );
    }

    if (action === "mention" || action === "tag") {
      setChatAutoReply(chatId, "mention");
      setChatAutoReply(rawChatId, "mention");
      return reply(`✅ Auto-reply set ho gaya: *Mention Only* (@bot mention karne pe jawab dega).`);
    }

    if (action === "all" || action === "always" || action === "every" || action === "on") {
      setChatAutoReply(chatId, "all");
      setChatAutoReply(rawChatId, "all");
      return reply(`✅ Auto-reply set ho gaya: *All Messages*! Bot ab is chat me messages ka natural reply karega.`);
    }

    if (action === "off" || action === "disable" || action === "band" || action === "bnd" || action === "stop" || action === "close" || action === "mute") {
      setChatAutoReply(chatId, "off");
      setChatAutoReply(rawChatId, "off");
      return reply(`✅ Auto-reply *OFF* ho gaya! Bot ab is chat me bina command ke koi jawab nahi dega.`);
    }

    return reply(`Usage:\n• \`${prefix}autoreply mention\`\n• \`${prefix}autoreply all\`\n• \`${prefix}autoreply off\``);
  },
};
