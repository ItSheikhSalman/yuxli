const contexts = new WeakMap();
const sockets = new WeakMap();

function bindSocket(socket, connectionId) {
  const { q } = require("./repository.cjs");
  const connection = q("SELECT workspace_id FROM whatsapp_connections WHERE id=?").get(
    connectionId,
  );
  if (!connection) throw new Error("Unknown WhatsApp connection");
  sockets.set(socket, Object.freeze({ workspaceId: connection.workspace_id, connectionId }));
}

function socketScope(socket) {
  const scope = sockets.get(socket);
  if (!scope) return null;
  if (scope.parent) return socketScope(scope.parent);
  const connection = require("./repository.cjs").q("SELECT workspace_id FROM whatsapp_connections WHERE id=?").get(scope.connectionId);
  return connection?.workspace_id === scope.workspaceId ? scope : null;
}
function aliasSocket(alias, socket) {
  if (alias === socket || !socketScope(socket)) throw new Error("A proxy requires a trusted source socket");
  sockets.set(alias, Object.freeze({ parent: socket }));
}
function revokeSocket(socket) {
  sockets.delete(socket);
}
function mintContext(fields, instruction) {
  const context = Object.freeze({ ...fields, adaptive: true });
  contexts.set(context, instruction);
  return context;
}
function instruction(context) {
  return contexts.get(context) || null;
}
function isolated(context) {
  return Boolean(context && contexts.has(context));
}

module.exports = { bindSocket, aliasSocket, socketScope, revokeSocket, mintContext, instruction, isolated };
