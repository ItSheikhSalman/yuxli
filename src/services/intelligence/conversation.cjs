const repository = require("./repository.cjs");
const privacy = require("./privacy.cjs");

const TTL = 15 * 60 * 1000;
function read(workspaceId, chatId, now = Date.now()) {
  repository.workspace(workspaceId);
  const row = repository
    .q(
      "SELECT body FROM ai_conversation_state WHERE workspace_id=? AND session_id=? AND expires_at>?",
    )
    .get(workspaceId, `group:${chatId}`, now);
  const state = {
    threads: [],
    lastBotAt: 0,
    lastReactionAt: 0,
    ...repository.parseJson(row?.body, {}),
  };
  state.threads = state.threads.filter((thread) => now - thread.at < TTL);
  state.botThreads = (state.botThreads || []).filter((thread) => now - thread.at < TTL);
  if (!state.botThreads.some((thread) => thread.messageId === state.lastBotMessageId))
    state.lastBotMessageId = null;
  return state;
}

function write(workspaceId, chatId, state, now) {
  repository
    .q(
      "INSERT INTO ai_conversation_state VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id,session_id) DO UPDATE SET body=excluded.body, expires_at=excluded.expires_at",
    )
    .run(workspaceId, `group:${chatId}`, JSON.stringify(state), now + TTL);
}

function observe(input, signals, now = Date.now()) {
  if (
    !privacy.mayLearn(input.workspaceId, input.chatId, input.userId) ||
    signals.sensitive ||
    signals.secret
  )
    return;
  const state = read(input.workspaceId, input.chatId, now);
  state.threads = state.threads.filter((thread) => now - thread.at < TTL);
  const parent =
    input.replyToId && state.threads.find((thread) => thread.messageId === input.replyToId);
  if (parent && !signals.question && signals.acknowledgment) parent.resolved = true;
  const uncertainAnswer = /\b(pata nahi|maloom nahi|not sure|no idea|idk|don.t know)\b|لا أعرف|معلوم نہیں/iu.test(input.text || "");
  if (parent && !signals.question && !signals.acknowledgment && !uncertainAnswer) parent.answeredByHuman = true;
  if (signals.question && input.messageId)
    state.threads.push({
      messageId: input.messageId,
      userId: input.userId,
      topic: signals.intent,
      at: now,
      resolved: false,
      answeredByHuman: false,
    });
  state.threads = state.threads.slice(-12);
  state.topic = signals.intent;
  write(input.workspaceId, input.chatId, state, now);
}

function recordAction(
  workspaceId,
  chatId,
  messageId,
  action,
  now = Date.now(),
  replyKey = null,
  userId = null,
  summary = null,
) {
  const state = read(workspaceId, chatId, now);
  if (action === "REACT_ONLY") state.lastReactionAt = now;
  else {
    state.lastBotAt = now;
    state.lastBotMessageId = replyKey?.id || null;
    state.botThreads = (state.botThreads || [])
      .filter((thread) => now - thread.at < TTL)
      .slice(-11);
    if (replyKey?.id)
      state.botThreads.push({
        messageId: replyKey.id,
        userId,
        summary: summary ? String(summary).slice(0, 500) : null,
        at: now,
      });
    const thread = state.threads.find((entry) => entry.messageId === messageId);
    if (thread) thread.botAnswered = true;
  }
  write(workspaceId, chatId, state, now);
}

module.exports = { read, observe, recordAction, TTL };
