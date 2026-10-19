const { createHash, randomUUID } = require("node:crypto");
const repository = require("./repository.cjs");
const privacy = require("./privacy.cjs");
const { SENSITIVE } = require("./signals.cjs");
const { tokens } = require("./knowledge.cjs");

function save(workspaceId, actorId, input, { moderator = false } = {}) {
  repository.workspace(workspaceId);
  const scope = input.scope || "user";
  if (!["user", "group", "workspace"].includes(scope))
    throw repository.error("Invalid memory scope");
  if (scope !== "user" && !moderator)
    throw repository.error("Shared memories need administrator approval", 403);
  const subjectId = scope === "user" ? actorId : scope === "group" ? input.chatId : workspaceId;
  if (!subjectId) throw repository.error("Memory subject required");
  if (scope === "user" && !privacy.consent(workspaceId, input.chatId || actorId, actorId).memory)
    throw repository.error("Personal memory requires opt-in consent", 403);
  if (
    typeof input.content !== "string" ||
    !input.content.trim() ||
    input.content.length > 1000 ||
    SENSITIVE.test(input.content)
  )
    throw repository.error("Use a short non-sensitive fact or preference");
  const content = input.content.trim();
  const fingerprint = createHash("sha256")
    .update(content.toLowerCase().replace(/\s+/g, " "))
    .digest("hex");
  const days = input.retentionDays || repository.limits(workspaceId).retentionDays;
  if (!Number.isInteger(days) || days < 1 || days > repository.limits(workspaceId).retentionDays)
    throw repository.error("Memory retention exceeds plan");
  const duplicate = repository
    .q(
      "SELECT id FROM ai_approved_memories WHERE workspace_id=? AND scope=? AND subject_id=? AND fingerprint=?",
    )
    .get(workspaceId, scope, subjectId, fingerprint);
  if (duplicate) return { id: duplicate.id, duplicate: true };
  const total = repository
    .q("SELECT count(*) AS total FROM ai_approved_memories WHERE workspace_id=?")
    .get(workspaceId).total;
  if (total >= 5000) throw repository.error("Memory limit reached", 429);
  const id = randomUUID();
  repository
    .q("INSERT INTO ai_approved_memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      workspaceId,
      id,
      scope,
      subjectId,
      actorId,
      content,
      fingerprint,
      input.confirmed === true ? "approved" : "proposed",
      Date.now(),
      Date.now() + days * 86400000,
    );
  repository.audit(workspaceId, actorId, "memory-save", id);
  return { id, state: input.confirmed === true ? "approved" : "proposed" };
}

function list(workspaceId, actorId, { shared = false } = {}) {
  repository.sweep(workspaceId);
  return repository
    .q(
      "SELECT * FROM ai_approved_memories WHERE workspace_id=? AND (owner_id=? OR (?=1 AND scope!='user')) ORDER BY created_at DESC LIMIT 5000",
    )
    .all(workspaceId, actorId, shared ? 1 : 0);
}

function remove(workspaceId, id, actorId, { moderator = false } = {}) {
  repository.workspace(workspaceId);
  const result = repository
    .q(
      "DELETE FROM ai_approved_memories WHERE workspace_id=? AND id=? AND (owner_id=? OR (?=1 AND scope!='user'))",
    )
    .run(workspaceId, id, actorId, moderator ? 1 : 0);
  if (result.changes) repository.audit(workspaceId, actorId, "memory-delete", id);
  return Boolean(result.changes);
}

function retrieve(workspaceId, { userId, chatId, isGroup, query }) {
  repository.sweep(workspaceId);
  const rows = repository
    .q(`SELECT id, content, scope FROM ai_approved_memories
    WHERE workspace_id=? AND state='approved' AND expires_at>? AND
    (scope='workspace' OR (scope='group' AND subject_id=?) OR (?=0 AND scope='user' AND subject_id=?)) LIMIT 500`)
    .all(workspaceId, Date.now(), chatId, isGroup ? 1 : 0, userId);
  const terms = tokens(query);
  return rows
    .map((row) => ({
      ...row,
      score: terms.filter((term) => row.content.toLowerCase().includes(term)).length,
    }))
    .filter((row) => row.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
}

module.exports = { save, list, remove, retrieve };
