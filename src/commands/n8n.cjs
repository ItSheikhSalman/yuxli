// file: src/commands/n8n.cjs
//
// n8nSter: Workflow Automation Templates Command
// Powered by AHM7 n8nSter

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "n8n",
  aliases: ["workflow", "n8nworkflow", "automate"],
  description: {
    en: "Finds ready-made n8n workflow automation templates with direct JSON schema links.",
    ur: "ریڈی میڈ n8n آٹومیشن ٹیمپلیٹس اور ورک فلوز تلاش کریں.",
    ar: "البحث عن قوالب أتمتة مهام وسير عمل جاهزة لنظام n8n.",
  },
  usage: {
    en: "!n8n <automation keyword>",
    ur: "!n8n <کی ورڈ>",
    ar: "!n8n <كلمة البحث>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "n8n");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("n8n")) {
      return await sock.sendMessage(chatId, { text: "⚠️ n8nSter service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "⚡ *n8n Automation Blueprint Finder*\n\n" +
              "Search ready-to-import n8n workflow templates.\n\n" +
              "Usage: `!n8n <topic>`\n" +
              "Examples:\n" +
              "• `!n8n WhatsApp bot`\n" +
              "• `!n8n Google Sheets to Email`\n" +
              "• `!n8n Telegram AI summarizer`",
      }, { quoted: msg });
    }

    try {
      const data = await requestAhm7("n8n", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(data) ? data : (data.workflows || data.templates || data.results || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, { text: `⚡ No n8n workflows found for "${query}". Try searching for generic terms like "AI", "Telegram", or "Webhook".` }, { quoted: msg });
      }

      let reply = `⚡ *n8n Automation Templates for "${query}":*\n\n`;
      list.slice(0, 4).forEach((wf, idx) => {
        const name = wf.name || wf.title || "Workflow Template";
        const desc = (wf.description || wf.summary || "Ready-to-use automation flow").slice(0, 160);
        const link = wf.url || wf.jsonUrl || wf.link || "";
        reply += `*${idx + 1}. ${name}*\n` +
                 `📝 ${desc}...\n` +
                 (link ? `🔗 *Blueprint:* ${link}\n` : "") +
                 `\n`;
      });

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[n8nSter] Search error");
      await sock.sendMessage(chatId, { text: `❌ n8n search error: ${err.message}` }, { quoted: msg });
    }
  },
};
