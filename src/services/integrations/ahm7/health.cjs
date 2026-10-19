// file: src/services/integrations/ahm7/health.cjs
//
// In-memory circuit breaker and availability tracking for AHM7 services.
// Protects the WhatsApp engine from lagging on failing upstream endpoints.

const config = require("./config.cjs");
const logger = require("../../../utils/logger.cjs");

const healthState = new Map();

function initService(serviceId) {
  if (!healthState.has(serviceId)) {
    healthState.set(serviceId, {
      serviceId,
      status: "healthy", // "healthy" | "degraded" | "unhealthy"
      consecutiveFailures: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      cooldownUntil: 0,
    });
  }
  return healthState.get(serviceId);
}

function recordSuccess(serviceId) {
  const state = initService(serviceId);
  state.consecutiveFailures = 0;
  state.totalSuccesses += 1;
  state.lastSuccessAt = Date.now();
  state.status = "healthy";
  state.cooldownUntil = 0;
}

function recordFailure(serviceId, error) {
  const state = initService(serviceId);
  state.consecutiveFailures += 1;
  state.totalFailures += 1;
  state.lastFailureAt = Date.now();
  state.lastError = error ? (error.message || String(error)) : "Unknown error";

  const threshold = config.circuitBreaker.failureThreshold || 3;
  if (state.consecutiveFailures >= threshold) {
    state.status = "unhealthy";
    state.cooldownUntil = Date.now() + (config.circuitBreaker.cooldownPeriodMs || 60_000);
    logger.warn(
      { serviceId, consecutiveFailures: state.consecutiveFailures, cooldownMs: config.circuitBreaker.cooldownPeriodMs },
      "[AHM7 Circuit Breaker] Service tripped into cooldown",
    );
  } else if (state.consecutiveFailures >= 1) {
    state.status = "degraded";
  }
}

function isAvailable(serviceId) {
  const state = initService(serviceId);
  const now = Date.now();

  // If in cooldown, check if cooldown expired
  if (state.cooldownUntil > 0) {
    if (now < state.cooldownUntil) {
      return false; // Still cooling off
    }
    // Half-open: allow one probe request
    state.status = "degraded";
  }

  return true;
}

function getHealth(serviceId) {
  const state = initService(serviceId);
  return { ...state };
}

function getAllHealth() {
  const out = {};
  for (const [id, state] of healthState.entries()) {
    out[id] = { ...state };
  }
  return out;
}

function resetHealth(serviceId) {
  if (serviceId) {
    healthState.delete(serviceId);
  } else {
    healthState.clear();
  }
}

module.exports = {
  recordSuccess,
  recordFailure,
  isAvailable,
  getHealth,
  getAllHealth,
  resetHealth,
};
