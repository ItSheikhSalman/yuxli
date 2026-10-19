import { createRequire } from "node:module";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { equal, finish, ok, section, useTempDataDir } from "./harness.mjs";
const require = createRequire(import.meta.url);
const directory = useTempDataDir("yuxli-adaptive-reliability");
const repository = require("../src/services/intelligence/repository.cjs");
const privacy = require("../src/services/intelligence/privacy.cjs");
const engine = require("../src/services/intelligence/engine.cjs");
const runtime = require("../src/services/intelligence/runtime.cjs");
const delivery = require("../src/services/intelligence/delivery.cjs");
const whatsapp = require("../src/services/intelligence/whatsapp.cjs");
const { migrate, MIGRATIONS } = require("../src/db/db.cjs");
const workspaceId = "ws_default";
const chatId = "510@g.us";
const userId = "700@s.whatsapp.net";
const botId = "900@s.whatsapp.net";

section("upgrade a disposable copy without touching original data");
const oldPath = join(directory, "before.db");
const copyPath = join(directory, "copy.db");
const before = new DatabaseSync(oldPath);
migrate(before, MIGRATIONS.slice(0, 10));
before.prepare("INSERT INTO bot_settings VALUES ('migration-test','preserve-me')").run();
before.close();
copyFileSync(oldPath, copyPath);
const upgraded = new DatabaseSync(copyPath);
migrate(upgraded);
migrate(upgraded);
equal(
  "copied database reaches latest schema",
  upgraded.prepare("PRAGMA user_version").get().user_version,
  MIGRATIONS.length,
);
equal(
  "legacy data preserved",
  upgraded.prepare("SELECT value FROM bot_settings WHERE key='migration-test'").get().value,
  "preserve-me",
);
ok(
  "FTS index available",
  upgraded.prepare("SELECT name FROM sqlite_master WHERE name='ai_knowledge_index'").get(),
);
upgraded.close();
const original = new DatabaseSync(oldPath);
equal(
  "original database untouched",
  original.prepare("PRAGMA user_version").get().user_version,
  10,
);
original.close();

privacy.saveGroup(
  workspaceId,
  {
    chatId,
    enabled: true,
    mode: "mention-only",
    learning: true,
    adminConfirmed: true,
    noticeVersion: privacy.NOTICE_VERSION,
    retentionDays: 7,
  },
  "operator",
);
require("../src/config/runtime-config.cjs").setPermission("gemini", "MEMBERS");
const input = {
  workspaceId,
  chatId,
  userId,
  text: "Explain a Python list",
  isGroup: true,
  mentioned: true,
  allowed: true,
};
const prepared = engine.prepare(input);

section("bounded generation concurrency and provider failure recovery");
const releases = [];
const generator = () => new Promise((resolve) => releases.push(resolve));
const pending = Array.from({ length: 3 }, () => engine.generate(input, prepared, { generator }));
let denied = false;
try {
  await engine.generate(input, prepared, { generator });
} catch (cause) {
  denied = cause.statusCode === 429;
}
ok("fourth concurrent call rejected", denied);
for (const release of releases) release({ text: "A list contains ordered items." });
await Promise.all(pending);
let failed = false;
try {
  await engine.generate(input, prepared, {
    generator: async () => {
      throw new Error("provider unavailable");
    },
  });
} catch {
  failed = true;
}
ok("provider failure propagates", failed);
ok(
  "failure releases concurrency slot",
  (
    await engine.generate(input, prepared, {
      generator: async () => ({ text: "Available again." }),
    })
  ).text.includes("Available"),
);

