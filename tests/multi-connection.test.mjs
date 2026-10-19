// tests/multi-connection.test.mjs
//
// Verification of Multi-Number WhatsApp Architecture:
// - Isolated connection ID generation and workspace association
// - Plan-based quota enforcement (Free/Starter=1, Business Pro=5, Enterprise=configured)
// - Credential isolation across multiple connections in SQLite Baileys store
// - Cross-workspace access prevention and gating
// - Concurrent connection lifecycle operations (start/stop)
// - Crash recovery and connection restoration on startup

import { equal, finish, ok, require, section, useTempDataDir } from "./harness.mjs";

useTempDataDir("levix-multi-conn");

const store = require("./src/db/store.cjs");
const entitlements = require("./src/services/entitlements.cjs");
const billing = require("./src/services/billing/index.cjs");
const { connectionManager } = require("./src/core/connectionManager.cjs");
const { sqliteFactory } = require("./src/auth/auth-storage.cjs");
const db = require("./src/db/db.cjs");

// Mock session class for testing lifecycle
class MockSession {
  constructor(opts) {
    this.connectionId = opts.connectionId;
    this.workspaceId = opts.workspaceId;
    this.emit = opts.emit || (() => {});
    this.state = "idle";
    this.qr = null;
    this.pairingCode = null;
    this.user = null;
  }
  getState() {
    return {
      state: this.state,
      connected: this.state === "connected",
      hasQr: Boolean(this.qr),
      hasPairingCode: Boolean(this.pairingCode),
      user: this.user,
      canStart: this.state !== "connected",
      canStop: this.state === "connected",
      canUnlink: Boolean(this.user),
    };
  }
  async start(opts = {}) {
    this.state = opts.method === "qr" ? "waiting_for_qr" : "starting";
    if (opts.method === "qr") {
      this.qr = "mock_qr_payload";
      this.state = "waiting_for_qr";
    }
    if (opts.phone) {
      this.pairingCode = "12345678";
      this.state = "waiting_for_qr";
    }
    this.emit("state", this.getState());
    return this.getState();
  }
  async stop() {
    this.state = "disconnected";
    this.emit("state", this.getState());
    return this.getState();
  }
  async reconnect() {
    this.state = "reconnecting";
    this.emit("state", this.getState());
    return this.getState();
  }
  async unlink() {
    this.state = "idle";
    this.user = null;
    this.emit("state", this.getState());
    return this.getState();
  }
}

section("initialization & default connection");
await connectionManager.initialize({
  sessionFactory: (opts) => new MockSession(opts),
});

const defaultConn = store.getWhatsappConnection("conn_default", "ws_default");
ok("default connection created", Boolean(defaultConn));
equal("default is primary", defaultConn.is_default, 1);
equal("default belongs to ws_default", defaultConn.workspace_id, "ws_default");

const defaultSession = connectionManager.getDefaultSession("ws_default");
ok("default session exists in pool", Boolean(defaultSession));
equal("default session connectionId", defaultSession.connectionId, "conn_default");

section("plan quota enforcement");
// Free tier has 1 connection allowed; default connection is already using 1.
try {
  await connectionManager.createConnection("ws_default", { name: "Second Number" });
  ok("free tier limit enforced", false, "Should not allow 2nd connection on free tier");
} catch (err) {
  equal("free tier rejection code", err.code, "CONNECTION_LIMIT_REACHED");
  equal("free tier rejection status", err.statusCode, 403);
  ok("free tier limit enforced", true);
}

// Upgrade workspace to business_pro (up to 5 connections)
billing.syncWorkspacePlan("ws_default", "business_pro", "active");

const sub = entitlements.getWorkspaceSubscription("ws_default");
equal("plan upgraded to business_pro", sub.plan, "pro");

// Now create up to 5 connections
const conn2 = await connectionManager.createConnection("ws_default", { name: "Support Line" });
const conn3 = await connectionManager.createConnection("ws_default", { name: "Sales Desk" });
const conn4 = await connectionManager.createConnection("ws_default", { name: "VIP Chat" });
const conn5 = await connectionManager.createConnection("ws_default", { name: "Emergency Bot" });

ok("created conn2", Boolean(conn2.connectionId));
ok("created conn3", Boolean(conn3.connectionId));
ok("created conn4", Boolean(conn4.connectionId));
ok("created conn5", Boolean(conn5.connectionId));

const allWsConns = connectionManager.listWorkspaceConnections("ws_default");
equal("total connections is now 5", allWsConns.length, 5);

// 6th connection should be rejected under business_pro
try {
  await connectionManager.createConnection("ws_default", { name: "6th Number" });
  ok("business_pro 5-connection limit enforced", false, "Should reject 6th connection");
} catch (err) {
  equal("business_pro limit rejection code", err.code, "CONNECTION_LIMIT_REACHED");
  ok("business_pro limit enforced", true);
}

