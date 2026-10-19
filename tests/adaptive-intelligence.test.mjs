import { createRequire } from "node:module";
import { equal, finish, ok, section, throws, useTempDataDir } from "./harness.mjs";
const require = createRequire(import.meta.url);

useTempDataDir("yuxli-adaptive");
const repository = require("../src/services/intelligence/repository.cjs");
const privacy = require("../src/services/intelligence/privacy.cjs");
const profiler = require("../src/services/intelligence/profiler.cjs");
const memory = require("../src/services/intelligence/memory.cjs");
const knowledge = require("../src/services/intelligence/knowledge.cjs");
const personas = require("../src/services/intelligence/personas.cjs");
const { analyze } = require("../src/services/intelligence/signals.cjs");
const { decide } = require("../src/services/intelligence/decision.cjs");
const engine = require("../src/services/intelligence/engine.cjs");
const runtime = require("../src/services/intelligence/runtime.cjs");
const delivery = require("../src/services/intelligence/delivery.cjs");
const evaluations = require("../src/services/intelligence/evaluations.cjs");
const conversation = require("../src/services/intelligence/conversation.cjs");
const { PERSONAS } = require("../src/services/intelligence/catalog.cjs");
const workspaceId = "ws_default";
const chatId = "100@g.us";
const userId = "200@s.whatsapp.net";
const actor = "operator";

section("workspace-scoped training and immutable limits");
equal("15 built-in personas", PERSONAS.length, 15);
throws("unknown workspace fails closed", () => repository.list("missing", "persona"));
const first = repository.put(
  workspaceId,
  "persona",
  personas.validate({ name: "Study", template: "student" }),
  actor,
);
repository.put(workspaceId, "persona", personas.validate({ name: "Other" }), actor);
throws("free persona quota enforced", () =>
  repository.put(workspaceId, "persona", personas.validate({ name: "Third" }), actor),
);
throws("optimistic revision rejects stale overwrite", () =>
  repository.put(workspaceId, "persona", first, actor, { id: first.id, revision: 0 }),
);
throws("invalid intensity", () => personas.validate({ humor: 99 }));
throws("unknown permission choice cannot become a language", () =>
  personas.validate({ language: "root" }),
);
repository
  .q("INSERT INTO workspaces VALUES ('ws_other','Other','other','owner',?)")
  .run(Date.now());
equal("other workspace cannot read persona", repository.get("ws_other", "persona", first.id), null);
equal(
  "commercial price preserved",
  require("../src/services/entitlements.cjs").PLANS.starter.priceMonthly,
  19,
);

section("consent, aggregate style and reversible learning");
throws("cannot enable without notice", () =>
  privacy.saveGroup(workspaceId, { chatId, enabled: true, mode: "smart", retentionDays: 7 }, actor),
);
let group = privacy.saveGroup(
  workspaceId,
  {
    chatId,
    enabled: true,
    mode: "mention-only",
    retentionDays: 7,
    learning: true,
    adminConfirmed: true,
    noticeVersion: privacy.NOTICE_VERSION,
  },
  actor,
);
equal(
  "no consent means no profiling",
  profiler.observe({ workspaceId, chatId, userId, text: "hn acha" }),
  false,
);
throws("learning requires notice", () =>
  privacy.setConsent(workspaceId, chatId, userId, { learning: true }),
);
privacy.setConsent(workspaceId, chatId, userId, {
  learning: true,
  memory: true,
  noticeVersion: privacy.NOTICE_VERSION,
});
for (let index = 0; index < 20; index++)
  profiler.observe({ workspaceId, chatId, userId, text: "hn acha kal 5 bjy" });
let profile = profiler.profile(workspaceId, chatId);
equal("profile derives Roman Urdu from real aggregate", profile.language, "roman-ur");
equal("typical length measured", profile.averageWords, 5);
equal("other group has no profile", profiler.profile(workspaceId, "101@g.us").messages, 0);
equal("other workspace has no profile", profiler.profile("ws_other", chatId).messages, 0);
equal(
  "secret excluded",
  profiler.observe({ workspaceId, chatId, userId, text: "password is abc" }),
  false,
);
ok(
  "no raw text in database",
  !repository.q("SELECT body FROM ai_style_buckets").get().body.includes("hn acha"),
);
privacy.setConsent(workspaceId, chatId, userId, { learning: false });
equal(
  "withdrawal clears aggregate to remove contribution",
  profiler.profile(workspaceId, chatId).messages,
  0,
);

