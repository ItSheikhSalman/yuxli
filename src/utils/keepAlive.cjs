// Bulletproof Keep-Alive System for Free-Tier Cloud Hosts (Render, Railway, etc.)
// Prevents Render from sleeping by sending multi-channel HTTP pings every 2 minutes.

const axios = require("axios");
const logger = require("./logger.cjs");

const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (safely beats Render's 15-minute idle limit)
let activeTimer = null;
let currentPublicUrl = null;
let currentLocalPort = 3001;

function resolveInitialUrl(port) {
  // 1. Explicit user override
  if (process.env.KEEP_ALIVE_URL) {
    return process.env.KEEP_ALIVE_URL.trim();
  }

  // 2. Render auto-injected external URL
  if (process.env.RENDER_EXTERNAL_URL) {
    const base = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, "");
    return `${base}/healthz`;
  }

  // 3. Render auto-injected hostname
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    const host = process.env.RENDER_EXTERNAL_HOSTNAME.trim();
    return `https://${host}/healthz`;
  }

  // 4. Custom public domain env
  if (process.env.PUBLIC_DOMAIN) {
    const domain = process.env.PUBLIC_DOMAIN.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${domain}/healthz`;
  }

  // 5. Localhost fallback
  if (port) {
    return `http://127.0.0.1:${port}/healthz`;
  }

  return null;
}

/**
 * Dynamically updates the public URL (e.g. when a real incoming request hits Express)
 */
function updateUrl(newUrl) {
  if (!newUrl || typeof newUrl !== "string") return;
  const cleaned = newUrl.trim();
  if (
    cleaned.startsWith("http") &&
    !cleaned.includes("127.0.0.1") &&
    !cleaned.includes("localhost") &&
    cleaned !== currentPublicUrl
  ) {
    currentPublicUrl = cleaned;
    logger.info(`[keep-alive] Updated public keep-alive target: ${currentPublicUrl}`);
  }
}

async function sendPing(targetUrl) {
  if (!targetUrl) return;

  try {
    const res = await axios.get(targetUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": "Yuxli-KeepAlive/2.0 (+https://github.com/ItSheikhSalman/yuxli)",
        Accept: "*/*",
      },
      validateStatus: () => true, // Don't throw on 2xx/3xx/4xx
    });
    logger.debug(`[keep-alive] Pinged ${targetUrl} — status ${res.status}`);
  } catch (err) {
    logger.warn(`[keep-alive] Direct ping to ${targetUrl} warning: ${err.message}`);
  }
}

/**
 * Pings via an external public reflector proxy so Render's edge load balancer
 * receives a real external internet request from outside the container.
 */
async function sendExternalReflectorPing(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith("https://") || publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1")) {
    return;
  }

  // Use reliable public CORS/proxy reflectors
  const reflectors = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(publicUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(publicUrl)}`,
  ];

  const targetReflector = reflectors[Math.floor(Math.random() * reflectors.length)];

  try {
    const res = await axios.get(targetReflector, {
      timeout: 20000,
      headers: { "User-Agent": "Mozilla/5.0 Yuxli-KeepAlive" },
      validateStatus: () => true,
    });
    logger.debug(`[keep-alive] External reflector ping succeeded via proxy (status ${res.status})`);
  } catch (err) {
    logger.debug(`[keep-alive] Reflector ping notice: ${err.message}`);
  }
}

async function pingCycle() {
  const isCloud = Boolean(
    process.env.RENDER ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_EXTERNAL_HOSTNAME ||
    process.env.RENDER_SERVICE_ID ||
    process.env.KEEP_ALIVE_URL ||
    process.env.PORT
  );

  // If local machine without KEEP_ALIVE_URL, skip
  if (!isCloud && !process.env.KEEP_ALIVE_URL && !currentPublicUrl) {
    return;
  }

  const primaryUrl = currentPublicUrl || resolveInitialUrl(currentLocalPort);

  // 1. Direct Ping to public endpoint
  if (primaryUrl) {
    await sendPing(primaryUrl);
  }

  // 2. External Reflector Ping (Hits Render from external internet IP to reset idle counter)
  if (primaryUrl && primaryUrl.startsWith("https://")) {
    await sendExternalReflectorPing(primaryUrl);
  }

  // 3. Local Heartbeat Ping
  if (currentLocalPort) {
    await sendPing(`http://127.0.0.1:${currentLocalPort}/healthz`);
  }
}

function start({ port = 3001 } = {}) {
  currentLocalPort = port || process.env.PORT || 3001;
  currentPublicUrl = resolveInitialUrl(currentLocalPort);

  logger.info(
    `[keep-alive] Starting 24/7 keep-alive loop (every ${INTERVAL_MS / 1000}s). Target: ${currentPublicUrl || `http://127.0.0.1:${currentLocalPort}`}`,
  );

  // Initial ping
  pingCycle().catch(() => {});

  // Recurring loop
  if (activeTimer) clearInterval(activeTimer);
  activeTimer = setInterval(() => {
    pingCycle().catch((err) => {
      logger.debug({ err: err?.message }, "[keep-alive] ping cycle error");
    });
  }, INTERVAL_MS);

  activeTimer.unref();
}

function stop() {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
}

module.exports = {
  start,
  stop,
  updateUrl,
  pingCycle,
};
