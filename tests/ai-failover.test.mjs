// Test suite for AI Auto-Failover, Multi-Key Rotation, Groq & Free Model Cascade

import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aiFailover = require("../src/services/aiFailover.cjs");
const settings = require("../src/config/settings.cjs");
const { getProvider, hasProvider } = require("../src/services/aiRouter.cjs");
const modelCmd = require("../src/commands/model.cjs");

console.log("Running AI Failover & Multi-Key Rotation Tests...\n");

// 1. Test Key Parsing
console.log("Test 1: Multi-Key Parsing & Cleaning");
const single = aiFailover.parseKeys("gsk_key123");
assert.deepStrictEqual(single, ["gsk_key123"]);

const commaSeparated = aiFailover.parseKeys("gsk_1, gsk_2 , gsk_3");
assert.deepStrictEqual(commaSeparated, ["gsk_1", "gsk_2", "gsk_3"]);

const newlineSeparated = aiFailover.parseKeys("AIzaSy1\nAIzaSy2\r\nAIzaSy3");
assert.deepStrictEqual(newlineSeparated, ["AIzaSy1", "AIzaSy2", "AIzaSy3"]);

const mixedSeparated = aiFailover.parseKeys("key1, key2; key3\nkey4");
assert.deepStrictEqual(mixedSeparated, ["key1", "key2", "key3", "key4"]);

assert.deepStrictEqual(aiFailover.parseKeys(""), []);
assert.deepStrictEqual(aiFailover.parseKeys(null), []);
console.log("✓ Multi-key parsing passed\n");

// 2. Test Multi-Key Rotation
console.log("Test 2: Key Rotation on Exhaustion");
settings.set("groq_api_key", "groq_key_A, groq_key_B, groq_key_C");
aiFailover.resetKeyIndex("groq");

assert.strictEqual(aiFailover.getActiveKey("groq"), "groq_key_A");
assert.strictEqual(aiFailover.getAllKeys("groq").length, 3);

// Rotate once -> key B
const rotated1 = aiFailover.rotateKey("groq");
assert.strictEqual(rotated1, true);
assert.strictEqual(aiFailover.getActiveKey("groq"), "groq_key_B");

// Rotate again -> key C
const rotated2 = aiFailover.rotateKey("groq");
assert.strictEqual(rotated2, true);
assert.strictEqual(aiFailover.getActiveKey("groq"), "groq_key_C");

// Rotate again -> wraps back to key A
const rotated3 = aiFailover.rotateKey("groq");
assert.strictEqual(rotated3, true);
assert.strictEqual(aiFailover.getActiveKey("groq"), "groq_key_A");

// Reset rotation index
aiFailover.resetKeyIndex("groq");
assert.strictEqual(aiFailover.getActiveKey("groq"), "groq_key_A");
console.log("✓ Key rotation passed\n");

// 3. Test Quota / Rate-limit Detection
console.log("Test 3: Quota and Rate Limit Error Detection");
assert.strictEqual(aiFailover.isQuotaOrRateLimitError({ status: 429 }), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError({ statusCode: 429 }), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError({ status: 503 }), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError(new Error("Resource has been exhausted (e.g. check quota).")), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError(new Error("Rate limit reached for model llama-3.3-70b-versatile")), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError(new Error("Tokens per minute (TPM) limit exceeded")), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError(new Error("insufficient_quota")), true);
assert.strictEqual(aiFailover.isQuotaOrRateLimitError(new Error("Something completely unrelated")), false);
console.log("✓ Quota & rate-limit error detection passed\n");

// 4. Test Failover Fallback Chain
console.log("Test 4: Fallback Chain Order");
const groqChain = aiFailover.getFallbackChain("groq");
assert.strictEqual(groqChain[0], "groq");
assert.ok(groqChain.includes("gemini"));
assert.ok(groqChain.includes("flipia"));
assert.ok(groqChain.includes("pollinations"));
assert.strictEqual(new Set(groqChain).size, groqChain.length, "No duplicate providers in fallback chain");

const geminiChain = aiFailover.getFallbackChain("gemini");
assert.strictEqual(geminiChain[0], "gemini");
assert.ok(geminiChain.includes("groq"));
assert.ok(geminiChain.includes("flipia"));
console.log("✓ Fallback chain order passed\n");

// 5. Test Router & Free Providers
console.log("Test 5: Router & Free Provider Registration");
assert.strictEqual(hasProvider("groq"), true);
assert.strictEqual(hasProvider("gemini"), true);
assert.strictEqual(hasProvider("flipia"), true);
assert.strictEqual(hasProvider("pollinations"), true);
assert.strictEqual(hasProvider("auto"), true);

const flipia = getProvider("flipia");
assert.ok(flipia, "Flip-IA provider exists");
assert.strictEqual(flipia.isConfigured(), true, "Flip-IA is 100% free and always configured");

const pollinations = getProvider("pollinations");
assert.ok(pollinations, "Pollinations provider exists");
assert.strictEqual(pollinations.isConfigured(), true, "Pollinations is 100% free and always configured");

const autoProv = getProvider("auto");
assert.ok(autoProv, "Auto provider resolves");
console.log("✓ Router & free providers passed\n");

// 6. Test Model Command Execution
console.log("Test 6: Model & Provider Command Execution");
let lastReply = "";
const fakeSock = {
  async sendMessage(jid, content) {
    lastReply = content.text;
    return { key: { id: "msg_reply_123" } };
  },
};

const fakeMsg = {
  key: { remoteJid: "923001234567@s.whatsapp.net", fromMe: true },
};

// 6a: Test !model (status summary)
await modelCmd.execute(fakeSock, fakeMsg, [], "", null, { invokedName: "model" });
assert.ok(lastReply.includes("AI ENGINE & MODEL STATUS"));
assert.ok(lastReply.includes("Auto Token/Key Rotation"));
assert.ok(lastReply.includes("Flip-IA Free"));

// 6b: Test !model list (catalog)
await modelCmd.execute(fakeSock, fakeMsg, ["list"], "", null, { invokedName: "model" });
assert.ok(lastReply.includes("ALL INTERNET AI MODELS CATALOG"));
assert.ok(lastReply.includes("GROQ LPU"));
assert.ok(lastReply.includes("GOOGLE GEMINI"));
assert.ok(lastReply.includes("100% FREE MODELS"));
assert.ok(lastReply.includes("llama-3.3-70b-versatile"));

// 6c: Test !provider groq
await modelCmd.execute(fakeSock, fakeMsg, ["groq"], "", null, { invokedName: "provider" });
assert.strictEqual(settings.get("ai_provider"), "groq");
assert.ok(lastReply.includes("AI Provider switched to: *GROQ*"));

// 6d: Test !model deepseek-r1-distill-llama-70b
await modelCmd.execute(fakeSock, fakeMsg, ["deepseek-r1-distill-llama-70b"], "", null, { invokedName: "model" });
assert.strictEqual(settings.get("groq_model"), "deepseek-r1-distill-llama-70b");
assert.ok(lastReply.includes("deepseek-r1-distill-llama-70b"));

// 6e: Test !model key groq
await modelCmd.execute(fakeSock, fakeMsg, ["key", "groq", "gsk_new1, gsk_new2"], "", null, { invokedName: "model" });
assert.strictEqual(aiFailover.getAllKeys("groq").length, 2);
assert.strictEqual(aiFailover.getActiveKey("groq"), "gsk_new1");
assert.ok(lastReply.includes("Successfully configured *2* API key(s)"));

console.log("✓ Model command execution passed\n");

console.log("ALL AI FAILOVER, MULTI-KEY & GROQ TESTS PASSED! 🎉");
