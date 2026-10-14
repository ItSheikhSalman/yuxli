// file: src/commands/translate.cjs
// 100% Free Translation & Voice Translation Command
// Zero API Key Required! Uses Google Web Translation + Google Voice TTS!

const logger = require("../utils/logger.cjs");
const { unwrapMessage, quotedOf, visibleText } = require("../utils/messageContent.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const { _synthesizeVoice } = require("./tts.cjs");
const { tr } = require("../utils/i18n.cjs");

const LANGUAGE_CODES = {
  ur: "ur",
  urdu: "ur",
  اردو: "ur",
  en: "en",
  english: "en",
  ar: "ar",
  arabic: "ar",
  عربي: "ar",
  hi: "hi",
  hindi: "hi",
  es: "es",
  spanish: "es",
  fr: "fr",
  french: "fr",
  de: "de",
  german: "de",
  tr: "tr",
  turkish: "tr",
  zh: "zh-CN",
  chinese: "zh-CN",
  ru: "ru",
  russian: "ru",
  fa: "fa",
  persian: "fa",
  ps: "ps",
  pashto: "ps",
  bn: "bn",
  bengali: "bn",
};

const LANGUAGE_NAMES = {
  ur: "Urdu (اردو)",
  en: "English",
  ar: "Arabic (العربية)",
  hi: "Hindi (हिन्दी)",
  es: "Spanish",
  fr: "French",
  de: "German",
  tr: "Turkish",
  "zh-CN": "Chinese",
  ru: "Russian",
  fa: "Persian (فارسی)",
  ps: "Pashto (پښتو)",
  bn: "Bengali",
};

/**
 * Free Google Translate API (No API key needed)
 */
async function translateText(text, targetLang = "ur", sourceLang = "auto") {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Translate service responded with status: ${res.status}`);
  }
  const data = await res.json();
  const translated = data[0].map((item) => item[0]).join("");
  const detectedSource = data[2] || sourceLang;
  return { text: translated, detectedSource };
}

module.exports = {
  name: "translate",
  aliases: ["tr", "tarjuma", "ترجمة", "ترجمه", "trans"],
  description: {
    en: "100% Free Translation & Voice Translation (Urdu, English, Arabic, etc.). Reply to any message or type text.",
    ar: "ترجمة فورية وترجمة صوتية مجانية تماماً وبدون أي مفتاح API.",
  },
  usage: {
    en: "!tr [lang] [text] — Translate text\n!tr voice [lang] [text] — Translate and send as Voice Note\nReply to any message with !tr or !tr ur/en",
    ar: "!tr [لغة] [نص]\n!tr voice [لغة] [نص]",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;

    try {
      // Check for quoted message text
      const quoted = quotedOf(msg);
      const quotedText = quoted ? visibleText(quoted) : "";

      let isVoice = false;
      let targetLang = "ur"; // default Urdu
      let textToTranslate = "";

      let workingArgs = [...(args || [])];

      // Check if user requested voice translation: !tr voice / !tr vn / !tr speak
      if (
        workingArgs[0] &&
        ["voice", "vn", "audio", "speak", "bol", "صوت"].includes(workingArgs[0].toLowerCase())
      ) {
        isVoice = true;
        workingArgs.shift();
      }

      // Check if first remaining argument is a language code
      if (workingArgs[0] && LANGUAGE_CODES[workingArgs[0].toLowerCase()]) {
        targetLang = LANGUAGE_CODES[workingArgs[0].toLowerCase()];
        workingArgs.shift();
      }

      // Check for audio note / voice message
      const own = unwrapMessage(msg.message);
      const quotedInner = quoted ? unwrapMessage(quoted) : null;
      const audioMessage = own?.audioMessage || quotedInner?.audioMessage;

      if (workingArgs.length > 0) {
        textToTranslate = workingArgs.join(" ").trim();
      } else if (quotedText) {
        textToTranslate = quotedText.trim();
        if (args.length === 0 || (isVoice && args.length === 1)) {
          if (/[\u0600-\u06FF]/.test(quotedText)) {
            targetLang = "en";
          } else {
            targetLang = "ur";
          }
        }
      } else if (audioMessage) {
        // Voice note translation!
        const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
        const { downloadMedia } = require("../utils/geminiMedia.cjs");
        const { transcribe } = require("./stt.cjs");

        await sock.sendMessage(chatId, {
          text: "🎧 *Voice note sun raha hoon aur tarjuma tayyar ho raha hai...*",
        });

        const audioBuffer = await downloadMedia(downloadContentFromMessage, audioMessage, "audio");
        textToTranslate = await transcribe(audioBuffer, audioMessage.mimetype);
      }

      if (!textToTranslate) {
        return await sock.sendMessage(chatId, {
          text:
            "🌐 *Free Instant & Voice Translator (مفت ترجمہ)*\n\n" +
            "Kisi bhi message ya Voice Note par reply karke ya aagy text likh kar bhejein:\n\n" +
            "🔹 `!tr ur Hello, how are you?` — English to Urdu\n" +
            "🔹 `!tr en آپ کا کیا نام ہے؟` — Urdu to English\n" +
            "🔹 `!tr ar Good morning` — English to Arabic\n" +
            "🔹 `!tr [text]` — Auto translate (Urdu ⇄ English)\n\n" +
            "🎙️ *Voice Translation (آواز میں ترجمہ):*\n" +
            "🔹 `!tr voice ur Good morning` — Tarjuma karke voice note bhejega!\n" +
            "🔹 `!tr voice en صبح بخیر` — English voice note bhejega!\n" +
            "🔹 Voice note par reply karke `!tr` likhein to us voice note ka tarjuma ho jayega!\n\n" +
            "💡 _Tip: 100% Free translation & audio synthesis without API keys!_",
        });
      }

      const status = await createStatus(
        sock,
        chatId,
        isVoice ? "🎙️ Tarjuma aur Voice Note tayyar ho raha hai..." : "🌐 Tarjuma ho raha hai...",
        { replyTo: msg },
      );

      const result = await translateText(textToTranslate, targetLang);
      const targetLangName = LANGUAGE_NAMES[targetLang] || targetLang.toUpperCase();
      const detectedLangName = LANGUAGE_NAMES[result.detectedSource] || result.detectedSource;

      if (isVoice && _synthesizeVoice) {
        try {
          const ttsLang = targetLang === "zh-CN" ? "zh" : targetLang;
          const voice = await _synthesizeVoice(result.text, ttsLang);

          await sendBotMessage(
            sock,
            chatId,
            {
              audio: voice.audio,
              mimetype: voice.mimetype,
              ptt: true,
            },
            { replyTo: msg, typing: false },
          );

          await status.finish(
            `🎙️ *Voice Translation (${targetLangName}):*\n\n` +
            `"${result.text}"\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🔤 *Original:* ${textToTranslate.slice(0, 150)}...\n` +
            `🌐 *From:* ${detectedLangName} ➔ *To:* ${targetLangName}`,
          );
          return;
        } catch (voiceErr) {
          logger.warn({ err: voiceErr }, "[Translate] TTS failed, delivering text only");
        }
      }

      // Format Text Translation
      const reply =
        `🌐 *Translation (${targetLangName})*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `${result.text}\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🔤 *From:* ${detectedLangName} ➔ *To:* ${targetLangName}\n` +
        `💡 _Awaaz me sunne ke liye: \`!tr voice ${targetLang} [text]\`_`;

      await status.finish(reply);
    } catch (err) {
      logger.error({ err, command: "translate" }, "Error in translate command");
      await sock.sendMessage(chatId, {
        text: `❌ Translation error: ${err.message || "Failed to translate"}`,
      });
    }
  },
};
