// Self-ping keep-alive for free-tier cloud hosts (Render, Railway, etc.).
//
// These platforms spin a service down after ~15 minutes of no inbound HTTP
// traffic. A WhatsApp bot talks over WebSockets to Meta's servers, not HTTP,
// so the platform never "sees" activity and puts the container to sleep.
//
// This module hits the bot's own /healthz endpoint every 4 minutes with a
// plain HTTP GET. That is enough to reset the idle timer and keep the process
// alive 24/7 without any external cron service.
//
// Enabled automatically when RENDER=true (set by Render) or when the operator
// sets KEEP_ALIVE_URL. Does nothing on a local machine.

const http = require("node:http");
const https = require("node:https");
const logger = require("../utils/logger.cjs");

const INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
let timer = null;

/**
 * Start the self-ping loop.
 *
 * @param {{ port: number }} options - the port the panel is listening on
 */
function start({ port } = {}) {
  // Explicit URL takes priority (operator can point at a custom domain).
  // Otherwise, if we're on Render, build the URL from Render's env vars.
  // On a local machine, do nothing.
  let url = process.env.KEEP_ALIVE_URL;

  if (!url && process.env.RENDER === "true") {
    const host = process.env.RENDER_EXTERNAL_HOSTNAME;
    if (host) {
      url = `https://${host}/healthz`;
    } else if (port) {
      // Fallback: hit ourselves on localhost (still resets Render's timer
      // because the HTTP request enters the container's own port).
      url = `http://127.0.0.1:${port}/healthz`;
    }
  }

  if (!url) return; // not on a cloud host — nothing to do

  logger.info(`[keep-alive] Pinging ${url} every ${INTERVAL_MS / 1000}s to prevent sleep`);

  const ping = () => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, (res) => {
      // Drain the response so the socket can be reused.
      res.resume();
      logger.debug(`[keep-alive] ${res.statusCode}`);
    });
    req.on("error", (err) => {
      // Not fatal — we'll try again in 4 minutes.
      logger.warn(`[keep-alive] ping failed: ${err.message}`);
    });
    req.setTimeout(10_000, () => req.destroy());
  };

  // First ping right away, then every INTERVAL_MS.
  ping();
  timer = setInterval(ping, INTERVAL_MS);
  timer.unref(); // don't keep the process alive just for this
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop };
