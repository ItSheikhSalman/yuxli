import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { equal, finish, ok, require, section, throws, useTempDataDir } from "./harness.mjs";

useTempDataDir("yuxli-legacy-isolation");
const store = require("./src/db/store.cjs");
const { MIGRATIONS, migrate, q } = require("./src/db/db.cjs");
const scope = require("./src/services/workspaceScope.cjs");
const memory = require("./src/utils/memory.cjs");
const mood = require("./src/services/aiMood.cjs");
const runtime = require("./src/services/intelligence/runtime.cjs");
const tools = require("./src/services/aiTools.cjs");
const auth = require("./src/services/aiToolAuth.cjs");
const agent = require("./src/services/aiAgent.cjs");
const permissions = await import("../src/utils/permissions.esm.js");
const chat = "123456789@s.whatsapp.net";
const group = "123456@g.us";
const inside = (workspaceId, callback, extra = {}) => scope.run({ workspaceId, ...extra }, callback);

for (const workspaceId of ["ws_release_a", "ws_release_b"]) {
  store.insertWorkspace({ id: workspaceId, name: workspaceId, slug: workspaceId, ownerId: "synthetic-owner" });
  store.insertWhatsappConnection({ id: `conn_${workspaceId}`, workspaceId, name: "Synthetic connection" });
}

section("append-only migration preserves default data and creates composite ownership");
const scratch = new DatabaseSync(":memory:");
migrate(scratch, MIGRATIONS.slice(0, -1));
scratch.prepare("INSERT INTO ai_history(chat_id,history,updated_at,workspace_id) VALUES (?,?,?,?)").run(chat, "[]", 10, "ws_default");
scratch.prepare("INSERT INTO user_metadata(user_jid,first_seen,last_seen) VALUES (?,?,?)").run(chat, 10, 10);
migrate(scratch);
equal("history retained in original workspace", scratch.prepare("SELECT workspace_id FROM ai_history WHERE chat_id=?").get(chat).workspace_id, "ws_default");
equal("directory retains original ownership", scratch.prepare("SELECT workspace_id FROM user_metadata WHERE user_jid=?").get(chat).workspace_id, "ws_default");
equal("migration reaches expected version", scratch.prepare("PRAGMA user_version").get().user_version, MIGRATIONS.length);
migrate(scratch);
equal("re-running migration is idempotent", scratch.prepare("SELECT count(*) AS count FROM ai_history").get().count, 1);
scratch.close();

section("same identifiers never alias different workspaces");
for (const workspaceId of ["ws_release_a", "ws_release_b"]) {
  inside(workspaceId, () => {
    store.saveChatHistory(chat, [{ role: "user", parts: [{ text: workspaceId }] }]);
    store.saveGroupSettings(group, { owner: workspaceId });
    store.upsertGroupDirectory(group, { subject: workspaceId });
    store.saveUserMetadata({ jid: chat, displayName: workspaceId, isOwner: true });
    store.storeLidPnMapping("777@lid", chat);
    store.saveNote(group, "shared-key", workspaceId);
    store.saveUserTodos(chat, [workspaceId]);
    store.saveUserWarnings(group, chat, [workspaceId]);
    store.saveBotSetting("setting:openai_api_key", workspaceId);
    mood.setChatMode(group, workspaceId.endsWith("a") ? "serious" : "happy");
    memory.addMemory({ chatId: chat, content: workspaceId });
    memory.addMemory({ scope: "global", content: `${workspaceId} operator notes` });
    mkdirSync(dirname(agent.personaFile()), { recursive: true });
    writeFileSync(agent.personaFile(), workspaceId);
    permissions.bootstrapOwners([workspaceId.endsWith("a") ? "111@s.whatsapp.net" : "222@s.whatsapp.net"]);
  });
}
for (const workspaceId of ["ws_release_a", "ws_release_b"]) {
  inside(workspaceId, () => {
    equal(`${workspaceId} history isolated`, store.getChatHistory(chat)[0].parts[0].text, workspaceId);
    equal(`${workspaceId} settings isolated`, store.getGroupSettings(group).owner, workspaceId);
    equal(`${workspaceId} group directory isolated`, store.getGroupDirectory(group).subject, workspaceId);
    equal(`${workspaceId} person name isolated`, store.getUserMetadata(chat).displayName, workspaceId);
    equal(`${workspaceId} note isolated`, store.getNote(group, "shared-key"), workspaceId);
    equal(`${workspaceId} todos isolated`, store.getUserTodos(chat)[0], workspaceId);
    equal(`${workspaceId} warnings isolated`, store.getUserWarnings(group, chat)[0], workspaceId);
    equal(`${workspaceId} provider credential isolated`, store.getBotSetting("setting:openai_api_key"), workspaceId);
    equal(`${workspaceId} memory isolated`, memory.listMemory({ chatId: chat })[0].content, workspaceId);
    equal(`${workspaceId} persona cache isolated`, agent.loadPersona(), workspaceId);
    equal(`${workspaceId} global notes not injected`, memory.buildMemoryContext(chat).includes("operator notes"), false);
    equal(`${workspaceId} roster only contains local users`, store.getAllUsers().length, 1);
  });
}
inside("ws_release_b", () => equal("bootstrap owner from another workspace has no role", permissions.isOwnerJid("111@s.whatsapp.net"), false));
inside("ws_release_a", () => {
  throws("group cannot read a private chat history", () => store.getChatHistory(chat));
  equal("group cannot read private memory", memory.listMemory({ chatId: chat }).length, 0);
  throws("group cannot write global memory", () => memory.addMemory({ scope: "global", content: "a group fact" }));
  equal("group context contains no global or private facts", memory.buildMemoryContext(group), "");
  throws("conversation cannot delete workspace histories", () => store.deleteAllChatHistories());
}, { chatId: group });

