// Keep-alive pinger for Render / cloud deployments
// Usage: node scripts/keep-alive.js https://your-yuxli-bot.onrender.com

const targetUrl = process.argv[2] || process.env.PING_TARGET_URL;

if (!targetUrl) {
  console.error("Usage: node scripts/keep-alive.js <TARGET_URL>");
  console.error("Example: node scripts/keep-alive.js https://yuxli-bot.onrender.com/health");
  process.exit(1);
}

const url = targetUrl.endsWith("/health") ? targetUrl : `${targetUrl.replace(/\/+$/, "")}/health`;
const INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS, 10) || 5 * 60 * 1000; // 5 minutes

console.log(`[Keep-Alive] Starting pinger for: ${url}`);
console.log(`[Keep-Alive] Interval: ${INTERVAL_MS / 1000} seconds`);

async function ping() {
  const timestamp = new Date().toISOString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Yuxli-KeepAlive/1.0" } });
    if (res.ok) {
      console.log(`[${timestamp}] ✅ Ping OK (${res.status})`);
    } else {
      console.warn(`[${timestamp}] ⚠️ Ping responded with status ${res.status}`);
    }
  } catch (err) {
    console.error(`[${timestamp}] ❌ Ping failed:`, err.message);
  }
}

// Initial ping
ping();

// Recurring ping
setInterval(ping, INTERVAL_MS);
