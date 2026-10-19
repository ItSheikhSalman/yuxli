// file: src/commands/alldl.cjs
//
// Universal Downloader: Video & Media Downloader Command
// Powered by AHM7 Universal Downloader

const { requestAhm7, assertSafePublicUrl } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "alldl",
  aliases: ["downloader", "ytdl", "tiktokdl", "igdl", "fbdl"],
  description: {
    en: "Downloads and extracts videos and media from TikTok, YouTube, Instagram, Facebook, Twitter/X, and more.",
    ur: "یوٹیوب، ٹک ٹاک، انسٹاگرام اور فیس بک سے ویڈیوز ڈاؤن لوڈ کریں.",
    ar: "تحميل مقاطع الفيديو والوسائط من يوتيوب وتيك توك وإنستغرام وفيسبوك.",
  },
  usage: {
    en: "!alldl <video or media url>",
    ur: "!alldl <ویڈیو کا لنک>",
    ar: "!alldl <رابط الفيديو>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "alldl");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("alldl")) {
      return await sock.sendMessage(chatId, { text: "⚠️ Universal Downloader service is currently disabled by administrator." }, { quoted: msg });
    }

    const rawUrl = (args[0] || "").trim();
    if (!rawUrl) {
      return await sock.sendMessage(chatId, {
        text: "📥 *Universal Media Downloader*\n\n" +
              "Download videos & audio from popular platforms.\n\n" +
              "Usage: `!alldl <media url>`\n" +
              "Supported: TikTok, Instagram, Facebook, Twitter/X, YouTube, Pinterest, etc.\n\n" +
              "Example:\n" +
              "• `!alldl https://www.tiktok.com/@user/video/1234567890`",
      }, { quoted: msg });
    }

    let safeUrl;
    try {
      const urlToValidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      safeUrl = await assertSafePublicUrl(urlToValidate);
    } catch (urlErr) {
      return await sock.sendMessage(chatId, { text: `🛡️ Security Block: ${urlErr.message}` }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, "📥 Extracting media streams... Please wait...", { replyTo: msg });

    try {
      const data = await requestAhm7("alldl", {
        params: { url: safeUrl },
        category: "media",
        timeout: 30_000,
      });

      if (status?.remove) await status.remove();

      if (!data || typeof data !== "object") {
        throw new Error("Invalid response from downloader provider");
      }

      const title = data.title || data.caption || "Media File";
      const author = data.author || data.uploader || "Unknown Author";
      const duration = data.duration || null;
      const downloads = Array.isArray(data.medias) ? data.medias : (Array.isArray(data.links) ? data.links : []);

      let reply = `🎬 *${title}*\n👤 *Creator:* ${author}\n`;
      if (duration) reply += `⏱️ *Duration:* ${duration}\n`;
      reply += `\n📥 *Download Links:*\n`;

      if (downloads.length > 0) {
        downloads.slice(0, 4).forEach((dl, i) => {
          const quality = dl.quality || dl.resolution || dl.type || `Stream #${i + 1}`;
          const link = dl.url || dl.link;
          if (link) {
            reply += `• *${quality}:* ${link}\n`;
          }
        });
      } else if (data.url || data.videoUrl || data.downloadUrl) {
        reply += `• *Direct Stream:* ${data.url || data.videoUrl || data.downloadUrl}\n`;
      } else {
        reply += `• *Result:* ${JSON.stringify(data).slice(0, 300)}\n`;
      }

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, safeUrl }, "[Universal Downloader] Extraction failed");
      const errText = `❌ Media extraction failed: ${err.message || "Upstream server error"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