section("trusted tool caller owns scope and roles are rechecked");
const socket = { user: { id: "999@s.whatsapp.net" } };
runtime.bindSocket(socket, "conn_ws_release_a");
const message = { key: { remoteJid: chat, id: "synthetic-request", fromMe: false }, message: { conversation: "remember my preference" } };
const caller = await auth.resolveCaller({ msg: message, sock: socket, text: "remember my preference" });
equal("caller workspace comes from socket", caller.workspaceId, "ws_release_a");
const result = await tools.runTool("save_memory", { content: "prefers small examples", workspaceId: "ws_release_b", chatId: "999@g.us" }, { caller, workspaceId: "ws_release_b" });
ok("authorized tool save succeeds", result.saved === true);
const foreignSocket = { async sendMessage() { throw new Error("Must never send"); } };
runtime.bindSocket(foreignSocket, "conn_ws_release_b");
ok("tool cannot deliver through another workspace", (await tools.runTool("create_poll", { question: "Test?", options: ["yes", "no"] }, { caller, sock: foreignSocket })).denied);
const proxy = {};
runtime.aliasSocket(proxy, socket);
ok("proxy inherits the original trusted connection", auth.ownsOutputSocket(caller, proxy));
inside("ws_release_a", () => equal("tool ignored forged workspace and chat arguments", memory.listMemory({ chatId: chat }).length, 2));
inside("ws_release_b", () => equal("other workspace not changed by tool", memory.listMemory({ chatId: chat }).length, 1));
inside("ws_release_a", () => store.setUserRole(chat, "owner", false));
equal("role revocation takes effect after caller minting", auth.authorize({ command: "memory", role: "owner" }, caller).allowed, false);
runtime.revokeSocket(socket);
equal("revoking a socket revokes its proxies", runtime.socketScope(proxy), null);
equal("revoked socket invalidates caller", auth.isTrustedCaller(caller), false);
ok("revoked tool caller denied", (await tools.runTool("forget_memory", { ref: "1" }, { caller })).denied);
try {
  await auth.resolveCaller({ msg: message, sock: {} });
  ok("unbound socket rejected", false);
} catch { ok("unbound socket rejected", true); }

section("retry cache and discovered chats cannot cross connections");
const recent = await import("../src/utils/recentMessageCache.esm.js");
const directory = require("./src/services/intelligence/chatDirectory.cjs");
for (const workspaceId of ["ws_release_a", "ws_release_b"]) {
  inside(workspaceId, () => recent.rememberMessage("same-message", { key: { remoteJid: chat }, message: { conversation: workspaceId } }), { connectionId: `conn_${workspaceId}` });
}
await inside("ws_release_a", async () => {
  equal("retry stays in tenant connection", (await recent.getMessageFromRecent({ id: "same-message", remoteJid: chat })).conversation, "ws_release_a");
  equal("retry cannot request another chat", await recent.getMessageFromRecent({ id: "same-message", remoteJid: group }), undefined);
}, { connectionId: "conn_ws_release_a" });
inside("ws_release_a", () => equal("different connection cannot recall same message ID", recent.recallMessage("same-message"), null), { connectionId: "unknown" });
equal("unbound socket cannot add selectable chats", directory.observe({}, group), false);
ok("bound connection can discover chats", directory.observe(foreignSocket, group, "Tenant B"));
equal("discovered chat invisible to tenant A", directory.list("ws_release_a").length, 0);
throws("tenant A cannot select tenant B chat", () => directory.assertAvailable("ws_release_a", group));
equal("tenant B sees own chat", directory.list("ws_release_b")[0].name, "Tenant B");

