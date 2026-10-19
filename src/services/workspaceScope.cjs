const { AsyncLocalStorage } = require("node:async_hooks");
const { createHash } = require("node:crypto");

const storage = new AsyncLocalStorage();
const local = Object.freeze({ workspaceId: "ws_default", connectionId: null, chatId: null });

function current() {
  return storage.getStore() || local;
}

function denied(message = "Workspace access denied") {
  return Object.assign(new Error(message), { status: 403, code: "WORKSPACE_DENIED" });
}

function run(scope, callback) {
  const { q } = require("../db/db.cjs");
  if (!scope?.workspaceId || !q("SELECT id FROM workspaces WHERE id=?").get(scope.workspaceId)) {
    throw denied();
  }
  return storage.run(Object.freeze({ ...scope }), callback);
}

function forSocket(socket, callback, chatId = null) {
  const scope = require("./intelligence/runtime.cjs").socketScope(socket);
  if (!scope) throw denied("Unbound WhatsApp connection");
  return run({ ...scope, chatId }, callback);
}

function workspaceId() {
  return current().workspaceId;
}

function key(value) {
  return workspaceId() === "ws_default" ? String(value) : JSON.stringify([workspaceId(), value]);
}

function directory() {
  return createHash("sha256").update(workspaceId()).digest("hex");
}

function assertChat(chatId) {
  const activeChat = current().chatId;
  if (activeChat && chatId !== activeChat && !String(chatId).startsWith(`${activeChat}::`)) {
    throw denied("Another conversation's data is not available here");
  }
}

function assertGlobalMemory() {
  if (current().chatId?.endsWith("@g.us")) {
    throw denied("Private or global memory is not available in groups");
  }
}

function installationContext() {
  return workspaceId() === "ws_default" && (!current().connectionId || current().connectionId === "conn_default");
}

class ScopedSet {
  #sets = new Map();
  #active() {
    if (!this.#sets.has(workspaceId())) this.#sets.set(workspaceId(), new Set());
    return this.#sets.get(workspaceId());
  }
  add(value) { this.#active().add(value); return this; }
  has(value) { return this.#active().has(value); }
  delete(value) { return this.#active().delete(value); }
  clear() { this.#sets.delete(workspaceId()); }
  [Symbol.iterator]() { return this.#active()[Symbol.iterator](); }
}

module.exports = { current, run, forSocket, workspaceId, key, directory, assertChat, assertGlobalMemory, installationContext, denied, ScopedSet };