section("real controller duplicate prevention and reply threading");
const deliveries = [];
let calls = 0;
const socket = {
  user: { id: botId },
  sendMessage: async (jid, content, options) => {
    deliveries.push({ jid, content, options });
    return { key: { id: `reply-${deliveries.length}` } };
  },
};
runtime.bindSocket(socket, "conn_default");
const message = {
  key: { id: "mention-1", remoteJid: chatId, participant: userId },
  message: {
    extendedTextMessage: { text: "Explain a list", contextInfo: { mentionedJid: [botId] } },
  },
};
const options = {
  socket,
  message,
  text: "Explain a list",
  generator: async () => {
    calls++;
    return { text: "A list stores items." };
  },
};
await Promise.all([whatsapp.handle(options), whatsapp.handle(options)]);
equal("duplicate reaches provider only once", calls, 1);
equal("duplicate sends only once", deliveries.length, 1);
equal("reply is threaded to original message", deliveries[0].options.quoted.key.id, "mention-1");
equal("no typing or presence API required", Object.hasOwn(socket, "sendPresenceUpdate"), false);
const unrelated = {
  ...message,
  key: { ...message.key, id: "ordinary-1" },
  message: { conversation: "We are playing cricket" },
};
await whatsapp.handle({ ...options, message: unrelated, text: "We are playing cricket" });
equal("ordinary group conversation stays silent", deliveries.length, 1);

section("terminal stop, unavailable reactions, quotas and privacy recheck");
const terminal = {
  user: { id: botId },
  sendMessage: async () => {
    throw Object.assign(new Error("logged out"), { statusCode: 401 });
  },
};
runtime.bindSocket(terminal, "conn_default");
try {
  await delivery.send({ socket: terminal, workspaceId, chatId, userId, message, text: "test" });
} catch {}
ok("terminal error stops socket", delivery.diagnostics(terminal).stopped);
let stopError;
try {
  await delivery.send({
    socket: terminal,
    workspaceId,
    chatId,
    userId,
    message,
    text: "must not retry",
  });
} catch (cause) {
  stopError = cause;
}
ok("terminal socket cannot retry", stopError?.statusCode === 503);
const noReaction = {
  user: { id: botId },
  supportsReactions: false,
  sendMessage: async () => {
    throw new Error("must not send");
  },
};
runtime.bindSocket(noReaction, "conn_default");
equal(
  "unsupported reaction never becomes emoji message",
  await delivery.send({
    socket: noReaction,
    workspaceId,
    chatId,
    userId,
    message,
    reaction: "\u{1f44d}",
  }),
  null,
);
const entitlements = require("../src/services/entitlements.cjs");
repository
  .q("UPDATE usage_counters SET messages_count=100 WHERE workspace_id=? AND period=?")
  .run(workspaceId, entitlements.getDayPeriodKey());
let quotaError;
try {
  await delivery.send({ socket, workspaceId, chatId, userId, message, text: "over quota" });
} catch (cause) {
  quotaError = cause;
}
ok("actual daily workspace quota enforced", quotaError?.code === "QUOTA_EXCEEDED");
repository.q("UPDATE usage_counters SET messages_count=0 WHERE workspace_id=?").run(workspaceId);
privacy.setConsent(workspaceId, chatId, userId, { optedOut: true });
equal(
  "opt-out blocks delivery after generation",
  await delivery.send({ socket, workspaceId, chatId, userId, message, text: "no" }),
  null,
);

section("native personal memory controls never reveal facts in groups");
const privateId = "711@s.whatsapp.net";
privacy.setConsent(workspaceId, privateId, privateId, {
  noticeVersion: privacy.NOTICE_VERSION,
  memory: true,
});
const dm = (id, text) => ({ key: { id, remoteJid: privateId }, message: { conversation: text } });
await whatsapp.memoryCommand(
  socket,
  dm("memory-add", "!aimemory add I prefer Python"),
  "!aimemory add I prefer Python",
);
equal(
  "explicit add persists approved personal memory",
  repository
    .q("SELECT count(*) AS total FROM ai_approved_memories WHERE owner_id=? AND state='approved'")
    .get(privateId).total,
  1,
);
const previous = deliveries.length;
await whatsapp.memoryCommand(
  socket,
  { ...message, key: { ...message.key, id: "group-memory" } },
  "!aimemory list",
);
ok(
  "group receives no private facts",
  !deliveries.slice(previous).some((item) => item.content.text?.includes("I prefer Python")),
);

