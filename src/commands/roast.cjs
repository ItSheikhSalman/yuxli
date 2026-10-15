// Dedicated Friend Roast Command (!roast, !burn, !beizzati)
// Delivers hilarious, savage, raw burns for friends banter ("friends wala mazak")

const geminiCmd = require("./gemini.cjs");
const { getChatFilter } = require("../services/aiFilter.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");

module.exports = {
  name: "roast",
  aliases: ["burn", "beizzati", "روسٹ"],
  description: {
    en: "Roast a friend or mentioned user with hilarious, savage burns (close friend banter).",
    ur: "Kisi dost ko mazedaar aur savage roast karwayein (doston wala mazak).",
    ar: "قصف جبهة صديق أو شخص مشارك بأسلوب مضحك وساخر.",
  },
  usage: {
    en: "roast @friend [topic]\nroast [name]\nroast (reply to someone's message)",
    ur: "roast @dost\nroast <naam>\nroast (kisi ke message ka reply karein)",
    ar: "roast @friend",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const prefix = runtimeConfig.getPrefix();
    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    // Check content filter
    const chatFilter = getChatFilter(chatId);
    if (chatFilter === "on") {
      return reply(
        `⚠️ *Is chat me Filter ON hy!*\n\nSafe mode me dirty jokes aur savage gaaliyan blocked hain. Doston wala unfiltered roast karwane ke liye pehle \`${prefix}filter off\` karein.`
      );
    }

    // Extract target:
    // 1. Mentions
    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo;
    const mentionedJids = contextInfo?.mentionedJid || [];

    // 2. Quoted participant
    const quotedParticipant = contextInfo?.participant;

    let targetJid = null;
    let targetTag = null;
    let customNotes = "";

    if (mentionedJids.length > 0) {
      targetJid = normalizeJid(mentionedJids[0]);
      const phone = targetJid.split("@")[0];
      targetTag = `@${phone}`;
      customNotes = args.filter((a) => !a.includes(phone) && !a.startsWith("@")).join(" ").trim();
    } else if (quotedParticipant) {
      targetJid = normalizeJid(quotedParticipant);
      const phone = targetJid.split("@")[0];
      targetTag = `@${phone}`;
      customNotes = args.join(" ").trim();
    } else if (args.length > 0) {
      targetTag = args.join(" ").trim();
      targetJid = null;
    }

    if (!targetTag) {
      return reply(
        `🔥 *Friend Roast Mode* 🔥\n\nBhai kis ko roast karwana hy?\n• Dost ko mention karein: \`${prefix}roast @friend\`\n• Kisi ke message pe reply karein: \`${prefix}roast\`\n• Ya naam likhein: \`${prefix}roast Ali\``
      );
    }

    const roastPrompt = customNotes
      ? `Roast ${targetTag} savagely and hilariously! Special topic/habit to roast: "${customNotes}". Make it brutal, witty, and unforgettable friend banter!`
      : `Roast ${targetTag} savagely and hilariously in authentic Pakistani close-friends banter style! Mock their funny habits, look, attitude, and excuses!`;

    const targetInfo = {
      targetTag,
      targetJid: targetJid || targetTag,
    };

    return geminiCmd.execute(sock, msg, roastPrompt.split(/ +/), roastPrompt, groupMetadata, {
      invokedName: "roast",
      isTargetedRoast: true,
      targetInfo,
      mode: "roast",
    });
  },
};
