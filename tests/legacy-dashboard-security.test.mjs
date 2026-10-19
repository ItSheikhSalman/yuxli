import { equal, finish, httpClient, ok, require, section, startServer, useTempDataDir } from "./harness.mjs";

const dataDir = useTempDataDir("legacy-dashboard-security");
const server = await startServer({ dataDir, routes: true });
const operator = httpClient(server.base);
const tenant = httpClient(server.base);
const root = "/dashboard/api";
const mutate = (client, path, data, method = "PUT") => client.call(root + path, {
  method, headers: { origin: server.base, "content-type": "application/json" }, body: JSON.stringify(data),
});
try {
  await operator.form("/setup", { password: "operator-fixture-only", confirm: "operator-fixture-only" });
  await mutate(operator, "/ai/memory/global", { content: "installation confidential note" });
  await mutate(operator, "/ai/persona", { body: "installation private persona" });
  await tenant.form("/signup", { name: "Synthetic Tenant", email: "tenant@example.invalid", password: "tenant-fixture-only", confirm: "tenant-fixture-only" });
  section("fresh signup creates an isolated workspace, not an installation owner");
  let response = await tenant.call(root + "/ai/training/overview");
  equal("tenant can use own training studio", response.status, 200);
  const tenantWorkspace = (await response.json()).workspaceId;
  ok("tenant never falls back to installation workspace", tenantWorkspace !== "ws_default");
  response = await tenant.call(root + "/ai/memory/global?workspaceId=ws_default");
  equal("legacy memory query cannot select another workspace", (await response.json()).content, "");
  await mutate(tenant, "/ai/memory/global", { content: "tenant-only note", workspaceId: "ws_default" });
  equal("body spoof does not replace installation memory", (await (await operator.call(root + "/ai/memory/global")).json()).content, "installation confidential note");
  equal("tenant reads only its own stored note", (await (await tenant.call(root + "/ai/memory/global")).json()).content, "tenant-only note");
  ok("installation persona is not inherited", !JSON.stringify(await (await tenant.call(root + "/ai/persona")).json()).includes("installation private persona"));
  for (const path of ["/bot/session", "/session", "/auto-delete/rules", "/settings/export", "/security", "/schedules"]) {
    equal(`installation surface ${path} is unavailable to tenant`, (await tenant.call(root + path)).status, 403);
  }
  equal("foreign connection detail denied", (await tenant.call(root + "/connections/conn_default")).status, 404);
  const store = require("./src/db/store.cjs");
  const { q } = require("./src/db/db.cjs");
  const user = store.getSaasUserByEmail("tenant@example.invalid");
  q("UPDATE workspace_members SET role='member' WHERE workspace_id=? AND user_id=?").run(tenantWorkspace, user.id);
  for (const path of ["/ai/memory/global", "/ai/conversations", "/ai/persona", "/ai/config", "/roles", "/groups"]) {
    equal(`revoked admin cannot read ${path}`, (await tenant.call(root + path)).status, 403);
  }
  equal("revoked admin cannot mutate legacy memory", (await mutate(tenant, "/ai/memory/global", { content: "forbidden" })).status, 403);
  q("DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?").run(tenantWorkspace, user.id);
  equal("removed member loses training access immediately", (await tenant.call(root + "/ai/training/overview")).status, 403);
} finally { server.stop(); }
finish();