section("consent notices, replay protection and workspace-wide user limits");
const noticeUser = "722@s.whatsapp.net";
const noticeMessage = (id) => ({
  key: { id, remoteJid: noticeUser },
  message: { conversation: "!aiprivacy learn on" },
});
const suppressedNotice = { sendMessage: async () => null };
runtime.bindSocket(suppressedNotice, "conn_default");
await whatsapp.privacyCommand(
  suppressedNotice,
  noticeMessage("notice-suppressed"),
  "!aiprivacy learn on",
);
equal(
  "suppressed notice does not count as reviewed",
  privacy.consent(workspaceId, noticeUser, noticeUser).noticeVersion,
  null,
);
equal(
  "suppressed control consumes per-user cooldown",
  whatsapp.claim({
    workspaceId,
    chatId: "elsewhere@g.us",
    userId: noticeUser,
    messageId: "cross-chat-control",
  }).rateLimited,
  true,
);
repository
  .q("DELETE FROM ai_reply_receipts WHERE workspace_id=? AND user_id=?")
  .run(workspaceId, noticeUser);
await whatsapp.privacyCommand(socket, noticeMessage("notice-delivered"), "!aiprivacy learn on");
equal(
  "notice alone does not enable learning",
  privacy.consent(workspaceId, noticeUser, noticeUser).learning,
  false,
);
equal(
  "delivered notice version recorded",
  privacy.consent(workspaceId, noticeUser, noticeUser).noticeVersion,
  privacy.NOTICE_VERSION,
);
await whatsapp.privacyCommand(socket, noticeMessage("notice-delivered"), "!aiprivacy learn on");
equal(
  "replayed first opt-in cannot grant consent",
  privacy.consent(workspaceId, noticeUser, noticeUser).learning,
  false,
);
await whatsapp.privacyCommand(socket, noticeMessage("notice-confirmed"), "!aiprivacy learn on");
equal(
  "new explicit confirmation enables learning",
  privacy.consent(workspaceId, noticeUser, noticeUser).learning,
  true,
);
await whatsapp.privacyCommand(socket, noticeMessage("stop-throttled"), "!aiprivacy stop");
equal(
  "opt-out still applies during cooldown",
  privacy.consent(workspaceId, noticeUser, noticeUser).optedOut,
  true,
);

section("scheduled retention and thread expiry");
const aliasPn = "733@s.whatsapp.net";
const aliasLid = "744@lid";
const aliasMessage = {
  key: { id: "alias-stop", remoteJid: chatId, participant: aliasLid, participantAlt: aliasPn },
  message: { conversation: "!aiprivacy stop" },
};
privacy.setConsent(workspaceId, chatId, aliasPn, { optedOut: true });
ok("PN opt-out covers a received LID alternate", whatsapp.optedOut(socket, aliasMessage));
await whatsapp.privacyCommand(socket, aliasMessage, "!aiprivacy stop");
equal(
  "stop persists for verified alternate identifiers",
  privacy.consent(workspaceId, chatId, aliasLid).optedOut,
  true,
);
const aliasSends = deliveries.length;
await whatsapp.handle({
  ...options,
  message: { ...aliasMessage, key: { ...aliasMessage.key, id: "alias-mention" } },
});
equal("alternate opted-out participant cannot trigger generation", deliveries.length, aliasSends);
equal(
  "alias delivery recheck refuses outgoing reply",
  await delivery.send({
    socket,
    workspaceId,
    chatId,
    userId: aliasLid,
    message: aliasMessage,
    text: "not sent",
  }),
  null,
);

const knowledge = require("../src/services/intelligence/knowledge.cjs");
const expiringDocument = knowledge.ingest(
  workspaceId,
  { filename: "expired.txt", content: "An expired classroom reference." },
  "operator",
);
repository
  .q(
    "UPDATE ai_training_resources SET body=json_set(body,'$.expiresAt',1) WHERE workspace_id=? AND id=?",
  )
  .run(workspaceId, expiringDocument.id);