section("credential isolation in SQLite Baileys store");
const defaultAuth = sqliteFactory("conn_default");
await defaultAuth.writeData("creds", { test_creds: { me: { id: "1001@s.whatsapp.net" } } });

// conn2 uses isolated prefixed keys
const conn2Auth = sqliteFactory(conn2.connectionId);
await conn2Auth.writeData("creds", { test_creds: { me: { id: "2002@s.whatsapp.net" } } });

// Verify read isolation
const readDefaultCreds = await defaultAuth.readData("creds");
const readConn2Creds = await conn2Auth.readData("creds");

equal("default creds user", readDefaultCreds.test_creds.me.id, "1001@s.whatsapp.net");
equal("conn2 creds user", readConn2Creds.test_creds.me.id, "2002@s.whatsapp.net");

// Remove conn2 creds, ensure default creds untouched
await conn2Auth.removeData("creds");
ok("conn2 creds removed", (await conn2Auth.readData("creds")) === null);
ok("default creds preserved", (await defaultAuth.readData("creds")) !== null);

section("cross-workspace authorization gating");
// Create a separate workspace ws_tenant_b
store.insertWorkspace({ id: "ws_tenant_b", name: "Tenant B Corp", slug: "tenant-b" });
billing.syncWorkspacePlan("ws_tenant_b", "starter", "active");
const connB = await connectionManager.createConnection("ws_tenant_b", { name: "Tenant B Bot" });

// Tenant B listing only shows Tenant B's connection
const tenantBList = connectionManager.listWorkspaceConnections("ws_tenant_b");
equal("tenant B connections count", tenantBList.length, 1);
equal("tenant B connection id", tenantBList[0].id, connB.connectionId);

// Tenant B attempting to access or manipulate ws_default's conn2
try {
  connectionManager.getSession(conn2.connectionId, "ws_tenant_b");
  ok("cross-workspace read rejected", false);
} catch (err) {
  equal("cross-workspace error code", err.code, "CONNECTION_NOT_FOUND");
  equal("cross-workspace status code", err.statusCode, 404);
  ok("cross-workspace read rejected", true);
}

try {
  await connectionManager.stopConnection(conn2.connectionId, "ws_tenant_b");
  ok("cross-workspace stop rejected", false);
} catch (err) {
  equal("cross-workspace stop code", err.code, "CONNECTION_NOT_FOUND");
  ok("cross-workspace stop rejected", true);
}

try {
  await connectionManager.deleteConnection(conn2.connectionId, "ws_tenant_b");
  ok("cross-workspace delete rejected", false);
} catch (err) {
  equal("cross-workspace delete code", err.code, "CONNECTION_NOT_FOUND");
  ok("cross-workspace delete rejected", true);
}

section("concurrent connection lifecycle operations");
const sessionConn2 = connectionManager.getSession(conn2.connectionId, "ws_default");
const sessionConn3 = connectionManager.getSession(conn3.connectionId, "ws_default");

// Start both concurrently
const [res2, res3] = await Promise.all([
  connectionManager.startConnection(conn2.connectionId, "ws_default", { method: "pairing", phone: "1234567890" }),
  connectionManager.startConnection(conn3.connectionId, "ws_default", { method: "qr" }),
]);

equal("conn2 pairing code generated", res2.hasPairingCode, true);
equal("conn3 waiting for qr", res3.hasQr, true);

// Stop conn2, reconnect conn3 concurrently
const [stopRes2, recRes3] = await Promise.all([
  connectionManager.stopConnection(conn2.connectionId, "ws_default"),
  connectionManager.reconnectConnection(conn3.connectionId, "ws_default"),
]);

equal("conn2 stopped", stopRes2.state, "disconnected");
equal("conn3 reconnecting", recRes3.state, "reconnecting");

section("safe restart and connection restoration");
// Simulate server restart: create fresh ConnectionManager instance with same database
const freshManager = new (require("./src/core/connectionManager.cjs").ConnectionManager)();
await freshManager.initialize({
  sessionFactory: (opts) => new MockSession(opts),
});

const restoredDefault = freshManager.getSession("conn_default", "ws_default");
const restoredConn2 = freshManager.getSession(conn2.connectionId, "ws_default");
const restoredConnB = freshManager.getSession(connB.connectionId, "ws_tenant_b");

ok("restored default connection", Boolean(restoredDefault));
ok("restored conn2", Boolean(restoredConn2));
ok("restored connB", Boolean(restoredConnB));

equal("restored conn2 connectionId", restoredConn2.connectionId, conn2.connectionId);
equal("restored connB workspaceId", restoredConnB.workspaceId, "ws_tenant_b");

section("connection deletion");
await connectionManager.deleteConnection(conn5.connectionId, "ws_default");
const remaining = connectionManager.listWorkspaceConnections("ws_default");
equal("remaining connections after delete", remaining.length, 4);

finish();
