// file: src/commands/screenshot.cjs
//
// WebSnap: High-Resolution Webpage Screenshot Command
// Powered by AHM7 WebSnap with SSRF Protection

const { requestAhm7, assertSafePublicUrl } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "screenshot",
  aliases: ["snap", "webshot", "ss"],
  description: {
    en: "Captures a high-resolution screenshot of any public website (full-page, desktop, or mobile).",
    ur: "کسی بھی ویب سائٹ کا ہائی ریزولوشن اسکرین شاٹ نکالیں (ڈیسک ٹاپ، موبائل یا فل پیج).",
    ar: "التقاط لقطة شاشة عالية الدقة لأي موقع إلكتروني عام.",
  },
  usage: {
    en: "!screenshot <url> [full|desktop|mobile]",
    ur: "!screenshot <url> [full|desktop|mobile]",
    ar: "!screenshot <الرابط> [full|desktop|mobile]",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "screenshot");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("screenshot")) {
      return await sock.sendMessage(chatId, { text: "⚠️ WebSnap screenshot service is currently disabled by administrator." }, { quoted: msg });
    }

    const rawUrl = (args[0] || "").trim();
    if (!rawUrl) {
      return await sock.sendMessage(chatId, {
        text: "📸 *WebSnap Webpage Screenshot*\n\n" +
              "Usage: `!screenshot <url> [full|desktop|mobile]`\n\n" +
              "Examples:\n" +
              "• `!screenshot https://news.ycombinator.com`\n" +
              "• `!screenshot https://github.com mobile`\n" +
              "• `!screenshot https://wikipedia.org full`",
      }, { quoted: msg });
    }

    const typeArg = (args[1] || "desktop").toLowerCase();
    const type = ["full", "desktop", "mobile"].includes(typeArg) ? typeArg : "desktop";

    let safeUrl;
    try {
      const urlToValidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      safeUrl = await assertSafePublicUrl(urlToValidate);
    } catch (urlErr) {
      return await sock.sendMessage(chatId, { text: `🛡️ Security Block: ${urlErr.message}` }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, `📸 Capturing ${type} screenshot of ${new URL(safeUrl).hostname}...`, { replyTo: msg });

    try {
      const res = await requestAhm7("screenshot", {
        params: { url: safeUrl, type },
        responseType: "arraybuffer",
        expectedFormat: "image",
        category: "media",
        timeout: 30_000,
      });

      if (status?.remove) await status.remove();

      await sock.sendMessage(chatId, {
        image: res.buffer,
        caption: `📸 *WebSnap Screenshot*\n🌐 *URL:* ${safeUrl}\n📱 *Mode:* ${type.toUpperCase()}`,
      }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, safeUrl }, "[WebSnap] Failed to capture screenshot");
      const errText = `❌ Screenshot capture failed: ${err.message || "Upstream timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
