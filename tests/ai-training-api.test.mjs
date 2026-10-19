import {
  equal,
  finish,
  httpClient,
  ok,
  require,
  section,
  startServer,
  throws,
  useTempDataDir,
} from "./harness.mjs";

const dataDir = useTempDataDir("yuxli-training-api");
const directorySocket = {};
require("./src/services/intelligence/runtime.cjs").bindSocket(directorySocket, "conn_default");
require("./src/services/intelligence/chatDirectory.cjs").observe(directorySocket, "300@g.us", "Authorized test group");
require("./src/db/db.cjs").checkpoint();
const server = await startServer({ dataDir, routes: true });
const http = httpClient(server.base);
const root = "/dashboard/api/ai/training";
const send = (path, body, method = "POST") =>
  http.call(root + path, {
    method,
    headers: { origin: server.base, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

try {
  section("authenticated training workspace boundary");
  equal("unauthenticated requests rejected", (await http.call(root + "/overview")).status, 401);
  await http.form(
    "/setup",
    { password: "training-test-only-123", confirm: "training-test-only-123" },
    { origin: server.base },
  );
  await http.form("/login", { password: "training-test-only-123" }, { origin: server.base });
  let response = await http.call(root + "/overview");
  equal("operator can load training studio", response.status, 200);
  const overview = await response.json();
  equal("default workspace from authenticated server context", overview.workspaceId, "ws_default");
  equal("no groups activated automatically", overview.groups.length, 0);
  equal("PDF support not falsely advertised", overview.capabilities.pdf, false);
  equal("selector lists discovered chats only", overview.authorizedChats[0]?.chatId, "300@g.us");
  equal("arbitrary JID cannot grant chat authorization", (await send("/groups", {
    chatId: "999@g.us", enabled: true, mode: "mention-only", adminConfirmed: true,
    noticeVersion: overview.noticeVersion,
  })).status, 403);
  response = await http.call(root + "/groups", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: "{}",
  });
  equal("same-origin mutation boundary retained", response.status, 403);

  section("working setup, draft editing and approval flows");
  response = await send("/groups", {
    chatId: "300@g.us",
    enabled: true,
    mode: "mention-only",
    retentionDays: 7,
  });
  equal("notice cannot be skipped", response.status, 400);
  response = await send("/groups", {
    chatId: "300@g.us",
    enabled: true,
    mode: "mention-only",
    retentionDays: 7,
    adminConfirmed: true,
    noticeVersion: overview.noticeVersion,
    workspaceId: "ws_other",
  });
  equal("allowed group created", response.status, 200);
  const group = await response.json();
  equal(
    "group tied to authenticated workspace",
    (await (await http.call(root + "/overview")).json()).groups[0].id,
    group.id,
  );
  response = await send("/resources/persona", {
    name: "My tutor",
    template: "student",
    instructions: "Explain with examples",
  });
  equal("persona persisted", response.status, 200);
  const persona = await response.json();
  response = await send("/resources/persona", { ...persona, name: "Updated tutor" });
  equal("persona edit with revision", response.status, 200);
  equal("stale edit blocked", (await send("/resources/persona", persona)).status, 409);
  const rule = await (
    await send("/resources/rule", { name: "Brief", instructions: "Prefer concise explanations" })
  ).json();
  equal("new rules are drafts", rule.approved, false);
  equal(
    "explicit approval supported",
    (await send(`/resources/rule/${rule.id}/approve`, { revision: rule.revision })).status,
    200,
  );
  const document = await (
    await send("/knowledge", {
      name: "FAQ",
      filename: "faq.txt",
      content: "Support hours are 9 AM to 5 PM.",
      source: { kind: "business", url: "https://company.example/policy" },
    })
  ).json();
  equal("document starts unapproved", document.approved, false);
  equal(
    "document approval supported",
    (await send(`/resources/document/${document.id}/approve`, { revision: document.revision }))
      .status,
    200,
  );
  equal(
    "unsupported document blocked",
    (await send("/knowledge", { filename: "payload.docx", content: "binary" })).status,
    415,
  );
  const version = await (await send("/versions", { name: "Reviewed configuration" })).json();
  equal("version snapshots approved rules", version.snapshot.rules.length, 1);
  equal(
    "draft/live activation persists",
    (
      await send(
        "/deployment",
        { ...overview.deployment, enabled: true, versionId: version.id },
        "PUT",
      )
    ).status,
    200,
  );
  equal(
    "cannot delete active version",
    (
      await http.call(`${root}/resources/version/${version.id}`, {
        method: "DELETE",
        headers: { origin: server.base },
      })
    ).status,
    409,
  );

  section("playground has no delivery and reports real decision");
  response = await send("/playground", {
    text: "We are playing cricket",
    isGroup: true,
    mentioned: false,
  });
  equal("playground works without provider key", response.status, 200);
  const preview = await response.json();
  equal("no uninvited message", preview.decision.action, "NO_ACTION");
  equal("cannot deliver from playground", preview.delivery, "disabled");
  equal("no fabricated token metrics", preview.response, null);
  const report = await (await send("/evaluations")).json();
  equal("800 evaluation scenarios", report.total, 800);
  equal("all authored decision fixtures pass", report.passed, 800);
  equal("no human intelligence claim", report.humanReviewed, false);

  section("fresh membership, roles, and cross-tenant access");
  const repository = require("./src/services/intelligence/repository.cjs");
  const { resolveTrainingAccess } = await import("../src/routes/aiTraining.api.esm.js");
  repository
    .q(
      "INSERT INTO saas_users(id,email,name,password_hash,salt,created_at) VALUES ('training_member','test@example.invalid','Test','unused','unused',?)",
    )
    .run(Date.now());
  const session = {
    loggedIn: true,
    saasUserId: "training_member",
    saasUser: { workspaceId: "ws_default", role: "owner" },
  };
  throws("session role alone grants no membership", () => resolveTrainingAccess(session));
  repository
    .q(
      "INSERT INTO workspace_members VALUES ('training_membership','ws_default','training_member','member',?)",
    )
    .run(Date.now());
  equal(
    "server membership overrides forged owner role",
    resolveTrainingAccess(session).admin,
    false,
  );
  repository.q("UPDATE workspace_members SET role='admin' WHERE id='training_membership'").run();
  ok("live role upgrades read at request time", resolveTrainingAccess(session).admin);
  throws("unowned selected workspace rejected", () =>
    resolveTrainingAccess({ ...session, saasUser: { workspaceId: "ws_foreign" } }),
  );
  repository.q("DELETE FROM workspace_members WHERE id='training_membership'").run();
  throws("revoked member loses access immediately", () => resolveTrainingAccess(session));
} finally {
  server.stop();
}

finish();
