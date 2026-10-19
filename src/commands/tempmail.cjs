// file: src/commands/tempmail.cjs
//
// TempSter: Disposable Temporary Email Command
// Powered by AHM7 TempSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "tempmail",
  aliases: ["tmail", "fakemail", "tempemail"],
  description: {
    en: "Generates disposable temporary email addresses and checks inbox for incoming OTPs and verification emails.",
    ur: "عارضی ڈسپوزایبل ای میل ایڈریس بنائیں اور آنے والے او ٹی پی یا تصدیقی پیغامات چیک کریں.",
    ar: "إنشاء بريد إلكتروني مؤقت وفحص صندوق الوارد لرسائل التحقق ورموز OTP.",
  },
  usage: {
    en: "!tempmail create\n!tempmail check <email>",
    ur: "!tempmail create\n!tempmail check <ای میل>",
    ar: "!tempmail create\n!tempmail check <البريد>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "tempmail");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("tempmail")) {
      return await sock.sendMessage(chatId, { text: "⚠️ TempSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const sub = (args[0] || "").toLowerCase();

    if (!sub || sub === "help") {
      return await sock.sendMessage(chatId, {
        text: "📬 *TempSter Disposable Email Service*\n\n" +
              "Protect your personal inbox from spam, trackers, and unwanted marketing.\n\n" +
              "Commands:\n" +
              "• `!tempmail create` — Generate a brand new temporary email address.\n" +
              "• `!tempmail check <email>` — Read incoming messages and verification OTPs for that address.\n\n" +
              "💡 _Tip: Use this for one-time website signups and testing!_",
      }, { quoted: msg });
    }

    if (sub === "create" || sub === "new" || sub === "generate") {
      try {
        const data = await requestAhm7("tempmail", {
          params: { action: "create" },
          timeout: 15_000,
        });

        const email = data.email || (data.data && data.data.email) || null;
        if (!email) {
          throw new Error("No email returned by upstream provider");
        }

        return await sock.sendMessage(chatId, {
          text: `📬 *TempSter Temporary Email Created!*\n\n` +
                `📧 *Email Address:* \`${email}\`\n\n` +
                `⏳ *Status:* Active & Receiving\n` +
                `🔍 *Check Inbox:* Reply with \`!tempmail check ${email}\` to read incoming verification emails or OTP codes.`,
        }, { quoted: msg });
      } catch (err) {
        logger.error({ err: err.message }, "[TempSter] Failed to create email");
        return await sock.sendMessage(chatId, { text: `❌ Could not generate temporary email: ${err.message}` }, { quoted: msg });
      }
    }

    if (sub === "check" || sub === "inbox" || sub === "read") {
      const targetEmail = (args[1] || "").trim();
      if (!targetEmail || !targetEmail.includes("@")) {
        return await sock.sendMessage(chatId, { text: "⚠️ Please specify a valid email address to check:\n`!tempmail check <address@domain.com>`" }, { quoted: msg });
      }

      try {
        const data = await requestAhm7("tempmail", {
          params: { action: "inbox", email: targetEmail },
          timeout: 15_000,
        });

        const messages = Array.isArray(data) ? data : (data.messages || data.inbox || data.emails || []);

        if (messages.length === 0) {
          return await sock.sendMessage(chatId, {
            text: `📭 *Inbox Empty*\n\nNo incoming messages received yet for \`${targetEmail}\`.\nPlease wait a moment and try \`!tempmail check ${targetEmail}\` again.`,
          }, { quoted: msg });
        }

        let reply = `📬 *Inbox for:* \`${targetEmail}\` (${messages.length} message${messages.length === 1 ? "" : "s"})\n\n`;
        messages.slice(0, 5).forEach((m, idx) => {
          const from = m.from || m.sender || "Unknown";
          const subject = m.subject || "(No Subject)";
          const date = m.date || m.time || "Recent";
          const bodyText = (m.body || m.text || m.content || "").slice(0, 300);
          reply += `━━━━━━━━━━━━━━━━━━━━━\n` +
                   `#${idx + 1} *From:* ${from}\n` +
                   `📌 *Subject:* ${subject}\n` +
                   `🕒 *Date:* ${date}\n` +
                   `📝 *Content:* ${bodyText}\n\n`;
        });

        return await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
      } catch (err) {
        logger.error({ err: err.message, targetEmail }, "[TempSter] Failed to check inbox");
        return await sock.sendMessage(chatId, { text: `❌ Error checking inbox: ${err.message}` }, { quoted: msg });
      }
    }

    return await sock.sendMessage(chatId, { text: "⚠️ Unknown subcommand. Use `!tempmail create` or `!tempmail check <email>`" }, { quoted: msg });
  },
};
