// Text-to-Speech Command using Google TTS and ffmpeg-static.
//
// Google TTS produces MP3. WhatsApp voice notes are OGG/Opus, so the command:
//   1. Generates one or more MP3 chunks with @sefinek/google-tts-api.
//   2. Concatenates the MP3 frames into one temporary file.
//   3. Invokes the ffmpeg-static binary directly to create OGG/Opus.
//
// Calling ffmpeg directly keeps the dependency surface small and avoids the
// deprecated fluent-ffmpeg wrapper. If ffmpeg is unavailable or transcoding
// fails, the raw MP3 is still sent as a normal audio attachment.

const googleTTS = require("@sefinek/google-tts-api");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const os = require("os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const logger = require("../utils/logger.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const settings = require("../config/settings.cjs");

const execFileAsync = promisify(execFile);

const { ffmpegPath } = require("../utils/thumbnail.cjs");
const { tr } = require("../utils/i18n.cjs");

function tmpPath(ext) {
  return path.join(
    os.tmpdir(),
    `wa-bot-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );
}

function resolveTtsLang(text = "", requestedLang) {
  if (requestedLang && requestedLang !== "auto") return requestedLang;
  const botLang = settings.get("bot_language") || "ur";
  if (botLang === "ur") return "ur";
  if (botLang === "en") return "en";
  if (botLang === "ar") return "ar";

  const clean = String(text || "").trim();
  if (/[\u0679\u0688\u0691\u06BA\u06C1\u06D2\u06BE\u067E\u0686\u06AF\u0698]/.test(clean)) {
    return "ur";
  }
  if (/[\u0600-\u06FF]/.test(clean)) {
    return botLang === "ar" ? "ar" : "ur";
  }
  if (/^[a-zA-Z0-9\s.,!?'"-]+$/.test(clean)) {
    const commonEnglish = /\b(the|is|are|you|how|what|why|who|where|when|this|that|with|for|from|have|has)\b/i;
    if (commonEnglish.test(clean)) return "en";
    return "ur";
  }
  return "ur";
}

async function synthesizeMp3(text, mp3Path, lang = "ur") {
  const parts = await googleTTS.getAllAudioBase64(text, {
    lang,
    slow: false,
    timeout: 15_000,
    splitPunct: "،,.!?؟؛;:\n",
  });

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("Google TTS returned no audio");
  }

  const buffers = parts.map((part) => Buffer.from(part.base64, "base64"));
  await fsp.writeFile(mp3Path, Buffer.concat(buffers));
}

async function transcodeWithEncoder(bin, encoder, mp3Path, oggPath) {
  return execFileAsync(
    bin,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      mp3Path,
      "-vn",
      "-c:a",
      encoder,
      "-ac",
      "1",
      "-ar",
      "48000",
      "-b:a",
      "48k",
      "-application",
      "voip",
      "-f",
      "ogg",
      oggPath,
    ],
    { windowsHide: true, timeout: 30_000 },
  );
}

async function transcodeToOpus(mp3Path) {
  const bin = ffmpegPath();
  if (!bin) return null;

  const oggPath = tmpPath("ogg");
  const encoders = ["libopus", "opus"];
  let lastError = null;

  for (const encoder of encoders) {
    try {
      await transcodeWithEncoder(bin, encoder, mp3Path, oggPath);
      return oggPath;
    } catch (err) {
      lastError = err;
      const msg = `${err?.message || ""} ${err?.stderr || ""}`;
      if (msg.includes("Unknown encoder")) {
        continue;
      }
      break;
    }
  }

  logger.warn(
    { err: lastError?.message, bin },
    "[TTS] ffmpeg transcode failed — will fall back to raw MP3",
  );
  return null;
}

/**
 * Text -> sendable voice payload, shared by the !tts command and the AI
 * agent's `speak` tool. Resolves to { audio, mimetype, ptt }: Opus/OGG for a
 * proper push-to-talk note when ffmpeg can transcode, raw MP3 otherwise.
 * Temp files are cleaned up here either way.
 */
async function synthesizeVoice(text, lang) {
  const chosenLang = resolveTtsLang(text, lang);
  const mp3Path = tmpPath("mp3");
  const preferredProvider = settings.get("tts_provider") || "google";
  let synthesized = false;

  try {
    if (preferredProvider === "speechster") {
      try {
        const speechster = require("../services/integrations/ahm7/adapters/speechsterAdapter.cjs");
        const res = await speechster.synthesizeSpeech(text, { lang: chosenLang });
        await fsp.writeFile(mp3Path, res.buffer);
        synthesized = true;
      } catch (err) {
        logger.warn({ err: err.message }, "[TTS] SpeechSter preferred provider failed, falling back to Google TTS");
      }
    }

    if (!synthesized) {
      try {
        await synthesizeMp3(text, mp3Path, chosenLang);
        synthesized = true;
      } catch (googleErr) {
        logger.warn({ err: googleErr.message }, "[TTS] Google TTS failed, attempting AHM7 SpeechSter fallback");
        try {
          const speechster = require("../services/integrations/ahm7/adapters/speechsterAdapter.cjs");
          const res = await speechster.synthesizeSpeech(text, { lang: chosenLang });
          await fsp.writeFile(mp3Path, res.buffer);
          synthesized = true;
        } catch (speechsterErr) {
          logger.error({ err: speechsterErr.message }, "[TTS] Both Google TTS and SpeechSter failed");
          throw googleErr;
        }
      }
    }

    const oggPath = await transcodeToOpus(mp3Path);
    if (oggPath && fs.existsSync(oggPath)) {
      const audio = await fsp.readFile(oggPath);
      await fsp.unlink(oggPath).catch(() => {});
      return { audio, mimetype: "audio/ogg; codecs=opus", ptt: true };
    }

    const audio = await fsp.readFile(mp3Path);
    return { audio, mimetype: "audio/mpeg", ptt: false };
  } finally {
    await fsp.unlink(mp3Path).catch(() => {});
  }
}

module.exports = {
  name: "tts",
  aliases: ["tovoice", "speak", "بول", "صوت"],
  description: {
    en: "Converts text to speech in Urdu/English (free — no API costs).",
    ur: "ٹیکسٹ کو اردو یا انگلش آواز میں تبدیل کرتا ہے (بالکل مفت).",
    ar: "يحوّل النص إلى كلام مسموع (مجاني — بدون تكلفة API).",
  },
  usage: {
    en: "tts <text>   (or reply to a text message)",
    ur: "tts <ٹیکسٹ>   (یا کسی میسج کو !tts لکھ کر ریپلائی کریں)",
    ar: "tts <النص>   (أو ردّ على رسالة نصية)",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;

    let textToConvert = args.join(" ").trim();
    const quotedMsg =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;

    const LANG_CODES = {
      ur: "ur",
      urdu: "ur",
      "اردو": "ur",
      en: "en",
      english: "en",
      ar: "ar",
      arabic: "ar",
      "عربي": "ar",
      hi: "hi",
      hindi: "hi",
    };
    let explicitLang = null;
    const firstWord = (args[0] || "").toLowerCase();
    if (LANG_CODES[firstWord] && (args.length > 1 || quotedMsg)) {
      explicitLang = LANG_CODES[firstWord];
      textToConvert = args.slice(1).join(" ").trim();
    }

    if (!textToConvert && quotedMsg) textToConvert = quotedMsg;

    if (!textToConvert) {
      return sendBotMessage(
        sock,
        chatId,
        {
          text: tr(
            "📢 Usage:\n!tts <text>\n!tts ur <text>\n!tts en <text>\n\nor reply to a text message with !tts\n\n✨ Completely free — no costs!",
            "📢 الاستخدام:\n!tts <النص>\n\nأو ردّ على رسالة نصية بالأمر !tts\n\n✨ الخدمة مجانية!",
            "📢 استعمال:\n!tts <ٹیکسٹ>\n!tts ur <اردو ٹیکسٹ>\n!tts en <انگلش ٹیکسٹ>\n\nیا کسی میسج کو !tts لکھ کر ریپلائی کریں\n\n✨ بالکل مفت!",
          ),
        },
        { replyTo: msg },
      );
    }

    // One status line: it disappears once the voice note is on its way.
    const status = await createStatus(
      sock,
      chatId,
      tr("🎙️ Turning the text into speech...", "🎙️ بحوّل النص لصوت...", "🎙️ آواز تیار کی جا رہی ہے..."),
      {
        replyTo: msg,
      },
    );

    try {
      const voice = await synthesizeVoice(textToConvert, explicitLang);

      if (voice.ptt) {
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
      } else {
        // Fallback: send the raw MP3 with the correct mimetype.
        await sendBotMessage(
          sock,
          chatId,
          {
            audio: voice.audio,
            mimetype: voice.mimetype,
            ptt: false,
          },
          { replyTo: msg, typing: false },
        );
      }

      // The voice note IS the answer — drop the status line.
      await status.remove();
      logger.info("[TTS] Successfully delivered TTS audio in Urdu/selected voice");
    } catch (error) {
      logger.error({ err: error }, "[TTS] Error converting text to speech");
      await status.fail(
        error,
        tr(
          "Something went wrong turning the text into speech",
          "حصلت مشكلة وأنا بحوّل النص لصوت",
          "ٹیکسٹ کو آواز میں تبدیل کرنے میں مسئلہ پیش آیا",
        ),
      );
    }
  },

  // exported for the AI agent's `speak` tool — one synthesizer, two doors
  _synthesizeVoice: synthesizeVoice,
};
