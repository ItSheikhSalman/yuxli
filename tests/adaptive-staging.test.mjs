import { equal, finish, ok, require, section, useTempDataDir } from "./harness.mjs";

useTempDataDir("adaptive-staging-dry-run");
const privacy = require("./src/services/intelligence/privacy.cjs");
const runtime = require("./src/services/intelligence/runtime.cjs");
const repository = require("./src/services/intelligence/repository.cjs");
const whatsapp = require("./src/services/intelligence/whatsapp.cjs");
const delivery = require("./src/services/intelligence/delivery.cjs");
const workspaceId = "ws_default";
const chatId = "staging-synthetic@g.us";
const userId = "710@s.whatsapp.net";
const botId = "910@s.whatsapp.net";
const sent = [];
let modelCalls = 0;
const socket = { user: { id: botId }, supportsReactions: true, async sendMessage(jid, payload) {
  sent.push({ jid, payload });
  return { key: { id: `sent-${sent.length}`, remoteJid: jid } };
} };
runtime.bindSocket(socket, "conn_default");
const generator = async () => { modelCalls++; return { text: "I can help with that question." }; };
const message = (id, text, contextInfo = {}) => ({ key: { remoteJid: chatId, participant: userId, fromMe: false, id }, message: { extendedTextMessage: { text, contextInfo } } });
const handle = (id, text, contextInfo = {}, provider = generator) => whatsapp.handle({ socket, message: message(id, text, contextInfo), text, generator: provider });
const mention = { mentionedJid: [botId] };

section("staging is disabled until explicit scoped setup");
const defaults = privacy.group(workspaceId, chatId);
equal("default AI disabled", defaults.enabled, false);
equal("default learning disabled", defaults.learning, false);
equal("safest response mode", defaults.mode, "mention-only");
equal("unmanaged chat does not enter adaptive pipeline", await handle("before-setup", "Hello", mention), false);
privacy.saveGroup(workspaceId, { ...defaults, enabled: true, adminConfirmed: true, noticeVersion: privacy.NOTICE_VERSION }, "staging-operator");
require("./src/config/runtime-config.cjs").setPermission("gemini", "MEMBERS");
repository.put(workspaceId, "deployment", { ...repository.deployment(workspaceId), cooldownSeconds: 0, perUserMinute: 30, perGroupMinute: 60 }, "staging-operator", { id: "current" });

section("silent conversation, verified invitation and reaction idempotency");
for (const [id, text] of [["discussion1", "Kal match?"], ["discussion2", "5 bjy"], ["discussion3", "Theek hai"]]) await handle(id, text);
equal("uninvited discussion costs no model calls", modelCalls, 0);
equal("uninvited discussion sends nothing", sent.length, 0);
await handle("question", "Can you help with this task?", mention);
equal("invited request calls provider once", modelCalls, 1);
equal("invited reply targets authorized synthetic chat", sent[0]?.jid, chatId);
await handle("question", "Can you help with this task?", mention);
equal("replayed inbound message does not regenerate", modelCalls, 1);
equal("replayed inbound message does not resend", sent.length, 1);
const reply = { stanzaId: "sent-1", participant: botId };
socket.supportsReactions = false;
await handle("unsupported-reaction", "Thanks", reply);
equal("unsupported reaction never becomes an emoji message", sent.length, 1);
socket.supportsReactions = true;
await handle("native-reaction", "Thanks", reply);
equal("reaction uses native payload", sent[1]?.payload.react?.key.id, "native-reaction");
await handle("native-reaction", "Thanks", reply);
equal("duplicate reaction not sent again", sent.length, 2);
equal("learning disabled leaves no aggregate buckets", repository.q("SELECT count(*) AS count FROM ai_style_buckets WHERE workspace_id=?").get(workspaceId).count, 0);
ok("learning disabled keeps thread summaries empty", !JSON.stringify(repository.q("SELECT body FROM ai_conversation_state").all()).includes("Can you help"));

section("provider outage, privacy stop and terminal lifecycle");
let failed = false;
try { await handle("provider-failure", "Can you help with another task?", mention, async () => { throw new Error("Synthetic provider outage"); }); }
catch { failed = true; }
ok("provider outage is surfaced", failed);
equal("failed provider creates no outbound reply", sent.length, 2);
await whatsapp.privacyCommand(socket, message("privacy-stop", "stop ai"), "stop ai");
ok("participant stop persists", privacy.consent(workspaceId, chatId, userId).optedOut);
const afterStop = sent.length;
await handle("after-stop", "Please answer", mention);
equal("mention cannot bypass participant opt-out", sent.length, afterStop);
const terminal = { async sendMessage() { throw Object.assign(new Error("Synthetic logged-out connection"), { statusCode: 401 }); } };
runtime.bindSocket(terminal, "conn_default");
try { await delivery.send({ socket: terminal, workspaceId, chatId, userId, message: message("terminal", "status"), text: "test control", control: true }); } catch {}
ok("terminal send error stops connection", delivery.diagnostics(terminal).stopped);
runtime.revokeSocket(socket);
equal("revoked connection loses access", runtime.socketScope(socket), null);
equal("revoked connection cannot handle a new message", await handle("revoked", "Please answer", mention), false);
equal("no real messages exist in this test", sent.every((entry) => entry.jid === chatId), true);
finish();
