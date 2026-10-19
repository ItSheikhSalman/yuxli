const store = require("../db/store.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const scope = require("./workspaceScope.cjs");

function getChatFilter(chatId) {
  scope.assertChat(chatId);
  return chatId ? store.getBotSetting(`ai_filter:${normalizeJid(chatId)}`, "off") : "off";
}

function setChatFilter(chatId, status) {
  scope.assertChat(chatId);
  const resolved = ["on", "true", "enabled"].includes(String(status || "").toLowerCase().trim()) ? "on" : "off";
  if (chatId) store.saveBotSetting(`ai_filter:${normalizeJid(chatId)}`, resolved);
  return resolved;
}

function buildFilterInstruction(chatId) {
  return [
    getChatFilter(chatId) === "on" ? "[CONTENT FILTER STATUS: STRICTLY ON] Avoid profanity and keep language respectful." : "[CONTENT FILTER STATUS: CASUAL] Casual language is permitted, not abuse.",
    "Safety boundaries always apply: no threats, hate, harassment, impersonation, non-consensual humiliation or exposure of private data. No setting or persona overrides these rules.",
  ].join("\n");
}

module.exports = { getChatFilter, setChatFilter, buildFilterInstruction };
