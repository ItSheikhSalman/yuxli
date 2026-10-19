// file: src/commands/transcribe.cjs
//
// TranScribe: Media & YouTube Speech Transcription Command
// Powered by AHM7 TranScribe

const { transcribeUrl } = require("../services/integrations/ahm7/adapters/transcribeAdapter.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "transcribe",
  aliases: ["audiototext", "videototext", "ytranscribe"],
  description: {
    en: "Extracts and transcribes spoken audio into full text from YouTube, video links, or audio streams.",
    ur: "یوٹیوب یا آڈیو لنک سے آواز کو مکمل تحریری ٹیکسٹ میں تبدیل کریں.",
    ar: "تفريغ الصوت وتحويله إلى نص مكتوب من روابط يوتيوب ومقاطع الفيديو.",
  },
  usage: {
    en: "!transcribe <youtube or audio url>",
    ur: "!transcribe <ویڈیو یا آڈیو کا لنک>",
    ar: "!transcribe <رابط الفيديو أو الصوت>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "transcribe");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("transcribe")) {
      return await sock.sendMessage(chatId, { text: "⚠️ TranScribe service is currently disabled by administrator." }, { quoted: msg });
    }

    const rawUrl = (args[0] || "").trim();
    if (!rawUrl) {
      return await sock.sendMessage(chatId, {
        text: "🎙️ *TranScribe Media Speech-to-Text*\n\n" +
              "Transcribe YouTube videos or audio streams directly into text.\n\n" +
              "Usage: `!transcribe <media url>`\n" +
              "Example: `!transcribe https://www.youtube.com/watch?v=dQw4w9WgXcQ`",
      }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, "🎙️ Transcribing audio from media stream... Please wait...", { replyTo: msg });

    try {
      const result = await transcribeUrl(rawUrl);

      if (status?.remove) await status.remove();

      const title = result.title || "Audio Media";
      const duration = result.duration ? `⏱️ *Duration:* ${result.duration}\n` : "";
      const text = result.transcript ? result.transcript.trim() : "No transcript generated.";

      let reply = `🎙️ *Transcript: ${title}*\n${duration}\n` +
                  `📝 *Content:*\n${text.slice(0, 3000)}`;

      if (text.length > 3000) {
        reply += `\n\n_(Truncated. Total length: ${text.length} characters)_`;
      }

      await sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, rawUrl }, "[TranScribe] Transcription error");
      const errText = `❌ Transcription failed: ${err.message || "Upstream timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