const now = Date.now();
repository
  .q(
    "INSERT INTO ai_conversation_state VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id,session_id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at",
  )
  .run(
    workspaceId,
    `group:${chatId}`,
    JSON.stringify({
      threads: [],
      botThreads: [{ messageId: "old", at: now - 16 * 60000, summary: "expired excerpt" }],
      lastBotMessageId: "old",
    }),
    now + 60000,
  );
const threadState = require("../src/services/intelligence/conversation.cjs").read(
  workspaceId,
  chatId,
);
equal("ongoing discussion cannot prolong old excerpts", threadState.botThreads.length, 0);
equal("expired bot thread cannot invite a reply", threadState.lastBotMessageId, null);
require("../src/db/db.cjs").sweepExpired();
equal(
  "background sweep removes expired unused documents",
  repository.get(workspaceId, "document", expiringDocument.id),
  null,
);
equal(
  "background sweep removes corresponding FTS content",
  repository
    .q("SELECT count(*) AS total FROM ai_knowledge_index WHERE document_id=?")
    .get(expiringDocument.id).total,
  0,
);

section("queued delivery revocation and unlink privacy boundary");
let releaseSend;
let signalStarted;
const sendStarted = new Promise((resolve) => {
  signalStarted = resolve;
});
let queuedSends = 0;
const queuedSocket = {
  sendMessage: async () => {
    queuedSends++;
    signalStarted();
    return new Promise((resolve) => {
      releaseSend = resolve;
    });
  },
};
runtime.bindSocket(queuedSocket, "conn_default");
const firstSend = delivery.send({
  socket: queuedSocket,
  workspaceId,
  chatId: noticeUser,
  userId: noticeUser,
  message: noticeMessage("queue-1"),
  text: "test",
  control: true,
});
await sendStarted;
const secondSend = delivery
  .send({
    socket: queuedSocket,
    workspaceId,
    chatId: noticeUser,
    userId: noticeUser,
    message: noticeMessage("queue-2"),
    text: "test",
    control: true,
  })
  .catch((cause) => cause);
runtime.revokeSocket(queuedSocket);
releaseSend({ key: { id: "already-sent" } });
await firstSend;
equal("revoked queued socket is denied", (await secondSend).statusCode, 403);
equal("revoked queue sends nothing further", queuedSends, 1);
require("../src/services/intelligence/lifecycle.cjs").resetAccount(workspaceId, "conn_default");
equal("unlink pauses adaptive group settings", privacy.group(workspaceId, chatId).enabled, false);
ok("disabled tombstone prevents legacy fallback", whatsapp.configured(socket, chatId));
equal("unlink clears consent", privacy.consent(workspaceId, privateId, privateId).memory, false);
equal(
  "unlink clears personal memory",
  repository.q("SELECT count(*) AS total FROM ai_approved_memories WHERE scope='user'").get().total,
  0,
);

section("workspace deletion removes unreferenced tables and search index");
repository
  .q(
    "INSERT INTO workspaces(id,name,slug,owner_id,created_at) SELECT 'ws_cleanup','Cleanup','cleanup',owner_id,? FROM workspaces WHERE id=?",
  )
  .run(Date.now(), workspaceId);
repository
  .q("INSERT INTO ai_knowledge_chunks VALUES ('ws_cleanup','doc',0,'cleanup content')")
  .run();
repository
  .q("INSERT INTO ai_knowledge_index VALUES ('ws_cleanup','doc',0,'cleanup content')")
  .run();
repository.q("INSERT INTO ai_training_usage VALUES ('ws_cleanup','2026-10','playground',1)").run();
repository
  .q("INSERT INTO ai_reply_receipts VALUES ('ws_cleanup','chat','message','user',1,'CONTROL')")
  .run();
repository.q("DELETE FROM workspaces WHERE id='ws_cleanup'").run();
for (const table of [
  "ai_knowledge_chunks",
  "ai_knowledge_index",
  "ai_training_usage",
  "ai_reply_receipts",
])
  equal(
    `workspace deletion removes ${table}`,
    repository.q(`SELECT count(*) AS total FROM ${table} WHERE workspace_id='ws_cleanup'`).get()
      .total,
    0,
  );

finish();
