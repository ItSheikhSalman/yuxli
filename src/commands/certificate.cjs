// file: src/commands/certificate.cjs
//
// CertSter: Professional Certificate & Diploma Generator Command
// Powered by AHM7 CertSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "certificate",
  aliases: ["cert", "diploma", "sanad"],
  description: {
    en: "Generates high-resolution vector certification diplomas and achievement awards in PDF.",
    ur: "اعزازی اسناد اور پروفیشنل سرٹیفکیٹ بنائیں اور پی ڈی ایف میں ڈاؤن لوڈ کریں.",
    ar: "توليد شهادات ودبلومات احترافية بصيغة PDF.",
  },
  usage: {
    en: "!certificate <Name> | <Course / Award> | [Template 1-8] | [Date] | [Details]",
    ur: "!certificate <نام> | <کورس یا اعزاز> | [ٹیمپلیٹ 1-8] | [تاریخ] | [تفصیلات]",
    ar: "!certificate <الاسم> | <عنوان الشهادة>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "certificate");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("certificate")) {
      return await sock.sendMessage(chatId, { text: "⚠️ CertSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const rawInput = args.join(" ").trim();
    if (!rawInput || !rawInput.includes("|")) {
      return await sock.sendMessage(chatId, {
        text: "🎓 *CertSter Certificate & Diploma Generator*\n\n" +
              "Generate formal achievement certificates in PDF format!\n\n" +
              "Usage: `!certificate Name | Course or Title | [Template 1-8] | [Date] | [Details]`\n\n" +
              "Examples:\n" +
              "• `!certificate John Doe | Full Stack Web Development | 1`\n" +
              "• `!certificate Sara Ahmed | Outstanding Leadership Award | 3 | 2026-10-18 | For exceptional community service`\n\n" +
              "Templates available: 1 to 8 (Classic, Modern, Formal, Elegant, Tech, etc.)",
      }, { quoted: msg });
    }

    const parts = rawInput.split("|").map((p) => p.trim());
    const name = parts[0] || "Recipient Name";
    const title = parts[1] || "Certificate of Excellence";
    const templateId = Math.max(1, Math.min(8, parseInt(parts[2], 10) || 1));
    const date = parts[3] || new Date().toISOString().slice(0, 10);
    const details = parts[4] || "In recognition of successful completion and outstanding performance.";
    const signature = "Director of Certification";

    const status = await createStatus(sock, chatId, `🎓 Generating Certificate for "${name}" (Template ${templateId})...`, { replyTo: msg });

    try {
      const payload = {
        templateId,
        name,
        title,
        date,
        signature,
        details,
        format: "pdf",
      };

      const res = await requestAhm7("certificate", {
        method: "POST",
        data: payload,
        responseType: "arraybuffer",
        expectedFormat: "pdf",
        category: "document",
        timeout: 30_000,
      });

      if (status?.remove) await status.remove();

      const safeFilename = `Certificate_${name.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 30).trim() || "Diploma"}.pdf`;

      await sock.sendMessage(chatId, {
        document: res.buffer,
        mimetype: "application/pdf",
        fileName: safeFilename,
        caption: `🎓 *Certificate of Achievement*\n👤 *Awarded to:* ${name}\n📜 *Title:* ${title}\n📅 *Date:* ${date}`,
      }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, name }, "[CertSter] Failed to generate certificate");
      const errText = `❌ Certificate generation failed: ${err.message || "Upstream timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
