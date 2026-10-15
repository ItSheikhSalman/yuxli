// Smart Webpage & Article Summarizer Command (!summarize, !summary, !tldr, !khulasa)
// Extracts content from articles, blogs, news or text and produces a crisp Roman Urdu summary

const axios = require("axios");
const geminiCmd = require("./gemini.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const { stripHtml } = require("../utils/textDecode.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const logger = require("../utils/logger.cjs");

const URL_REGEX = /https?:\/\/[^\s]+/i;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchPageText(url) {
  const response = await axios.get(url, {
    headers: { "User-Agent": UA },
    timeout: 15000,
    maxContentLength: 5 * 1024 * 1024,
    responseType: "text",
  });

  const rawHtml = String(response.data || "");
  const clean = stripHtml(rawHtml).replace(/\s+/g, " ").trim();
  return clean.slice(0, 15000);
}

module.exports = {
  name: "summarize",
  aliases: ["summary", "tldr", "khulasa", "خلاصة"],
  description: {
    en: "Summarize any article, webpage link, or long message into concise Roman Urdu key points.",
    ur: "Kisi bhi article, webpage link ya lambi message ka mukhtasar Roman Urdu khulasa banayein.",
    ar: "تلخيص أي رابط مقال أو صفحة ويب أو رسالة طويلة إلى نقاط واضحة.",
  },
  usage: {
    en: "summarize <url>\nsummarize (reply to link or text)",
    ur: "summarize <link>\nsummarize (kisi message ya link ka reply karein)",
    ar: "summarize <رابط>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata) {
    const rawChatId = msg.key.remoteJid;
    const prefix = runtimeConfig.getPrefix();
    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    // Check quoted message
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
      quotedMsg?.conversation ||
      quotedMsg?.extendedTextMessage?.text ||
      quotedMsg?.imageMessage?.caption ||
      quotedMsg?.videoMessage?.caption ||
      "";

    let targetText = args.join(" ").trim();
    let isFromUrl = false;

    // Check if input or quoted contains URL
    const urlMatch = targetText.match(URL_REGEX) || quotedText.match(URL_REGEX);

    if (urlMatch) {
      const url = urlMatch[0];
      const status = await createStatus(sock, rawChatId, "🔍 Webpage read kar raha hoon...", { replyTo: msg });

      try {
        const extracted = await fetchPageText(url);
        if (!extracted || extracted.length < 50) {
          await status.remove();
          return reply("❌ Page ka content extract nahi ho saka. Website text-protected ho sakti hy.");
        }
        await status.remove();
        targetText = `Title/URL: ${url}\n\nContent:\n${extracted}`;
        isFromUrl = true;
      } catch (fetchErr) {
        await status.remove();
        logger.error({ err: fetchErr }, "[Summarize] Failed to fetch URL");
        return reply(`❌ Webpage open karne me masla hua: ${fetchErr.message || "Network Error"}`);
      }
    } else if (!targetText && quotedText) {
      targetText = quotedText;
    }

    if (!targetText) {
      return reply(
        `📑 *Smart AI Summarizer*\n\nBhai kisi link ya lambi message ka khulasa chahiye to:\n• Link ke sath likhein: \`${prefix}summarize https://example.com/article\`\n• Ya kisi lambay message pe reply karein: \`${prefix}summarize\``
      );
    }

    const prompt = [
      "Please provide a crystal-clear, professional, bulleted executive summary of the following content in natural Roman Urdu.",
      "Highlight:",
      "1. 📌 *Main Topic / Core Idea*",
      "2. 💡 *Key Highlights / Points* (bullet points)",
      "3. 🎯 *Conclusion / Final Takeaway*",
      "Keep it crisp, easy to read, and free of useless filler.",
      "",
      `Content to summarize:\n"""\n${targetText.slice(0, 12000)}\n"""`,
    ].join("\n");

    return geminiCmd.execute(sock, msg, prompt.split(/ +/), prompt, groupMetadata, {
      invokedName: "summarize",
    });
  },
};
