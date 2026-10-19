import { mkdirSync, writeFileSync } from "node:fs";
import { equal, finish, ok, require, section, useTempDataDir } from "./harness.mjs";
import { scenarios } from "./fixtures/adaptive-multiturn.mjs";

useTempDataDir("adaptive-multiturn");
const privacy = require("./src/services/intelligence/privacy.cjs");
const conversation = require("./src/services/intelligence/conversation.cjs");
const { analyze } = require("./src/services/intelligence/signals.cjs");
const { decide } = require("./src/services/intelligence/decision.cjs");
const engine = require("./src/services/intelligence/engine.cjs");
const repository = require("./src/services/intelligence/repository.cjs");
const workspaceId = "ws_default";
const userId = "701@s.whatsapp.net";
let total = 0;
let expectedSilence = 0;
let correctSilence = 0;
let unnecessaryReplies = 0;
const observations = [];

for (const [scenarioIndex, scenario] of scenarios.entries()) {
  section(scenario.name);
  const chatId = `multiturn-${scenarioIndex}@g.us`;
  const settings = privacy.saveGroup(workspaceId, { chatId, enabled: true, mode: "mention-only", learning: true, noticeVersion: privacy.NOTICE_VERSION, adminConfirmed: true, retentionDays: 7, ...scenario.settings }, "fixture");
  privacy.setConsent(workspaceId, chatId, userId, { learning: true, noticeVersion: privacy.NOTICE_VERSION });
  for (const [turnIndex, turn] of scenario.turns.entries()) {
    if (turn.consentPatch) privacy.setConsent(workspaceId, chatId, userId, turn.consentPatch);
    const now = Date.now() + turnIndex * 1000;
    const input = { workspaceId, chatId, userId, messageId: turn.id || `turn-${turnIndex}`, allowed: true, isGroup: true, supportsReactions: true, ...turn };
    const signals = analyze(turn.text);
    const decision = decide({ ...input, now, signals, settings: { ...settings, ...turn.settingsPatch }, consent: privacy.consent(workspaceId, chatId, userId), state: conversation.read(workspaceId, chatId, now) });
    equal(`${turnIndex + 1}: ${turn.text}`, decision.action, turn.expected);
    if (turn.language) equal("language follows this turn", decision.language, turn.language);
    if (turn.tone) equal("tone follows current need", decision.tone, turn.tone);
    if (turn.reason) equal("specific safety decision", decision.reason, turn.reason);
    if (turn.expected === "NO_ACTION") {
      expectedSilence++;
      if (decision.action === "NO_ACTION") correctSilence++; else unnecessaryReplies++;
    }
    conversation.observe(input, signals, now);
    if (decision.action !== "NO_ACTION") conversation.recordAction(workspaceId, chatId, input.messageId, decision.action, now, { id: `bot-${turnIndex}` }, userId);
    observations.push({ scenario: scenario.name, turn: turnIndex + 1, expected: turn.expected, action: decision.action, reason: decision.reason });
    total++;
  }
}

section("grounding and privacy output checks are not human quality judgments");
const base = { workspaceId, chatId: "playground", userId, allowed: true, mentioned: true, isGroup: true };
const religious = engine.prepare({ ...base, text: "Give me a hadith reference" }, { playground: true });
ok("unverified religious question uses explicit uncertainty", engine.localResponse(religious)?.includes("will not invent a citation"));
const fabricated = engine.validateOutput("Quran 9:999 [source:invented]", religious);
ok("unknown religious source rejected", fabricated.violations.includes("unknown-source"));
ok("unverified scripture number rejected", fabricated.violations.includes("unverified-scripture-number"));
const business = engine.prepare({ ...base, text: "Has my order shipped?" }, { playground: true });
ok("unverified order status rejected", engine.validateOutput("Your order has shipped", business).violations.includes("unverified-transaction"));
const student = engine.prepare({ ...base, text: "Explain a pointer in C++" }, { playground: true });
equal("a basic correct educational explanation passes structural validation", engine.validateOutput("A pointer stores an address. For example, int value = 3; int* pointer = &value; then *pointer reads 3.", student).violations.length, 0);
ok("human impersonation rejected", engine.validateOutput("I am a human", student).violations.includes("false-identity-or-action"));
ok("sensitive message text not retained in thread state", !JSON.stringify(repository.q("SELECT body FROM ai_conversation_state").all()).includes("synthetic-do-not-retain"));
equal("unnecessary reply count", unnecessaryReplies, 0);
mkdirSync("artifacts/ai", { recursive: true });
writeFileSync("artifacts/ai/multiturn-results.json", JSON.stringify({ authorship: "12 separately authored agent-written scenarios; no human review or parameterized expansion", scenarios: scenarios.length, turns: total, expectedSilence, correctSilence, unnecessaryReplies, humanReviewed: 0, liveModelCalls: 0, observations }, null, 2));
finish();