section("memory approval, retention and group privacy");
const saved = memory.save(workspaceId, userId, {
  chatId,
  content: "I prefer Python examples",
  confirmed: true,
});
equal(
  "private memory retrieved in private chat",
  memory.retrieve(workspaceId, { userId, chatId: userId, isGroup: false, query: "Python" }).length,
  1,
);
equal(
  "private memory never retrieved in group",
  memory.retrieve(workspaceId, { userId, chatId, isGroup: true, query: "Python" }).length,
  0,
);
equal("other user cannot delete", memory.remove(workspaceId, saved.id, "other"), false);
equal("owner can delete", memory.remove(workspaceId, saved.id, userId), true);
throws("sensitive memory rejected", () =>
  memory.save(workspaceId, userId, { chatId, content: "My password is 123", confirmed: true }),
);
const proposed = memory.save(workspaceId, userId, { chatId, content: "I prefer math revision" });
equal(
  "inferences are not approved facts",
  memory.retrieve(workspaceId, { userId, chatId: userId, isGroup: false, query: "math" }).length,
  0,
);
repository.q("UPDATE ai_approved_memories SET expires_at=1 WHERE id=?").run(proposed.id);
equal("expiration removes memory", memory.list(workspaceId, userId).length, 0);

section("knowledge ingestion and source authorization");
const document = knowledge.ingest(
  workspaceId,
  {
    filename: "schedule.md",
    content: "The Python assignment deadline is Friday at 5 PM.",
    scope: "group",
    chatId,
    source: { kind: "education", url: "https://school.example/policy" },
  },
  actor,
);
equal(
  "unapproved document excluded",
  knowledge.retrieve(workspaceId, "Python deadline", { chatId }).length,
  0,
);
knowledge.approve(workspaceId, document.id, actor, document.revision);
equal(
  "approved document retrieved",
  knowledge.retrieve(workspaceId, "Python deadline", { chatId }).length,
  1,
);
equal(
  "group document isolated",
  knowledge.retrieve(workspaceId, "Python deadline", { chatId: "101@g.us" }).length,
  0,
);
equal(
  "workspace isolation",
  knowledge.retrieve("ws_other", "Python deadline", { chatId }).length,
  0,
);
throws("unsupported binary document rejected", () =>
  knowledge.ingest(workspaceId, { filename: "bad.pdf", content: "%PDF" }, actor),
);
throws("secrets rejected", () =>
  knowledge.ingest(workspaceId, { filename: "bad.txt", content: "api key=abc" }, actor),
);
throws("invalid JSON rejected", () =>
  knowledge.ingest(workspaceId, { filename: "bad.json", content: "{invalid" }, actor),
);

section("participation scenarios and silence accuracy");
const evaluation = evaluations.evaluate();
for (const scenario of evaluations.scenarios()) {
  const action = decide(scenario.input).action;
  ok(`${scenario.id}: ${action}`, scenario.expected.includes(action));
}
equal("800 evaluated scenarios", evaluation.total, 800);
equal("unnecessary reply rate is zero on the fixtures", evaluation.unnecessaryReplyRate, 0);
equal("no human review claim", evaluation.humanReviewed, false);
const base = {
  allowed: true,
  isGroup: true,
  mentioned: true,
  supportsReactions: true,
  settings: { enabled: true, mode: "mention-only", reactionEnabled: true },
  consent: {},
  text: "Hello",
};
equal(
  "quiet hours suppress even mention",
  decide({
    ...base,
    settings: { ...base.settings, quietHours: { start: 0, end: 23, timezone: "UTC" } },
    now: Date.UTC(2026, 9, 18, 12),
  }).action,
  "NO_ACTION",
);
equal(
  "observer never posts",
  decide({ ...base, settings: { ...base.settings, mode: "silent-observer" } }).action,
  "NO_ACTION",
);
equal(
  "individual opt-out overrides mention",
  decide({ ...base, consent: { optedOut: true } }).action,
  "NO_ACTION",
);
equal(
  "reaction adapter fallback is silence",
  decide({ ...base, text: "thanks", replyToBot: true, supportsReactions: false }).action,
  "NO_ACTION",
);
equal(
  "sensitive laughter is not a reaction",
  decide({ ...base, text: "Someone died haha", replyToBot: true }).action,
  "NORMAL_REPLY",
);
equal(
  "unconsented roast blocked locally",
  decide({
    ...base,
    text: "roast Ali",
    settings: { ...base.settings, humor: true },
    allTargetsConsent: false,
  }).localOnly,
  true,
);
equal(
  "non-English script detected",
  analyze("\u0645\u062c\u06be\u06d2 \u0628\u062a\u0627\u0626\u06cc\u06ba").language,
  "ur",
);
equal(
  "technical request expands length",
  decide({
    ...base,
    text: "Explain pointers in C++",
    profile: { enoughData: true, averageWords: 2 },
  }).action,
  "DETAILED_REPLY",
);

