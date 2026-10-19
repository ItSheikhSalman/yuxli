const repository = require("./repository.cjs");
const runtime = require("./runtime.cjs");
const normalizeJid = require("../../utils/normalizeJid.cjs");

function observe(socket, chatId, name = null) {
  const scope = runtime.socketScope(socket);
  const normalized = normalizeJid(chatId);
  if (!scope || !/^[a-zA-Z0-9_.+-]+@(g\.us|s\.whatsapp\.net|lid)$/.test(normalized || "")) return false;
  repository.q(`INSERT INTO ai_chat_directory(workspace_id,connection_id,chat_id,name,kind,observed_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(workspace_id,connection_id,chat_id) DO UPDATE SET
    name=COALESCE(excluded.name,ai_chat_directory.name),observed_at=excluded.observed_at`).run(
      scope.workspaceId, scope.connectionId, normalized, name ? String(name).slice(0, 120) : null,
      normalized.endsWith("@g.us") ? "group" : "direct", Date.now(),
    );
  return true;
}

function list(workspaceId) {
  repository.workspace(workspaceId);
  return repository.q(`SELECT directory.chat_id AS chatId, MAX(directory.name) AS name,
    directory.kind AS kind, MAX(directory.observed_at) AS observedAt
    FROM ai_chat_directory AS directory JOIN whatsapp_connections AS connection
    ON connection.id=directory.connection_id AND connection.workspace_id=directory.workspace_id
    WHERE directory.workspace_id=? GROUP BY directory.chat_id,directory.kind
    ORDER BY COALESCE(MAX(directory.name),directory.chat_id) COLLATE NOCASE LIMIT 5000`).all(workspaceId);
}

function assertAvailable(workspaceId, chatId) {
  repository.workspace(workspaceId);
  const row = repository.q(`SELECT 1 FROM ai_chat_directory AS directory
    JOIN whatsapp_connections AS connection ON connection.id=directory.connection_id
      AND connection.workspace_id=directory.workspace_id
    WHERE directory.workspace_id=? AND directory.chat_id=? LIMIT 1`).get(workspaceId, chatId);
  if (!row) throw repository.error("Choose a chat discovered by an authorized workspace connection", 403, "CHAT_NOT_AVAILABLE");
}

module.exports = { observe, list, assertAvailable };