section("bounded legacy history and no silent owner imitation");
inside("ws_release_a", () => {
  store.saveChatHistory("retention@s.whatsapp.net", Array.from({ length: 90 }, (_, index) => ({ role: "user", parts: [{ text: String(index) }] })));
  equal("legacy history has a hard turn cap", store.getChatHistory("retention@s.whatsapp.net").length, 60);
  q("UPDATE ai_history SET updated_at=? WHERE workspace_id=? AND chat_id=?").run(Date.now() - 8 * 86400000, "ws_release_a", "retention@s.whatsapp.net");
  equal("expired legacy conversation is deleted", store.getChatHistory("retention@s.whatsapp.net").length, 0);
  store.saveBotSetting("ai_history_retention_days", 0);
  store.saveChatHistory("disabled@s.whatsapp.net", [{ role: "user", parts: [{ text: "not retained" }] }]);
  equal("zero retention disables legacy persistence", store.getChatHistory("disabled@s.whatsapp.net").length, 0);
  store.deleteBotSetting("ai_history_retention_days");
});
inside("ws_release_b", () => equal("tenant A pruning leaves tenant B intact", store.getChatHistory(chat).length, 1));
const ownerSocket = { user: { id: "555@s.whatsapp.net" }, async sendMessage() {} };
runtime.bindSocket(ownerSocket, "conn_ws_release_a");
const botAccess = require("./src/services/botAccess.cjs");
const wasAllowed = botAccess.isMessageAllowed;
botAccess.isMessageAllowed = () => false;
try {
  const { handleIncomingMessage } = await import("../src/handlers/message.handler.js");
  await handleIncomingMessage(ownerSocket, { type: "notify", messages: [{ key: { remoteJid: "555@s.whatsapp.net", fromMe: true, id: "owner-text" }, message: { conversation: "Owner private statement" } }] });
  inside("ws_release_a", () => equal("owner messages are not stored as AI replies", store.getChatHistory("555@s.whatsapp.net").length, 0));
} finally { botAccess.isMessageAllowed = wasAllowed; }

section("concurrency and scoped deletion");
await inside("ws_release_b", async () => {
  equal("tenant cannot reach installation-only legacy features", scope.installationContext(), false);
  equal("tenant sticker identity cannot bind installation library", (await require("./src/stickers/owner.cjs").forMessage({ key: { fromMe: true } }, foreignSocket)).key, null);
  equal("installation auto-delete rules never run in tenant chats", await require("./src/services/autoDelete.cjs").handleIncoming(foreignSocket, { key: { remoteJid: group } }, "some text"), false);
});
inside("ws_default", () => equal("secondary connections cannot borrow legacy installation state", scope.installationContext(), false), { connectionId: "secondary" });
await Promise.all(["ws_release_a", "ws_release_b"].map((workspaceId) => inside(workspaceId, async () => {
  await new Promise((resolve) => setTimeout(resolve, 4));
  store.saveChatHistory(`${group}::${chat}`, [{ role: "user", parts: [{ text: workspaceId }] }]);
  equal(`${workspaceId} async scope survives await`, store.getChatHistory(`${group}::${chat}`)[0].parts[0].text, workspaceId);
})));
inside("ws_release_a", () => {
  store.deleteChatHistory(group);
  equal("only matching group thread removed", store.getChatHistory(`${group}::${chat}`).length, 0);
  store.clearWhatsAppDirectory();
  memory.clearAllMemoryFiles();
  store.deleteAllChatHistories();
});
inside("ws_release_b", () => {
  equal("other workspace group thread survives", store.getChatHistory(`${group}::${chat}`).length, 1);
  equal("other workspace directory survives", store.getAllUsers().length, 1);
  equal("other workspace memory survives", memory.listMemory({ chatId: chat }).length, 1);
});
equal("default workspace has no foreign histories", store.listChatHistories().length, 0);
equal("default provider credentials do not inherit tenant data", store.getBotSetting("setting:openai_api_key"), null);
equal("all isolated history rows carry ownership", q("SELECT count(*) AS count FROM ai_history WHERE workspace_id IS NULL").get().count, 0);
finish();
