const { randomUUID } = require("node:crypto");
const repository = require("./repository.cjs");
const privacy = require("./privacy.cjs");
const profiler = require("./profiler.cjs");
const conversation = require("./conversation.cjs");
const engine = require("./engine.cjs");
const delivery = require("./delivery.cjs");
const { socketScope } = require("./runtime.cjs");
const { resolveCaller, authorize } = require("../aiToolAuth.cjs");
const normalizeJid = require("../../utils/normalizeJid.cjs");

function configured(socket, chatId) {
  const scope = socketScope(socket);
  return Boolean(
    scope && repository.get(scope.workspaceId, "group", privacy.groupId(normalizeJid(chatId))),
  );
}

function optedOut(socket, message) {
  const scope = socketScope(socket);
  if (!scope) return false;
  return privacy.messageOptedOut(scope.workspaceId, socket, message);
}

function stats(workspaceId, chatId) {
  return repository
    .q(
      "SELECT action, sum(count) AS count FROM ai_adaptive_metrics WHERE workspace_id=? AND chat_id=? GROUP BY action",
    )
    .all(workspaceId, chatId);
}

function recordDecision(workspaceId, chatId, action) {
  repository
    .q(
      "INSERT INTO ai_adaptive_metrics VALUES (?, ?, ?, ?, 1) ON CONFLICT(workspace_id,chat_id,day,action) DO UPDATE SET count=count+1",
    )
    .run(workspaceId, chatId, new Date().toISOString().slice(0, 10), action);
  repository
    .q("DELETE FROM ai_adaptive_metrics WHERE workspace_id=? AND day<?")
    .run(workspaceId, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
}

function claim(input) {
  const config = repository.deployment(input.workspaceId);
  return repository.transaction(() => {
    const existing = repository
      .q("SELECT action FROM ai_reply_receipts WHERE workspace_id=? AND chat_id=? AND message_id=?")
      .get(input.workspaceId, input.chatId, input.messageId);
    if (existing) return { duplicate: true };
    const now = Date.now();
    const rows = repository
      .q(
        "SELECT user_id,created_at FROM ai_reply_receipts WHERE workspace_id=? AND chat_id=? AND created_at>? AND action NOT IN ('observed','NO_ACTION')",
      )
      .all(input.workspaceId, input.chatId, now - 60000);
    const userRows = repository
      .q(
        "SELECT created_at FROM ai_reply_receipts WHERE workspace_id=? AND user_id=? AND created_at>? AND action NOT IN ('observed','NO_ACTION')",
      )
      .all(input.workspaceId, input.userId, now - 60000);
    const recent = userRows.some((row) => now - row.created_at < config.cooldownSeconds * 1000);
    repository
      .q(
        "INSERT INTO ai_reply_receipts(workspace_id,chat_id,message_id,user_id,created_at,action) VALUES (?, ?, ?, ?, ?, 'observed')",
      )
      .run(input.workspaceId, input.chatId, input.messageId, input.userId, now);
    return {
      duplicate: false,
      rateLimited:
        recent || userRows.length >= config.perUserMinute || rows.length >= config.perGroupMinute,
    };
  });
}

async function handle({
  socket,
  message,
  text,
  explicitCommand = false,
  groupMetadata = null,
  generator = null,
}) {
  const scope = socketScope(socket);
  const chatId = normalizeJid(message?.key?.remoteJid);
  if (!scope || !chatId || !configured(socket, chatId)) return false;
  if (!privacy.group(scope.workspaceId, chatId).enabled) return true;
  if (message.key.fromMe) return true;
  if (optedOut(socket, message)) return true;
  const caller = await resolveCaller({ msg: message, sock: socket, groupMetadata, text });
  const access = authorize({ command: "gemini" }, caller);
  const contextInfo =
    message.message?.extendedTextMessage?.contextInfo ||
    message.message?.imageMessage?.contextInfo ||
    {};
  const botIds = [socket.user?.id, socket.user?.lid].filter(Boolean).map(normalizeJid);
  const mentions = (contextInfo.mentionedJid || []).map(normalizeJid);
  const state = conversation.read(scope.workspaceId, chatId);
  const input = {
    workspaceId: scope.workspaceId,
    chatId,
    userId: caller.senderId,
    text: String(text || ""),
    messageId: message.key.id || randomUUID(),
    isGroup: caller.isGroup,
    caller,
    allowed: access.allowed,
    mentioned: mentions.some((jid) => botIds.includes(jid)),
    explicitCommand,
    replyToBot: Boolean(
      contextInfo.stanzaId &&
        (contextInfo.stanzaId === state.lastBotMessageId ||
          state.botThreads?.some((thread) => thread.messageId === contextInfo.stanzaId)) &&
        botIds.includes(normalizeJid(contextInfo.participant || "")),
    ),
    replyToId: contextInfo.stanzaId || null,
    targets: mentions.filter((jid) => !botIds.includes(jid)),
    supportsReactions: socket.supportsReactions !== false,
    handoffActive: Boolean(
      repository.get(
        scope.workspaceId,
        "feedback",
        `handoff_${privacy.groupId(`${chatId}:${caller.senderId}`)}`,
      )?.active,
    ),
  };
  const admission = claim(input);
  if (admission.duplicate) return true;
  const prepared = engine.prepare({ ...input, ...admission });
  if (access.allowed) {
    profiler.observe({ ...input, replyTo: input.replyToId });
    conversation.observe(input, prepared.signals);
  }
  const action = prepared.decision.action;
  repository
    .q("UPDATE ai_reply_receipts SET action=? WHERE workspace_id=? AND chat_id=? AND message_id=?")
    .run(action, input.workspaceId, chatId, input.messageId);
  recordDecision(input.workspaceId, chatId, action);
  if (action === "NO_ACTION") return true;
  if (prepared.decision.reason === "human-request") {
    const handoffId = `handoff_${privacy.groupId(`${chatId}:${input.userId}`)}`;
    const oldHandoff = repository.get(input.workspaceId, "feedback", handoffId);
    repository.put(
      input.workspaceId,
      "feedback",
      { category: "handoff", active: true, chatId, userId: input.userId },
      input.userId,
      { id: handoffId, revision: oldHandoff?.revision },
    );
  }
  const response =
    action === "REACT_ONLY" ? null : await engine.generate(input, prepared, { generator });
  const result = await delivery.send({
    socket,
    ...input,
    message,
    text: response?.text,
    reaction: prepared.decision.reaction,
  });
  if (result)
    conversation.recordAction(
      input.workspaceId,
      chatId,
      input.messageId,
      action,
      Date.now(),
      result.key,
      input.userId,
      privacy.mayLearn(input.workspaceId, chatId, input.userId) && !prepared.signals.sensitive
        ? `${input.text.slice(0, 180)}\n${response?.text?.slice(0, 300) || ""}`
        : null,
    );
  return true;
}

function observeReaction(socket, message) {
  const scope = socketScope(socket);
  if (!scope || message.key?.fromMe) return;
  if (optedOut(socket, message)) return;
  const chatId = normalizeJid(message.key?.remoteJid);
  const userId = normalizeJid(message.key?.participant || message.key?.remoteJid);
  if (!chatId || !userId || !privacy.mayLearn(scope.workspaceId, chatId, userId)) return;
  const input = {
    workspaceId: scope.workspaceId,
    chatId,
    userId,
    messageId: message.key.id || randomUUID(),
  };
  if (!claim(input).duplicate) profiler.observe({ ...input, reaction: true });
}

async function privacyCommand(socket, message, text) {
  const prefix = require("../../config/runtime-config.cjs").getPrefix();
  const normalized = String(text).trim().toLowerCase();
  if (
    !normalized.startsWith(`${prefix}aiprivacy`) &&
    !["stop ai", "stop yuxli"].includes(normalized)
  )
    return false;
  const scope = socketScope(socket);
  if (!scope || message.key?.fromMe) return false;
  const chatId = normalizeJid(message.key.remoteJid);
  const caller = await resolveCaller({ msg: message, sock: socket, text });
  const userId = caller.senderId;
  const messageId = `privacy:${message.key.id || randomUUID()}`;
  const admission = claim({
    workspaceId: scope.workspaceId,
    chatId,
    userId,
    messageId,
  });
  if (admission.duplicate) return true;
  const reply = async (content) => {
    if (admission.rateLimited) return null;
    repository
      .q(
        "UPDATE ai_reply_receipts SET action='CONTROL' WHERE workspace_id=? AND chat_id=? AND message_id=?",
      )
      .run(scope.workspaceId, chatId, messageId);
    return delivery.send({
      socket,
      workspaceId: scope.workspaceId,
      chatId,
      userId,
      message,
      text: content,
      control: true,
    });
  };
  const operation = normalized.startsWith("stop ")
    ? "stop"
    : normalized.slice(`${prefix}aiprivacy`.length).trim();
  const known = [
    "stop",
    "start",
    "notice",
    "learn on",
    "learn off",
    "memory on",
    "memory off",
    "roast on",
    "roast off",
    "erase",
    "status",
  ];
  if (!known.includes(operation)) {
    await reply(`${privacy.NOTICE}\nCommands: ${known.join(", ")}`);
    return true;
  }
  if (operation === "notice" || operation === "status") {
    await reply(
      `${privacy.NOTICE}\nYour controls: ${JSON.stringify(privacy.consent(scope.workspaceId, chatId, userId))}`,
    );
    return true;
  }
  let patch = {};
  if (operation === "stop" || operation === "erase") patch = { optedOut: true };
  else if (operation === "start") patch = { optedOut: false };
  else {
    const [key, state] = operation.split(" ");
    const field = key === "learn" ? "learning" : key;
    if (
      state === "on" &&
      privacy.consent(scope.workspaceId, chatId, userId).noticeVersion !== privacy.NOTICE_VERSION
    ) {
      const delivered = await reply(
        `${privacy.NOTICE}\nRead this notice, then repeat your opt-in command to confirm.`,
      );
      if (delivered)
        privacy.setMessageConsent(scope.workspaceId, socket, message, {
          noticeVersion: privacy.NOTICE_VERSION,
        });
      return true;
    }
    patch = { [field]: state === "on" };
  }
  privacy.setMessageConsent(scope.workspaceId, socket, message, patch);
  if (operation === "erase") {
    for (const identity of privacy.messageIdentities(socket, message).userIds)
      repository
        .q("DELETE FROM ai_approved_memories WHERE workspace_id=? AND owner_id=?")
        .run(scope.workspaceId, identity);
  }
  await reply(
    "YUXLI AI privacy preferences updated. Opting out stops adaptive replies and learning; existing non-AI commands remain available.",
  );
  return true;
}

async function memoryCommand(socket, message, text) {
  const prefix = require("../../config/runtime-config.cjs").getPrefix();
  const command = `${prefix}aimemory`;
  if (text !== command && !text.startsWith(`${command} `)) return false;
  const scope = socketScope(socket);
  if (!scope || message.key?.fromMe) return false;
  const caller = await resolveCaller({ msg: message, sock: socket, text });
  const chatId = normalizeJid(message.key.remoteJid);
  const input = { workspaceId: scope.workspaceId, chatId, userId: caller.senderId };
  const messageId = `memory:${message.key.id || randomUUID()}`;
  const admission = claim({ ...input, messageId });
  if (admission.duplicate) return true;
  const reply = async (content) => {
    if (admission.rateLimited) return null;
    repository
      .q(
        "UPDATE ai_reply_receipts SET action='CONTROL' WHERE workspace_id=? AND chat_id=? AND message_id=?",
      )
      .run(input.workspaceId, chatId, messageId);
    return delivery.send({ socket, ...input, message, text: content, control: true });
  };
  if (caller.isGroup) {
    await reply("Manage personal memories in a direct message to YUXLI, never in a group.");
    return true;
  }
  const memoryService = require("./memory.cjs");
  const [action, ...args] = text.slice(command.length).trim().split(/\s+/);
  try {
    if (action === "list" || action === "export") {
      const rows = memoryService
        .list(input.workspaceId, input.userId)
        .filter((item) => item.scope === "user");
      await reply(JSON.stringify(rows, null, action === "export" ? 2 : 0).slice(0, 10000));
    } else if (action === "add") {
      const saved = memoryService.save(input.workspaceId, input.userId, {
        chatId,
        content: args.join(" "),
        confirmed: true,
      });
      await reply(
        `Saved approved memory ${saved.id}. Use ${command} delete ${saved.id} to remove it.`,
      );
    } else if (action === "delete") {
      await reply(
        memoryService.remove(input.workspaceId, args[0] || "", input.userId)
          ? "Memory deleted."
          : "Memory not found.",
      );
    } else if (action === "correct") {
      const old = memoryService
        .list(input.workspaceId, input.userId)
        .find((item) => item.id === args[0] && item.scope === "user");
      if (!old) throw repository.error("Memory not found", 404);
      const saved = repository.transaction(() => {
        const updated = memoryService.save(input.workspaceId, input.userId, {
          chatId,
          content: args.slice(1).join(" "),
          confirmed: true,
        });
        if (updated.id !== old.id) memoryService.remove(input.workspaceId, old.id, input.userId);
        return updated;
      });
      await reply(`Corrected approved memory ${saved.id}.`);
    } else
      await reply(
        `Personal memory controls: ${command} list | export | add <fact> | correct <id> <fact> | delete <id>. Opt in first with ${prefix}aiprivacy memory on.`,
      );
  } catch (cause) {
    await reply(cause.statusCode ? cause.message : "Memory request failed.");
  }
  return true;
}

module.exports = {
  configured,
  optedOut,
  handle,
  observeReaction,
  privacyCommand,
  memoryCommand,
  stats,
  claim,
};
