const { createHash } = require("node:crypto");
const repository = require("./repository.cjs");
const { quietHours } = require("./personas.cjs");

const NOTICE_VERSION = "2026-10-18.1";
const NOTICE =
  "YUXLI is an AI assistant. Requests may be sent to the configured AI provider. Group style learning is optional and uses aggregate statistics only from participants who opt in. No complete chat history is imported automatically. Use !aiprivacy stop, learn off, memory off, roast off, or erase at any time. Provider retention is governed separately by your operator's provider agreement.";
const MODES = [
  "mention-only",
  "smart",
  "assistant",
  "reaction-preferred",
  "silent-observer",
  "custom",
];
const groupId = (chatId) => createHash("sha256").update(chatId).digest("hex");

function group(workspaceId, chatId) {
  const stored = repository.get(workspaceId, "group", groupId(chatId));
  return {
    chatId,
    enabled: false,
    mode: "mention-only",
    learning: false,
    noticeVersion: null,
    adminConfirmed: false,
    proactive: false,
    retentionDays: 7,
    quietHours: null,
    reactionEnabled: true,
    humor: false,
    ...stored,
  };
}

function saveGroup(workspaceId, input, actorId) {
  const chatId = input.chatId;
  if (
    typeof chatId !== "string" ||
    !/^[a-zA-Z0-9_:+.-]+@(g\.us|s\.whatsapp\.net|lid)$/.test(chatId) ||
    chatId.length > 150
  )
    throw repository.error("Invalid chat ID");
  if (!MODES.includes(input.mode)) throw repository.error("Invalid adaptive mode");
  const limit = repository.limits(workspaceId).retentionDays;
  if (
    !Number.isInteger(input.retentionDays) ||
    input.retentionDays < 1 ||
    input.retentionDays > Math.max(1, limit)
  )
    throw repository.error("Retention exceeds plan limit");
  if (input.enabled && (input.noticeVersion !== NOTICE_VERSION || input.adminConfirmed !== true))
    throw repository.error(
      "Confirm administration permission and participant notice before enabling",
    );
  const old = repository.get(workspaceId, "group", groupId(chatId));
  const saved = repository.put(
    workspaceId,
    "group",
    {
      chatId,
      enabled: input.enabled === true,
      mode: input.mode,
      learning: input.learning === true,
      noticeVersion: input.noticeVersion === NOTICE_VERSION ? NOTICE_VERSION : null,
      adminConfirmed: input.adminConfirmed === true,
      proactive: input.proactive === true && input.mode === "smart",
      retentionDays: input.retentionDays,
      quietHours: quietHours(input.quietHours),
      reactionEnabled: input.reactionEnabled !== false,
      humor: input.humor === true,
    },
    actorId,
    { id: groupId(chatId), revision: input.revision },
  );
  if (old && (!saved.learning || !saved.enabled || saved.retentionDays < old.retentionDays))
    clearProfile(workspaceId, chatId, actorId);
  return saved;
}

function consent(workspaceId, chatId, userId) {
  repository.workspace(workspaceId);
  const row = repository
    .q("SELECT body FROM ai_participant_consent WHERE workspace_id=? AND chat_id=? AND user_id=?")
    .get(workspaceId, chatId, userId);
  return {
    optedOut: false,
    learning: false,
    memory: false,
    roast: false,
    noticeVersion: null,
    ...repository.parseJson(row?.body, {}),
  };
}

function messageIdentities(socket, message) {
  const { getSenderCandidates } = require("../../utils/permissions.esm.js");
  const normalizeJid = require("../../utils/normalizeJid.cjs");
  const chatId = normalizeJid(message.key?.remoteJid);
  const userIds = getSenderCandidates(message, socket);
  return {
    userIds,
    chatIds: chatId?.endsWith("@g.us")
      ? [chatId]
      : [...new Set([chatId, ...userIds].filter(Boolean))],
  };
}

function messageOptedOut(workspaceId, socket, message) {
  const { userIds, chatIds } = messageIdentities(socket, message);
  return chatIds.some((chatId) =>
    userIds.some((userId) => consent(workspaceId, chatId, userId).optedOut),
  );
}

function setMessageConsent(workspaceId, socket, message, patch) {
  const { userIds, chatIds } = messageIdentities(socket, message);
  for (const chatId of chatIds)
    for (const userId of userIds) setConsent(workspaceId, chatId, userId, patch);
}

function setConsent(workspaceId, chatId, userId, input) {
  repository.workspace(workspaceId);
  if (!chatId || !userId) throw repository.error("Participant identity required");
  const old = consent(workspaceId, chatId, userId);
  const body = { ...old };
  for (const key of ["optedOut", "learning", "memory", "roast"]) {
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean") throw repository.error("Invalid consent value");
      body[key] = input[key];
    }
  }
  if (input.noticeVersion === NOTICE_VERSION) body.noticeVersion = NOTICE_VERSION;
  if (Object.hasOwn(input, "roast")) body.roastOptOut = !input.roast;
  if ((body.learning || body.memory) && body.noticeVersion !== NOTICE_VERSION)
    throw repository.error("Review privacy notice before opting in");
  if (body.optedOut) Object.assign(body, { learning: false, memory: false, roast: false });
  repository
    .q(
      "INSERT INTO ai_participant_consent VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace_id, chat_id, user_id) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at",
    )
    .run(workspaceId, chatId, userId, JSON.stringify(body), Date.now());
  if (body.optedOut || (old.learning && !body.learning)) clearProfile(workspaceId, chatId, userId);
  if (body.optedOut || (old.memory && !body.memory)) {
    repository
      .q("DELETE FROM ai_approved_memories WHERE workspace_id=? AND owner_id=? AND scope='user'")
      .run(workspaceId, userId);
    repository
      .q("DELETE FROM ai_conversation_state WHERE workspace_id=? AND session_id=?")
      .run(workspaceId, `personal:${chatId}:${userId}`);
  }
  repository.audit(workspaceId, userId, "consent-change", groupId(chatId));
  return body;
}

function clearProfile(workspaceId, chatId, actorId) {
  repository.workspace(workspaceId);
  repository
    .q("DELETE FROM ai_style_buckets WHERE workspace_id=? AND chat_id=?")
    .run(workspaceId, chatId);
  repository
    .q("DELETE FROM ai_conversation_state WHERE workspace_id=? AND session_id=?")
    .run(workspaceId, `group:${chatId}`);
  repository.audit(workspaceId, actorId, "profile-reset", groupId(chatId));
}

function mayLearn(workspaceId, chatId, userId) {
  const settings = group(workspaceId, chatId);
  const participant = consent(workspaceId, chatId, userId);
  return (
    settings.enabled &&
    settings.learning &&
    settings.adminConfirmed &&
    settings.noticeVersion === NOTICE_VERSION &&
    participant.learning &&
    !participant.optedOut &&
    participant.noticeVersion === NOTICE_VERSION
  );
}

module.exports = {
  NOTICE_VERSION,
  NOTICE,
  MODES,
  groupId,
  group,
  saveGroup,
  consent,
  messageIdentities,
  messageOptedOut,
  setMessageConsent,
  setConsent,
  clearProfile,
  mayLearn,
};
