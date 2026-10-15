// Multi-Key Rotation and Auto-Failover Cascade Engine for AI Providers
// Automatically rotates keys on 429 / quota limit, cascades across providers,
// and falls back to 100% Free models so the bot never errors out.

const settings = require("../config/settings.cjs");
const logger = require("../utils/logger.cjs");

const keyIndexes = new Map(); // providerId -> current index

function parseKeys(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return [];
  return rawKey
    .split(/[\r\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function getActiveKey(providerId) {
  const settingMap = {
    gemini: "gemini_api_key",
    groq: "groq_api_key",
    openai: "openai_api_key",
    anthropic: "anthropic_api_key",
  };
  const settingKey = settingMap[providerId];
  if (!settingKey) return "";
  const raw = settings.get(settingKey) || "";
  const keys = parseKeys(raw);
  if (!keys.length) return "";
  const idx = (keyIndexes.get(providerId) || 0) % keys.length;
  return keys[idx];
}

function getAllKeys(providerId) {
  const settingMap = {
    gemini: "gemini_api_key",
    groq: "groq_api_key",
    openai: "openai_api_key",
    anthropic: "anthropic_api_key",
  };
  const settingKey = settingMap[providerId];
  if (!settingKey) return [];
  return parseKeys(settings.get(settingKey) || "");
}

function rotateKey(providerId) {
  const keys = getAllKeys(providerId);
  if (keys.length <= 1) return false;
  const current = keyIndexes.get(providerId) || 0;
  const next = (current + 1) % keys.length;
  keyIndexes.set(providerId, next);
  logger.info(
    `[Auto-Rotate] Key for ${providerId} rotated from #${current} to #${next} (${keys.length} keys available)`,
  );
  return true;
}

function resetKeyIndex(providerId) {
  keyIndexes.set(providerId, 0);
}

/**
 * Check if an error indicates rate-limit, token exhaustion, quota depletion, or temporary capacity issue.
 */
function isQuotaOrRateLimitError(err) {
  if (!err) return false;
  const status = Number(
    err.status || err.statusCode || err.code || err.response?.status || err.error?.code || 0,
  );
  if ([429, 402, 503].includes(status)) return true;
  const msg = String(err.message || err.details || err || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exhausted") ||
    msg.includes("too many requests") ||
    msg.includes("tokens per minute") ||
    msg.includes("requests per day") ||
    msg.includes("insufficient_quota") ||
    msg.includes("credit") ||
    msg.includes("overloaded") ||
    msg.includes("capacity") ||
    msg.includes("billing")
  );
}

/**
 * Order of providers to try during failover cascade.
 */
function getFallbackChain(initialProviderId = "gemini") {
  const primary = (initialProviderId || "gemini").toLowerCase();
  const allProviders = ["groq", "gemini", "openai", "anthropic", "flipia", "pollinations"];
  const list = [primary];
  for (const p of allProviders) {
    if (!list.includes(p)) list.push(p);
  }
  return list;
}

const INTERNET_MODELS = {
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (Ultra Fast & Powerful)" },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B Versatile" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Blazing Fast)" },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B (Genius Reasoning)" },
    { id: "deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 Distill Qwen 32B" },
    { id: "qwen-2.5-32b", name: "Qwen 2.5 32B" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (MoE 32k context)" },
    { id: "gemma2-9b-it", name: "Google Gemma 2 9B IT" },
    { id: "llama-3.2-11b-vision-preview", name: "Llama 3.2 11B Vision Preview" },
    { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B Vision Preview" },
    { id: "llama-3.2-3b-preview", name: "Llama 3.2 3B Preview" },
    { id: "llama-3.2-1b-preview", name: "Llama 3.2 1B Preview" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Ultra Fast)" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (High Quota)" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep Multimodal)" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Omni State-of-the-Art)" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Efficient)" },
    { id: "o1", name: "OpenAI o1 (Full Reasoning)" },
    { id: "o3-mini", name: "OpenAI o3-mini (Math & Coding)" },
    { id: "deepseek-chat", name: "DeepSeek V3 Chat" },
    { id: "deepseek-reasoner", name: "DeepSeek R1 Reasoner" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet (Hybrid Reasoning)" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet (Coding & Writing)" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku (Lightning Fast)" },
    { id: "claude-3-opus", name: "Claude 3 Opus" },
  ],
  flipia: [
    { id: "Olmo-3.1-32B-Instruct", name: "Olmo 3.1 32B Instruct (Free / No Key)" },
    { id: "Olmo-3-7B-Instruct", name: "Olmo 3 7B Instruct (Free / Fast)" },
    { id: "molmo2-8b", name: "Molmo2 8B (Free Vision)" },
    { id: "trinity-large-thinking", name: "Trinity Large Thinking (Free Reasoning)" },
    { id: "trinity-mini", name: "Trinity Mini (Free)" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Free Endpoint)" },
    { id: "gpt-5.5", name: "GPT 5.5 (Free Endpoint)" },
    { id: "gpt-5.4", name: "GPT 5.4 (Free Endpoint)" },
  ],
  pollinations: [
    { id: "openai", name: "OpenAI GPT-4o Mini (Pollinations Free)" },
    { id: "mistral", name: "Mistral Large (Pollinations Free)" },
    { id: "llama", name: "Llama 3.3 70B (Pollinations Free)" },
    { id: "deepseek", name: "DeepSeek R1 (Pollinations Free)" },
    { id: "qwen", name: "Qwen 2.5 Coder (Pollinations Free)" },
  ],
};

function getKeyCount(providerId) {
  return getAllKeys(providerId).length;
}

module.exports = {
  parseKeys,
  getActiveKey,
  getAllKeys,
  getKeyCount,
  rotateKey,
  resetKeyIndex,
  isQuotaOrRateLimitError,
  getFallbackChain,
  INTERNET_MODELS,
};
