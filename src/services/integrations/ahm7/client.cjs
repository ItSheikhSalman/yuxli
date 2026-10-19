// file: src/services/integrations/ahm7/client.cjs
//
// Centralized HTTP Client for AHM7 x MAKKI Integration
// Features: SSRF Defense, Circuit Breaker, Exponential Backoff, Magic Byte Validation

const net = require("node:net");
const dns = require("node:dns").promises;
const axios = require("axios");
const config = require("./config.cjs");
const health = require("./health.cjs");
const { validateMediaBuffer } = require("./media.cjs");
const {
  Ahm7Error,
  Ahm7TimeoutError,
  Ahm7RateLimitError,
  Ahm7UpstreamError,
  Ahm7ValidationError,
  Ahm7SsrfError,
  Ahm7CircuitBreakerError,
} = require("./errors.cjs");
const logger = require("../../../utils/logger.cjs");

/**
 * Checks if an IPv4 or IPv6 address belongs to private/loopback/link-local/metadata ranges.
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // Broadcast
    if (ip === "255.255.255.255") return true;
    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    // Unique local address fc00::/7
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local address fe80::/10
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    // IPv4-mapped IPv6
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.replace("::ffff:", "");
      return isPrivateIp(v4);
    }
  }

  return false;
}

/**
 * SSRF Guard: Validates that a user-provided target URL is a safe public HTTP/HTTPS endpoint.
 */
async function assertSafePublicUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== "string") {
    throw new Ahm7ValidationError("Missing or invalid target URL");
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    throw new Ahm7ValidationError(`Invalid URL syntax: ${targetUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Ahm7SsrfError(`Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, loopbacks, internal domain suffixes
  const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"];
  if (blockedHostnames.includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    throw new Ahm7SsrfError(`Target host ${hostname} is blocked by SSRF policy`);
  }

  // If already an IP address, check directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Ahm7SsrfError(`Target IP ${hostname} is in a reserved private/internal address space`);
    }
  } else {
    // Resolve DNS and verify all addresses
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const rec of records) {
        if (isPrivateIp(rec.address)) {
          throw new Ahm7SsrfError(`Target host ${hostname} resolves to private IP: ${rec.address}`);
        }
      }
    } catch (err) {
      if (err instanceof Ahm7SsrfError) throw err;
      throw new Ahm7ValidationError(`Could not resolve host ${hostname}: ${err.message}`);
    }
  }

  return parsed.toString();
}

/**
 * Helper to sleep for ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an HTTP request to an AHM7 service with timeout, retry backoff, and circuit breaker.
 */
async function requestAhm7(serviceId, options = {}) {
  const endpointInfo = config.endpoints[serviceId];
  if (!endpointInfo) {
    throw new Ahm7ValidationError(`Unknown AHM7 service ID: ${serviceId}`);
  }

  // 1. Check Circuit Breaker
  if (!health.isAvailable(serviceId)) {
    throw new Ahm7CircuitBreakerError(`Service '${serviceId}' is temporarily paused due to upstream downtime.`);
  }

  const method = (options.method || endpointInfo.method || "GET").toUpperCase();
  const url = `${config.baseUrl}${endpointInfo.path}`;
  const timeoutMs = options.timeout || config.timeouts[options.category || "default"] || config.timeouts.default;
  const isBinary = options.responseType === "arraybuffer";

  const maxRetries = method === "GET" ? config.retry.maxRetries : 0;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const axiosConfig = {
        method,
        url,
        params: options.params || {},
        data: options.data,
        headers: {
          "User-Agent": "YUXLI-WhatsApp-Bot/2.4 (Enterprise Integration Architect)",
          Accept: isBinary ? "*/*" : "application/json, text/plain, */*",
          ...(options.headers || {}),
        },
        responseType: isBinary ? "arraybuffer" : "json",
        signal: controller.signal,
        maxBodyLength: config.limits.maxDownloadBytes,
        maxContentLength: config.limits.maxDownloadBytes,
        validateStatus: () => true, // We inspect status manually
      };

      const response = await axios(axiosConfig);
      clearTimeout(timeoutHandle);

      // Handle 429 Rate Limit
      if (response.status === 429) {
        const retryAfter = Number(response.headers["retry-after"]) * 1000 || config.retry.baseDelayMs * attempt;
        if (attempt <= maxRetries) {
          logger.warn({ serviceId, attempt, retryAfter }, "[AHM7 Client] 429 Rate Limited - backing off");
          await sleep(retryAfter);
          continue;
        }
        const err = new Ahm7RateLimitError(`AHM7 service '${serviceId}' is temporarily rate limited.`, {
          serviceId,
          retryAfterMs: retryAfter,
        });
        health.recordFailure(serviceId, err);
        throw err;
      }

      // Handle Upstream 5xx errors
      if (response.status >= 500) {
        if (attempt <= maxRetries) {
          const delay = config.retry.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          logger.warn({ serviceId, status: response.status, attempt, delay }, "[AHM7 Client] Upstream 5xx - retrying");
          await sleep(delay);
          continue;
        }
        const err = new Ahm7UpstreamError(`Upstream service '${serviceId}' error HTTP ${response.status}`, {
          serviceId,
          statusCode: response.status,
        });
        health.recordFailure(serviceId, err);
        throw err;
      }

      // Handle Client 4xx errors
      if (response.status >= 400) {
        let msg = `Request to '${serviceId}' failed with HTTP ${response.status}`;
        if (response.data) {
          if (Buffer.isBuffer(response.data)) {
            msg += `: ${response.data.subarray(0, 150).toString("utf8")}`;
          } else if (typeof response.data === "object") {
            msg += `: ${response.data.message || response.data.error || JSON.stringify(response.data)}`;
          }
        }
        const err = new Ahm7ValidationError(msg, { serviceId, statusCode: response.status });
        // Client errors (400, 404, 405) don't necessarily trip the circuit breaker for all users
        throw err;
      }

      // Successful HTTP status (200, 201)
      health.recordSuccess(serviceId);

      // If binary, validate magic bytes
      if (isBinary) {
        const buffer = Buffer.from(response.data);
        if (options.expectedFormat) {
          validateMediaBuffer(buffer, options.expectedFormat);
        }
        return {
          buffer,
          contentType: response.headers["content-type"],
          status: response.status,
        };
      }

      return response.data;
    } catch (err) {
      clearTimeout(timeoutHandle);

      if (axios.isCancel(err) || err.name === "AbortError" || err.code === "ECONNABORTED") {
        lastError = new Ahm7TimeoutError(`AHM7 service '${serviceId}' timed out after ${timeoutMs}ms`, { serviceId });
      } else if (err instanceof Ahm7Error) {
        lastError = err;
      } else {
        lastError = new Ahm7UpstreamError(`Network failure contacting AHM7 '${serviceId}': ${err.message}`, {
          serviceId,
          cause: err,
        });
      }

      if (attempt <= maxRetries && !(lastError instanceof Ahm7ValidationError) && !(lastError instanceof Ahm7SsrfError)) {
        const delay = config.retry.baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }

      health.recordFailure(serviceId, lastError);
      throw lastError;
    }
  }

  throw lastError;
}

module.exports = {
  requestAhm7,
  assertSafePublicUrl,
  isPrivateIp,
};
