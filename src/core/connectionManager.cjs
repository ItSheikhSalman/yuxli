// file: src/core/connectionManager.cjs
//
// YUXLI Multi-Connection Manager & Session Pool
//
// Provides isolated, multi-tenant WhatsApp connection lifecycle management.
// Supports:
// - Up to 1 connection for Free and Starter Developer tiers
// - Up to 5 connections for Business Pro
// - Configured / unlimited connections for Enterprise SLA
// - Complete isolation of credentials, event loops, reconnect timers, and Baileys sockets
// - Strict cross-workspace authorization gating
// - Safe crash recovery and connection restoration on process boot

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const store = require("../db/store.cjs");
const entitlements = require("../services/entitlements.cjs");
const logger = require("../utils/logger.cjs");

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    // In-memory pool of live WhatsAppSession instances: connectionId -> WhatsAppSession
    this.sessions = new Map();
    this.initialized = false;
    this.sessionOptions = null;
  }

  /**
   * Initializes the pool, ensures default connection, and restores saved paired sessions.
   *
   * @param {object} options
   * @param {Function} options.sessionFactory - factory function creating a WhatsAppSession
   * @param {Function} [options.emit] - central event emitter
   * @param {Function} [options.initializeScheduledJobs]
   * @param {Function} [options.stopScheduledJobs]
   */
  async initialize({
    sessionFactory,
    emit = () => {},
    initializeScheduledJobs = null,
    stopScheduledJobs = null,
  } = {}) {
    this.sessionOptions = {
      sessionFactory,
      emit,
      initializeScheduledJobs,
      stopScheduledJobs,
    };

    // Ensure default connection for ws_default
    const defaultConn = store.getWhatsappConnection("conn_default", "ws_default");
    if (!defaultConn) {
      try {
        store.insertWhatsappConnection({
          id: "conn_default",
          workspaceId: "ws_default",
          name: "Primary WhatsApp",
          isDefault: 1,
        });
      } catch (err) {
        logger.debug({ err: err?.message }, "[ConnectionManager] Default connection ensure skipped");
      }
    }

    // Load all registered connections across workspaces
    const allConnections = store.listWhatsappConnections("ws_default");
    logger.info({ count: allConnections.length }, "[ConnectionManager] Initializing connection pool");

    for (const conn of allConnections) {
      if (!this.sessions.has(conn.id)) {
        const session = this.#createSessionInstance(conn.id, conn.workspace_id);
        this.sessions.set(conn.id, session);
      }
    }

    this.initialized = true;
    return this.getDefaultSession("ws_default");
  }

  #createSessionInstance(connectionId, workspaceId) {
    if (!this.sessionOptions?.sessionFactory) {
      throw new Error("ConnectionManager sessionFactory not configured");
    }

    const session = this.sessionOptions.sessionFactory({
      connectionId,
      workspaceId,
      emit: (event, payload) => {
        // Forward to central event bus with connection metadata
        if (this.sessionOptions.emit) {
          this.sessionOptions.emit(event, { ...payload, connectionId, workspaceId });
          if (connectionId === "conn_default") {
            this.sessionOptions.emit("session", payload);
          }
        }
        this.emit(event, { ...payload, connectionId, workspaceId });
      },
      initializeScheduledJobs: this.sessionOptions.initializeScheduledJobs,
      stopScheduledJobs: this.sessionOptions.stopScheduledJobs,
      log: logger,
    });

    return session;
  }

  /**
   * Returns default session for a workspace.
   */
  getDefaultSession(workspaceId = "ws_default") {
    const connections = store.listWhatsappConnections(workspaceId);
    const defaultConn = connections.find((c) => c.is_default) || connections[0];
    if (!defaultConn) return null;

    let session = this.sessions.get(defaultConn.id);
    if (!session && this.sessionOptions?.sessionFactory) {
      session = this.#createSessionInstance(defaultConn.id, workspaceId);
      this.sessions.set(defaultConn.id, session);
    }
    return session;
  }

  /**
   * Retrieves a connection session with strict workspace authorization.
   */
  getSession(connectionId, workspaceId = null) {
    const conn = store.getWhatsappConnection(connectionId, workspaceId);
    if (!conn) {
      const err = new Error(`Connection '${connectionId}' not found or access denied`);
      err.code = "CONNECTION_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    let session = this.sessions.get(connectionId);
    if (!session && this.sessionOptions?.sessionFactory) {
      session = this.#createSessionInstance(connectionId, conn.workspace_id);
      this.sessions.set(connectionId, session);
    }
    return session;
  }

  /**
   * Lists all connections belonging to a workspace with live status snapshots.
   */
  listWorkspaceConnections(workspaceId = "ws_default") {
    const rows = store.listWhatsappConnections(workspaceId);
    const sub = entitlements.getWorkspaceSubscription(workspaceId);
    const plan = entitlements.PLANS[sub.plan] || entitlements.PLANS.free;

    return rows.map((conn) => {
      const session = this.sessions.get(conn.id);
      const state = session ? session.getState() : { state: conn.status || "idle", connected: false };
      return {
        id: conn.id,
        workspaceId: conn.workspace_id,
        name: conn.name,
        phoneNumber: conn.phone_number || state.user?.id || null,
        isDefault: Boolean(conn.is_default),
        status: state.state || "idle",
        connected: Boolean(state.connected),
        hasQr: Boolean(state.hasQr),
        qr: session?.qr ?? null,
        pairingCode: session?.pairingCode ?? null,
        user: state.user || null,
        createdAt: conn.created_at,
        updatedAt: conn.updated_at,
      };
    });
  }

  /**
   * Creates a new isolated WhatsApp connection for a workspace.
   * Enforces server-side subscription tier quotas.
   */
  async createConnection(workspaceId, { name, isDefault = false } = {}) {
    const existing = store.listWhatsappConnections(workspaceId);
    entitlements.assertCanAddConnection(workspaceId, existing.length);

    const connectionId = `conn_${crypto.randomBytes(6).toString("hex")}`;
    const cleanName = String(name || `WhatsApp Account ${existing.length + 1}`).trim();

    store.insertWhatsappConnection({
      id: connectionId,
      workspaceId,
      name: cleanName,
      isDefault: isDefault ? 1 : 0,
    });

    const session = this.#createSessionInstance(connectionId, workspaceId);
    this.sessions.set(connectionId, session);

    logger.info(
      { connectionId, workspaceId, name: cleanName },
      "[ConnectionManager] Provisioned new isolated WhatsApp connection"
    );

    return {
      connectionId,
      name: cleanName,
      workspaceId,
      session: session.getState(),
    };
  }

  /**
   * Starts a specific connection's state machine.
   */
  async startConnection(connectionId, workspaceId, options = {}) {
    const session = this.getSession(connectionId, workspaceId);
    const state = await session.start({ reason: "manager_start", ...options });
    store.updateWhatsappConnectionStatus(connectionId, state.state);
    return state;
  }

  /**
   * Stops a specific connection.
   */
  async stopConnection(connectionId, workspaceId) {
    const session = this.getSession(connectionId, workspaceId);
    const state = await session.stop({ reason: "manager_stop" });
    store.updateWhatsappConnectionStatus(connectionId, state.state);
    return state;
  }

  /**
   * Reconnects a specific connection.
   */
  async reconnectConnection(connectionId, workspaceId) {
    const session = this.getSession(connectionId, workspaceId);
    const state = await session.reconnect({ reason: "manager_reconnect" });
    store.updateWhatsappConnectionStatus(connectionId, state.state);
    return state;
  }

  /**
   * Unlinks and clears credentials for a specific connection.
   */
  async unlinkConnection(connectionId, workspaceId) {
    const session = this.getSession(connectionId, workspaceId);
    const state = await session.logout();
    store.updateWhatsappConnectionStatus(connectionId, "logged_out");
    return state;
  }

  /**
   * Deletes a connection and permanently purges its isolated credentials.
   */
  async deleteConnection(connectionId, workspaceId) {
    const conn = store.getWhatsappConnection(connectionId, workspaceId);
    if (!conn) {
      const err = new Error(`Connection '${connectionId}' not found in workspace`);
      err.code = "CONNECTION_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const all = store.listWhatsappConnections(workspaceId);
    if (all.length <= 1) {
      const err = new Error("Cannot delete the only connection for this workspace");
      err.code = "LAST_CONNECTION";
      err.statusCode = 400;
      throw err;
    }

    const session = this.sessions.get(connectionId);
    if (session) {
      if (session.socket) require("../services/intelligence/runtime.cjs").revokeSocket(session.socket);
      try {
        await session.stop({ reason: "connection_deleted" });
      } catch {}
      this.sessions.delete(connectionId);
    }

    require("../services/intelligence/lifecycle.cjs").resetAccount(workspaceId, connectionId);
    store.deleteWhatsappConnection(connectionId, workspaceId);
    logger.info({ connectionId, workspaceId }, "[ConnectionManager] Deleted connection and purged auth keys");
    return { success: true, connectionId };
  }
}

// Global singleton instance for the control plane
const connectionManager = new ConnectionManager();

module.exports = {
  ConnectionManager,
  connectionManager,
};
