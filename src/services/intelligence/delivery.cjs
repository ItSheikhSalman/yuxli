const repository = require("./repository.cjs");
const entitlements = require("../entitlements.cjs");
const privacy = require("./privacy.cjs");
const { socketScope } = require("./runtime.cjs");

const queues = new Map();
const stopped = new WeakSet();
const health = new WeakMap();
const cooldowns = new WeakMap();

function classifyError(cause) {
  const status = cause?.output?.statusCode || cause?.statusCode || cause?.status;
  if ([401, 403, 405, 411, 440].includes(status)) return "terminal";
  if (status === 429) return "rate-limited";
  if ([408, 502, 503, 504].includes(status)) return "transient";
  return "unknown";
}

function reserveOutbound(workspaceId) {
  repository.transaction(() => {
    const subscription = entitlements.getWorkspaceSubscription(workspaceId);
    if (!["active", "trialing"].includes(subscription.status))
      throw repository.error("Subscription is not active", 403);
    entitlements.assertCanSendMessage(workspaceId);
    const period = entitlements.getDayPeriodKey();
    const now = Date.now();
    repository
      .q(`INSERT INTO usage_counters(id,workspace_id,period,messages_count,ai_queries_count,ai_tokens_count,schedules_count,updated_at)
      VALUES (?, ?, ?, 1, 0, 0, 0, ?) ON CONFLICT(workspace_id,period) DO UPDATE SET messages_count=messages_count+1, updated_at=excluded.updated_at`)
      .run(`use_${workspaceId}_${period}`, workspaceId, period, now);
  });
}

async function send({
  socket,
  workspaceId,
  chatId,
  userId,
  message,
  text,
  reaction,
  control = false,
}) {
  const scope = socketScope(socket);
  if (!scope || scope.workspaceId !== workspaceId)
    throw repository.error("Unbound or cross-workspace socket", 403);
  if (stopped.has(socket))
    throw repository.error("Adaptive delivery stopped after terminal connection error", 503);
  const queueKey = `${workspaceId}:${scope.connectionId}`;
  const queue = queues.get(queueKey) || { tail: Promise.resolve(), size: 0 };
  if (queue.size >= 16 || queues.size > 100) throw repository.error("Outbound backpressure", 429);
  queue.size += 1;
  queues.set(queueKey, queue);
  const job = queue.tail
    .catch(() => {})
    .then(async () => {
      if (socketScope(socket) !== scope)
        throw repository.error("Connection authorization revoked", 403);
      if (stopped.has(socket)) throw repository.error("Connection is stopped", 503);
      if ((cooldowns.get(socket) || 0) > Date.now())
        throw repository.error("Delivery paused for rate-limit backoff", 429);
      const settings = privacy.group(workspaceId, chatId);
      if (
        !control &&
        (!settings.enabled ||
          settings.mode === "silent-observer" ||
          privacy.consent(workspaceId, chatId, userId).optedOut ||
          privacy.messageOptedOut(workspaceId, socket, message))
      )
        return null;
      if (require("./decision.cjs").quietNow(settings.quietHours)) return null;
      if (reaction && socket.supportsReactions === false) return null;
      reserveOutbound(workspaceId);
      try {
        const result = await socket.sendMessage(
          chatId,
          reaction ? { react: { text: reaction, key: message.key } } : { text, linkPreview: null },
          reaction ? undefined : { quoted: message },
        );
        health.set(socket, { outcome: "sent", at: Date.now() });
        return result;
      } catch (cause) {
        const classification = classifyError(cause);
        health.set(socket, { outcome: classification, at: Date.now() });
        if (classification === "terminal") stopped.add(socket);
        if (classification === "rate-limited") cooldowns.set(socket, Date.now() + 60000);
        throw cause;
      }
    });
  queue.tail = job;
  try {
    return await job;
  } finally {
    queue.size -= 1;
    if (!queue.size) queues.delete(queueKey);
  }
}

function diagnostics(socket) {
  return { stopped: stopped.has(socket), ...health.get(socket) };
}
module.exports = { send, classifyError, diagnostics };
