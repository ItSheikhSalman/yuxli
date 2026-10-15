// Professional System Health & Diagnostics Command (!status, !info, !system)

const os = require("os");
const baileysVersion = require("@whiskeysockets/baileys/package.json").version;
const logger = require("../utils/logger.cjs");
const { checkFfmpeg } = require("../utils/thumbnail.cjs");
const settings = require("../config/settings.cjs");
const botAccess = require("../services/botAccess.cjs");
const aiFailover = require("../services/aiFailover.cjs");

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
  name: "status",
  aliases: ["info", "system", "stats", "حالة"],
  description: {
    en: "Displays complete system diagnostics, AI provider info, and runtime metrics.",
    ur: "Complete system diagnostics, AI engine aur runtime stats dekhein.",
    ar: "عرض تشخيصات النظام الكاملة ومحرك الذكاء الاصطناعي وإحصائيات التشغيل.",
  },
  usage: {
    en: "status",
    ur: "status",
    ar: "status",
  },
  chat: "all",

  async execute(sock, msg) {
    try {
      const uptime = formatUptime(process.uptime());
      const memory = process.memoryUsage();
      const rssMb = (memory.rss / (1024 * 1024)).toFixed(1);
      const heapMb = (memory.heapUsed / (1024 * 1024)).toFixed(1);
      const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
      const freeRamGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);

      const provider = (settings.get("ai_provider") || "gemini").toLowerCase();
      const activeKeyCount = aiFailover.getKeyCount(provider);
      const botMode = botAccess.getAccessMode();
      const allowedGroups = botAccess.getAllowedGroups();

      const ffmpeg = await checkFfmpeg();
      const ffmpegStatus = ffmpeg.ok ? "✅ Operational" : "❌ Unavailable";

      const card = [
        `╭───「 📊 *SYSTEM STATUS & BOT HEALTH* 」`,
        `│`,
        `├─ 🧠 *AI Intelligence Engine:*`,
        `│  • Active Provider: *${provider.toUpperCase()}*`,
        `│  • Keys Configured: \`${activeKeyCount} key(s) rotating\``,
        `│  • Auto Failover: \`Active (Groq ⇄ Gemini ⇄ Free)\``,
        `│  • Default Language: *Roman Urdu (رومن اردو)*`,
        `│`,
        `├─ 🛡️ *Access & Scope Control:*`,
        `│  • Bot Work Mode: *${botMode.toUpperCase()}*`,
        `│  • Authorized Groups: \`${allowedGroups.length} whitelisted\``,
        `│`,
        `├─ 💻 *Host & Hardware Metrics:*`,
        `│  • System Uptime: \`${uptime}\``,
        `│  • Process RAM (RSS): \`${rssMb} MB\` (Heap: \`${heapMb} MB\`)`,
        `│  • Server RAM: \`${freeRamGb} GB free / ${totalRamGb} GB total\``,
        `│  • Platform: \`${os.platform()} (${os.arch()})\``,
        `│  • Node.js: \`${process.version}\``,
        `│  • Baileys Core: \`v${baileysVersion}\``,
        `│  • Media Transcoder: ${ffmpegStatus}`,
        `│`,
        `├─ 👨‍💻 *Credits & Creator:*`,
        `│  • Developer: *Sheikh Salman*`,
        `│  • Studio: *Yuxli Technologies*`,
        `│  • Engine: *Yuxli v2.5 Enterprise*`,
        `│`,
        `╰───「 🟢 100% Online & Stable 」`,
      ].join("\n");

      await sock.sendMessage(msg.key.remoteJid, { text: card }, { quoted: msg });
    } catch (error) {
      logger.error({ err: error }, "[Status] Failed to build status card");
      await sock.sendMessage(msg.key.remoteJid, {
        text: "❌ Status card render karne me masla hua.",
      });
    }
  },
};
