// Bot Access Control & Scope Management
// Allows the bot to run in:
// - "public" : Works in all chats and groups (default)
// - "self" / "onlyme" : Works ONLY for the bot owner (completely ignores other people)
// - "groups" / "specific" : Works only in authorized / whitelisted groups (+ owner DMs)
// - "dm_only" : Works only in private 1-on-1 DMs (ignores groups)

const store = require("../db/store.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const { isOwnerJidSync } = require("../utils/permissions.cjs");
const logger = require("../utils/logger.cjs");

const ACCESS_MODES = {
  public: {
    id: "public",
    label: "Public (All Chats & Groups)",
    emoji: "🌍",
    desc: "Bot responds in all groups and private chats to everyone.",
  },
  self: {
    id: "self",
    aliases: ["onlyme", "owner", "private_me"],
    label: "Only Me / Self (Owner Only)",
    emoji: "🔒",
    desc: "Bot responds ONLY to the owner. All other users and groups are completely ignored.",
  },
  whitelist: {
    id: "whitelist",
    aliases: ["custom", "strict_whitelist", "allowed_only"],
    label: "Whitelist Only (Specific Groups & DMs)",
    emoji: "🎯",
    desc: "Bot responds ONLY in authorized groups AND authorized private DMs. All others are ignored.",
  },
  groups: {
    id: "groups",
    aliases: ["specific", "allowed_groups"],
    label: "Specific Groups Only",
    emoji: "👥",
    desc: "Bot responds only in specifically allowed / whitelisted groups (and owner DMs).",
  },
  dm_only: {
    id: "dm_only",
    aliases: ["dm", "pms_only", "no_groups"],
    label: "DMs Only (No Groups)",
    emoji: "💬",
    desc: "Bot responds only in 1-on-1 private DMs, ignoring all groups.",
  },
};

const MODE_ALIASES = {
  public: "public",
  all: "public",
  عام: "public",
  "الكل": "public",
  "سب": "public",

  self: "self",
  onlyme: "self",
  owner: "self",
  "me": "self",
  "خاص_بي": "self",
  "صرف_میں": "self",

  whitelist: "whitelist",
  custom: "whitelist",
  "وائٹ_لسٹ": "whitelist",

  groups: "groups",
  specific: "groups",
  group: "groups",
  allowed: "groups",
  "مجموعات_محددة": "groups",
  "مخصوص_گروپس": "groups",

  dm_only: "dm_only",
  dm: "dm_only",
  private: "dm_only",
  pms: "dm_only",
  "خاص": "dm_only",
};

function normalizeAccessMode(modeStr) {
  if (!modeStr) return null;
  const clean = String(modeStr).trim().toLowerCase();
  return MODE_ALIASES[clean] || null;
}

function getAccessMode() {
  const mode = store.getBotSetting("bot_access_mode", "public");
  return ACCESS_MODES[mode] ? mode : "public";
}

function setAccessMode(mode) {
  const resolved = normalizeAccessMode(mode) || "public";
  store.saveBotSetting("bot_access_mode", resolved);
  logger.info(`[BotAccess] Mode changed to: ${resolved}`);
  return resolved;
}

/**
 * Returns array of allowed group objects: [{ id, subject, addedAt }]
 */
function getAllowedGroups() {
  const groups = store.getBotSetting("bot_allowed_groups", []);
  return Array.isArray(groups) ? groups : [];
}

function saveAllowedGroups(groupsList) {
  store.saveBotSetting("bot_allowed_groups", groupsList);
}

function isGroupAllowed(rawGroupId) {
  if (!rawGroupId) return false;
  const normalized = normalizeJid(rawGroupId);
  const list = getAllowedGroups();
  return list.some((g) => normalizeJid(typeof g === "string" ? g : g.id) === normalized);
}

function addAllowedGroup(rawGroupId, subject = null) {
  const normalized = normalizeJid(rawGroupId);
  const list = getAllowedGroups();
  const existingIndex = list.findIndex((g) => normalizeJid(typeof g === "string" ? g : g.id) === normalized);

  if (existingIndex !== -1) {
    if (subject && typeof list[existingIndex] === "object") {
      list[existingIndex].subject = subject;
      saveAllowedGroups(list);
    }
    return false; // already present
  }

  list.push({
    id: normalized,
    subject: subject || null,
    addedAt: Date.now(),
  });
  saveAllowedGroups(list);
  logger.info({ group: normalized, subject }, "[BotAccess] Group whitelisted");
  return true;
}

function removeAllowedGroup(rawGroupId) {
  const normalized = normalizeJid(rawGroupId);
  const list = getAllowedGroups();
  const filtered = list.filter((g) => normalizeJid(typeof g === "string" ? g : g.id) !== normalized);

  if (filtered.length === list.length) {
    return false; // was not in list
  }

  saveAllowedGroups(filtered);
  logger.info({ group: normalized }, "[BotAccess] Group removed from whitelist");
  return true;
}

/**
 * Returns array of allowed DM objects: [{ id, name, addedAt }]
 */
function getAllowedDms() {
  const dms = store.getBotSetting("bot_allowed_dms", []);
  return Array.isArray(dms) ? dms : [];
}

function saveAllowedDms(dmsList) {
  store.saveBotSetting("bot_allowed_dms", dmsList);
}

function isDmAllowed(rawJid) {
  if (!rawJid) return false;
  const normalized = normalizeJid(rawJid);
  const list = getAllowedDms();
  return list.some((d) => normalizeJid(typeof d === "string" ? d : d.id) === normalized);
}

function addAllowedDm(rawJid, name = null) {
  let normalized = normalizeJid(rawJid);
  if (!normalized.includes("@")) {
    normalized = `${normalized.replace(/\D/g, "")}@s.whatsapp.net`;
  }
  const list = getAllowedDms();
  const existingIndex = list.findIndex((d) => normalizeJid(typeof d === "string" ? d : d.id) === normalized);

  if (existingIndex !== -1) {
    if (name && typeof list[existingIndex] === "object") {
      list[existingIndex].name = name;
      saveAllowedDms(list);
    }
    return false;
  }

  list.push({
    id: normalized,
    name: name || null,
    addedAt: Date.now(),
  });
  saveAllowedDms(list);
  logger.info({ dm: normalized, name }, "[BotAccess] DM whitelisted");
  return true;
}

function removeAllowedDm(rawJid) {
  let normalized = normalizeJid(rawJid);
  if (!normalized.includes("@")) {
    normalized = `${normalized.replace(/\D/g, "")}@s.whatsapp.net`;
  }
  const list = getAllowedDms();
  const filtered = list.filter((d) => normalizeJid(typeof d === "string" ? d : d.id) !== normalized);

  if (filtered.length === list.length) {
    return false;
  }

  saveAllowedDms(filtered);
  logger.info({ dm: normalized }, "[BotAccess] DM removed from whitelist");
  return true;
}

/**
 * Checks whether an incoming message is allowed to be processed.
 * The bot owner is ALWAYS allowed everywhere so they never get locked out.
 */
function isMessageAllowed(sock, msg, isGroup) {
  // fromMe messages (sent by the bot's own WhatsApp account) are always allowed
  if (msg?.key?.fromMe) return true;

  const senderId = normalizeJid(isGroup ? msg.key.participant : msg.key.remoteJid);
  const isOwner = Boolean(senderId && isOwnerJidSync(senderId));

  // The bot owner is always allowed to run commands and interact anywhere!
  if (isOwner) return true;

  const mode = getAccessMode();

  // 1. "Only Me" (Self mode): Only owner is allowed
  if (mode === "self") {
    return false;
  }

  // 2. "DM Only" mode: Groups are ignored
  if (mode === "dm_only") {
    if (isGroup) return false;
    return true;
  }

  // 3. "Specific Groups" mode:
  if (mode === "groups") {
    if (isGroup) {
      const groupId = normalizeJid(msg.key.remoteJid);
      return isGroupAllowed(groupId);
    }
    return true;
  }

  // 4. "Whitelist" mode: Both groups AND DMs must be specifically authorized
  if (mode === "whitelist" || mode === "custom") {
    if (isGroup) {
      const groupId = normalizeJid(msg.key.remoteJid);
      return isGroupAllowed(groupId);
    } else {
      const rawChatId = normalizeJid(msg.key.remoteJid);
      return isDmAllowed(rawChatId) || (senderId && isDmAllowed(senderId));
    }
  }

  // 5. "Public" mode: Always allowed
  return true;
}

module.exports = {
  ACCESS_MODES,
  MODE_ALIASES,
  normalizeAccessMode,
  getAccessMode,
  setAccessMode,
  getAllowedGroups,
  isGroupAllowed,
  addAllowedGroup,
  removeAllowedGroup,
  getAllowedDms,
  isDmAllowed,
  addAllowedDm,
  removeAllowedDm,
  isMessageAllowed,
};
