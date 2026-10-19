// file: src/commands/webzip.cjs
//
// WebZip: Complete Website Archiver into ZIP Command
// Powered by AHM7 WebZip (Exclusive to Business Pro & Enterprise tiers)

const { requestAhm7, assertSafePublicUrl } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { getWorkspaceSubscription } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "webzip",
  aliases: ["archiveweb", "zipweb", "saveweb"],
  description: {
    en: "Archives a complete website into a downloadable ZIP bundle with HTML and assets (Business Pro & Enterprise).",
    ur: "کسی بھی ویب سائٹ کو مکمل زپ فائل میں محفوظ کر کے ڈاؤن لوڈ کریں (بزنس پرو اور انٹرپرائز پلان).",
    ar: "أرشفة وتنزيل موقع إلكتروني بالكامل في ملف مضغوط ZIP.",
  },
  usage: {
    en: "!webzip <website url>",
    ur: "!webzip <ویب سائٹ کا لنک>",
    ar: "!webzip <رابط الموقع>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    // Enforce Pro / Enterprise gating
    const sub = getWorkspaceSubscription(workspaceId);
    if (sub.plan !== "pro" && sub.plan !== "enterprise") {
      return await sock.sendMessage(chatId, {
        text: "🔒 *Business Pro Feature*\n\n" +
              "WebZip full-site archiving requires a high-volume compute tier.\n" +
              "Upgrade your workspace to *Business Pro* or *Enterprise SLA* to use `!webzip`.",
      }, { quoted: msg });
    }

    if (!isServiceEnabled("webzip")) {
      return await sock.sendMessage(chatId, { text: "⚠️ WebZip archiving service is currently disabled by administrator." }, { quoted: msg });
    }

    const rawUrl = (args[0] || "").trim();
    if (!rawUrl) {
      return await sock.sendMessage(chatId, {
        text: "📦 *WebZip Complete Website Archiver*\n\n" +
              "Archive complete webpages and static assets into a downloadable .zip bundle.\n\n" +
              "Usage: `!webzip <url>`\n" +
              "Example: `!webzip https://example.com`",
      }, { quoted: msg });
    }

    let safeUrl;
    try {
      const urlToValidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      safeUrl = await assertSafePublicUrl(urlToValidate);
    } catch (urlErr) {
      return await sock.sendMessage(chatId, { text: `🛡️ Security Block: ${urlErr.message}` }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, `📦 Archiving ${new URL(safeUrl).hostname} into ZIP archive... Please wait...`, { replyTo: msg });

    try {
      const res = await requestAhm7("webzip", {
        method: "POST",
        data: { url: safeUrl },
        responseType: "arraybuffer",
        expectedFormat: "zip",
        category: "archiving",
        timeout: 45_000,
      });

      if (status?.remove) await status.remove();

      const hostname = new URL(safeUrl).hostname.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const safeFilename = `${hostname}_archive_${Date.now()}.zip`;

      await sock.sendMessage(chatId, {
        document: res.buffer,
        mimetype: "application/zip",
        fileName: safeFilename,
        caption: `📦 *WebZip Archive*\n🌐 *Source:* ${safeUrl}\n💾 *Format:* ZIP Archive`,
      }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, safeUrl }, "[WebZip] Archiving failed");
      const errText = `❌ Website archiving failed: ${err.message || "Timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
