// Chat AI Content Filter Toggle Command
// - !filter on: Safe innocent mode (replies "Mujhe iss baat ka nahi pata" on cusses/abuse)
// - !filter off: Unfiltered mode (full freedom to curse, roast, and banter as demanded)

const { getChatFilter, setChatFilter } = require("../services/aiFilter.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const { isOwnerJidSync } = require("../utils/permissions.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const { tr } = require("../utils/i18n.cjs");

module.exports = {
  name: "filter",
  aliases: ["aifilter", "nsfwfilter", "فیلٹر"],
  description: {
    en: "Turns chat filter ON (innocent mode) or OFF (unfiltered freedom / raw roasts & curses).",
    ur: "چیٹ فیلٹر آن کریں (معصوم موڈ) یا آف کریں (کھلی آزادی / گالیاں اور روسٹنگ)۔",
    ar: "تفعيل أو تعطيل فلتر المحتوى للذكاء الاصطناعي في هذه المحادثة.",
  },
  usage: {
    en: "filter\nfilter on\nfilter off",
    ur: "filter (سٹیٹس چیک کریں)\nfilter on (فیلٹر آن: گالی پر 'مجھے نہیں پتا' بولے گا)\nfilter off (فیلٹر آف: کھلی آزادی)",
    ar: "filter\nfilter on\nfilter off",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const isGroup = chatId.endsWith("@g.us");
    const senderId = normalizeJid(isGroup ? msg.key.participant : rawChatId);
    const isOwner = msg.key.fromMe || isOwnerJidSync(senderId);

    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });
    const prefix = runtimeConfig.getPrefix();
    const action = (args[0] || "").toLowerCase().trim();

    const currentFilter = getChatFilter(chatId);

    if (!action || action === "status") {
      const statusLabel = currentFilter === "on" ? "🟢 *ON (Safe / Shareef Mode)*" : "🔴 *OFF (Unfiltered Azadi)*";
      const desc = currentFilter === "on"
        ? "Is chat me gaaliyan aur dirty language blocked hain. AI masoom ban ke reply karega: _'Mujhe iss baat ka nahi pata.'_"
        : "Is chat me filter mukammal OFF hy! AI khuli azadi se har tarah ki baatein, savage roasts aur gaaliyan de sakta hy (doston wala mazak).";

      return reply(
        `🛡️ *Chat Content Filter Status:*\n\nStatus: ${statusLabel}\n\n${desc}\n\n💡 *Badalne ke liye:*\n• \`${prefix}filter on\` — Filter ON karein (Safe / Shareef mode)\n• \`${prefix}filter off\` — Filter OFF karein (Unfiltered azadi)`
      );
    }

    if (action === "on" || action === "enable" || action === "1") {
      setChatFilter(chatId, "on");
      return reply(
        `✅ *Filter is chat ke liye ON kar diya gaya hy!*\n\n😇 AI ab bilkul clean aur shareef rahega. Koi gaali ya abuse karega to bot strictly reply karega:\n_"Mujhe iss baat ka nahi pata."_`
      );
    }

    if (action === "off" || action === "disable" || action === "0") {
      setChatFilter(chatId, "off");
      return reply(
        `🔥 *Filter is chat ke liye OFF kar diya gaya hy!*\n\n😈 AI ke paas ab 100% full azadi hy! Raw desi gaaliyan, savage roasts aur doston wala mazak khul ke karega!`
      );
    }

    return reply(`Usage:\n• \`${prefix}filter on\`\n• \`${prefix}filter off\``);
  },
};
