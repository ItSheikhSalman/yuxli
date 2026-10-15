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

    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
    const senderPhone = senderId ? senderId.split("@")[0] : "dost";
    const senderName = msg.pushName || senderPhone;

    let targetJid = null;
    let targetTag = null;
    let customNotes = "";

    const firstWord = (args[0] || "").toLowerCase().trim();

    if (firstWord === "me" || firstWord === "mujhe" || firstWord === "mera") {
      targetJid = senderId;
      targetTag = `@${senderName}`;
      customNotes = args.slice(1).join(" ").trim();
    } else if (mentionedJids.length > 0) {
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
      targetJid = targetTag;
    } else {
      // No target provided — roast the sender playfully!
      targetJid = senderId;
      targetTag = `@${senderName}`;
      customNotes = "Apna hi roast karwane aa gaye bina kisi ka naam liye!";
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
