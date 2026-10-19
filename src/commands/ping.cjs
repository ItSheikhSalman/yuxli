const { tr } = require("../utils/i18n.cjs");
const settings = require("../config/settings.cjs");

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

module.exports = {
  name: "ping",
  aliases: ["p", "speed", "latency", "بینگ"],
  description: {
    en: "Checks bot latency and health.",
    ur: "Bot ki speed aur health check karein.",
    ar: "فحص سرعة استجابة البوت.",
  },
  usage: {
    en: "ping",
    ur: "ping",
    ar: "ping",
  },
  chat: "all",

  async execute(sock, msg) {
    if (settings.get("bot_language") === "en") {
      return await sock.sendMessage(
        msg.key.remoteJid,
        { text: "Pong! 🏓" },
        { quoted: msg },
      );
    }

    const start = Date.now();
    const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : start;
    const latency = Math.max(1, start - msgTime);

    const provider = (settings.get("ai_provider") || "gemini").toUpperCase();
    const lang = (settings.get("bot_language") || "ur") === "ur" ? "Roman Urdu" : settings.get("bot_language");
    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);

    const speedBadge = latency < 300 ? "⚡ Lightning Fast" : latency < 1000 ? "🟢 Good" : "🟡 Moderate";

    const card = [
      `╭───「 🏓 *PONG! SYSTEM DIAGNOSTICS · فحص سرعة استجابة النظام* 」`,
      `│`,
      `│  ⚡ *Speed:* \`${latency} ms\` (${speedBadge})`,
      `│  🧠 *AI Provider:* \`${provider}\``,
      `│  ⏳ *Uptime:* \`${uptime}\``,
      `│  💾 *RAM:* \`${ram} MB\``,
      `│  🌐 *Default Lang:* \`${lang}\``,
      `│  🟢 *State:* \`100% Operational · يعمل بكفاءة\``,
      `│`,
      `╰───「 🚀 Yuxli Assistant Engine 」`,
    ].join("\n");

    await sock.sendMessage(msg.key.remoteJid, { text: card }, { quoted: msg });
  },
};