section("isolated generation, grounding and real usage");
const prepared = engine.prepare({
  workspaceId,
  chatId,
  userId,
  text: "Explain Python lists",
  isGroup: true,
  mentioned: true,
  allowed: true,
  supportsReactions: true,
});
ok("AI identity is explicit", prepared.instruction.includes("an AI assistant, not a human"));
const generated = await engine.generate(
  { workspaceId, chatId, userId, text: "Explain Python lists" },
  prepared,
  {
    generator: async (options) => {
      equal("no tools offered", options.useTools, false);
      equal("no historical transcript sent", options.history.length, 0);
      ok("isolated context is minted", runtime.isolated(options.context));
      const denial = await require("../src/services/aiTools.cjs").runTool(
        "save_memory",
        { content: "injected" },
        options.context,
      );
      equal("even provider-invented tool calls are denied", denial.denied, true);
      return {
        text: "A Python list stores items in order.",
        usage: { measured: true, inputTokens: 5, outputTokens: 8, totalTokens: 13 },
      };
    },
  },
);
equal("actual provider usage preserved", generated.usage.totalTokens, 13);
equal("unknown prices are not fabricated", generated.estimatedCost, null);
ok(
  "unknown citation blocked",
  engine.validateOutput("Answer [source:fake]", prepared).violations.includes("unknown-source"),
);
const islamic = engine.prepare({
  workspaceId,
  chatId,
  userId,
  text: "Give a Quran reference",
  isGroup: true,
  mentioned: true,
  allowed: true,
});
ok(
  "unverified religious source gives honest fallback",
  engine.localResponse(islamic).includes("will not invent"),
);
const play = await engine.playground(workspaceId, actor, {
  text: "Kal match ka kya scene?",
  isGroup: true,
  mentioned: false,
});
equal("playground delivery disabled", play.delivery, "disabled");
equal("playground silence consumes no provider", play.response, null);

section("delivery idempotency, privacy recheck and backpressure boundaries");
const sent = [];
const socket = {
  user: { id: "999@s.whatsapp.net" },
  sendMessage: async (...args) => {
    sent.push(args);
    return { key: { id: `sent-${sent.length}` } };
  },
};
runtime.bindSocket(socket, "conn_default");
const message = { key: { id: "incoming", remoteJid: chatId, participant: userId } };
await delivery.send({ socket, workspaceId, chatId, userId, message, reaction: "\u{1f44d}" });
equal("native reaction, no emoji message", sent[0][1].react.key.id, "incoming");
const claimed = require("../src/services/intelligence/whatsapp.cjs").claim({
  workspaceId,
  chatId,
  userId,
  messageId: "dupe",
});
equal("first claim accepted", claimed.duplicate, false);
equal(
  "second claim rejected",
  require("../src/services/intelligence/whatsapp.cjs").claim({
    workspaceId,
    chatId,
    userId,
    messageId: "dupe",
  }).duplicate,
  true,
);
privacy.setConsent(workspaceId, chatId, userId, { optedOut: true });
await delivery.send({ socket, workspaceId, chatId, userId, message, text: "must not send" });
equal("opt-out rechecked at delivery", sent.length, 1);
equal("terminal errors classified", delivery.classifyError({ statusCode: 401 }), "terminal");
equal("rate-limit classified", delivery.classifyError({ status: 429 }), "rate-limited");
group = privacy.saveGroup(workspaceId, { ...group, enabled: false }, actor);
equal(
  "disabled managed group cannot fall back to legacy auto replies",
  require("../src/services/intelligence/whatsapp.cjs").configured(socket, chatId),
  true,
);
conversation.recordAction(workspaceId, chatId, "message", "SHORT_REPLY", Date.now() - 1000000);
equal(
  "short-lived conversation state expires",
  conversation.read(workspaceId, chatId).lastBotAt,
  0,
);

finish();
