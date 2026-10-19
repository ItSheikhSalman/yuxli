// Chat Auto-Reply Policy Management
// Controls whether the AI auto-replies in a group/chat:
// - "mention": Only reply when tagged / mentioned / quoted (default for groups)
// - "all": Auto-reply to every message in the chat naturally like a real human member!
// - "off": Disable auto-reply (only reply to explicit commands like !gemini)

const store = require("../db/store.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");

function getChatAutoReply(chatId) {
  require("./workspaceScope.cjs").assertChat(chatId);
  if (!chatId) return "mention";
  const normalized = normalizeJid(chatId);
  return store.getBotSetting(`ai_autoreply:${normalized}`, "mention");
}

function setChatAutoReply(chatId, mode) {
  require("./workspaceScope.cjs").assertChat(chatId);
  if (!chatId) return "mention";
  const normalized = normalizeJid(chatId);
  const clean = String(mode || "").toLowerCase().trim();
  let resolved = "mention";
  if (clean === "all" || clean === "always" || clean === "every" || clean === "true") {
    resolved = "all";
  } else if (clean === "off" || clean === "none" || clean === "disable" || clean === "false") {
    resolved = "off";
  }
  store.saveBotSetting(`ai_autoreply:${normalized}`, resolved);
  return resolved;
}

module.exports = {
  getChatAutoReply,
  setChatAutoReply,
};
