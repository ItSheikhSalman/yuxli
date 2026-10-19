// file: src/commands/handwrite.cjs
//
// Text-to-Handwriting Command
// Converts digital text into realistic human handwriting on notebook paper.

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "handwrite",
  aliases: ["handwriting", "hw", "khat"],
  description: {
    en: "Converts digital text into realistic human handwriting on lined ruled paper.",
    ur: "کمپیوٹر کے لکھے ہوئے ٹیکسٹ کو اصلی ہاتھ کی لکھائی والے پیپر میں تبدیل کریں.",
    ar: "تحويل النص الرقمي إلى كتابة بخط اليد على ورقة مسطرة.",
  },
  usage: {
    en: "!handwrite <text>   (or reply to a text message)",
    ur: "!handwrite <ٹیکسٹ>   (یا میسج کو ریپلائی کریں)",
    ar: "!handwrite <النص>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "handwrite");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("handwriting")) {
      return await sock.sendMessage(chatId, { text: "⚠️ Text-to-Handwriting service is currently disabled by administrator." }, { quoted: msg });
    }

    let text = args.join(" ").trim();
    const quotedMsg =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;

    if (!text && quotedMsg) {
      text = quotedMsg.trim();
    }

    if (!text) {
      return await sock.sendMessage(chatId, {
        text: "✍️ *Text-to-Handwriting Generator*\n\n" +
              "Turn assignments, letters, or essays into realistic handwritten notes!\n\n" +
              "Usage: `!handwrite <your text here>`\n" +
              "Example: `!handwrite Artificial Intelligence is transforming society through machine learning.`\n\n" +
              "💡 _Tip: You can also reply to any message with `!handwrite`!_",
      }, { quoted: msg });
    }

    const status = await createStatus(sock, chatId, "✍️ Generating handwritten document... Please wait...", { replyTo: msg });

    try {
      const res = await requestAhm7("handwriting", {
        params: { text: text.slice(0, 1500) },
        responseType: "arraybuffer",
        expectedFormat: "png",
        category: "document",
        timeout: 30_000,
      });

      if (status?.remove) await status.remove();

      await sock.sendMessage(chatId, {
        image: res.buffer,
        caption: "✍️ *Handwritten Assignment Page*\n📄 Generated via YUXLI Handwriting Engine",
      }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message }, "[Handwriting] Failed to generate handwriting image");
      const errText = `❌ Handwriting generation failed: ${err.message || "Timeout"}`;
      if (status?.finish) await status.finish(errText);
      else await sock.sendMessage(chatId, { text: errText }, { quoted: msg });
    }
  },
};
