// Test suite for Dashboard Web Controls (Bot Access Whitelist & AI Multi-Key Config)
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const botAccess = require("../src/services/botAccess.cjs");
const aiFailover = require("../src/services/aiFailover.cjs");
const settings = require("../src/config/settings.cjs");
const aiFilter = require("../src/services/aiFilter.cjs");
const aiAutoReply = require("../src/services/aiAutoReply.cjs");

test("Dashboard Web Controls: Bot Access & Whitelist API", async () => {
  // Test access modes
  botAccess.setAccessMode("whitelist");
  assert.equal(botAccess.getAccessMode(), "whitelist");

  // Test adding allowed DM from dashboard
  const testDm = "923119988776@s.whatsapp.net";
  botAccess.addAllowedDm(testDm, "Hamza Web Contact");
  const dms = botAccess.getAllowedDms();
  assert.ok(dms.some((d) => d.id === testDm && d.name === "Hamza Web Contact"));
  assert.ok(botAccess.isDmAllowed(testDm));

  // Test removing allowed DM
  botAccess.removeAllowedDm(testDm);
  assert.ok(!botAccess.isDmAllowed(testDm));

  // Reset mode to public
  botAccess.setAccessMode("public");
  assert.equal(botAccess.getAccessMode(), "public");
});

test("Dashboard Web Controls: AI Multi-Key & Failover Config", async () => {
  // Set multi-keys
  settings.set("groq_api_key", "gsk_keyA, gsk_keyB, gsk_keyC");
  assert.equal(aiFailover.getKeyCount("groq"), 3);
  assert.equal(aiFailover.getActiveKey("groq"), "gsk_keyA");

  // Verify key rotation on multi-keys
  aiFailover.rotateKey("groq");
  assert.equal(aiFailover.getActiveKey("groq"), "gsk_keyB");
  aiFailover.resetKeyIndex("groq");
  assert.equal(aiFailover.getActiveKey("groq"), "gsk_keyA");

  // Test fallback toggle
  settings.set("ai_auto_fallback", true);
  assert.equal(settings.get("ai_auto_fallback"), true);
});

test("Dashboard Web Controls: Per-Chat Filter & Auto-Reply Policy", async () => {
  const testGroup = "120363888888888888@g.us";

  // Filter
  aiFilter.setChatFilter(testGroup, "off");
  assert.equal(aiFilter.getChatFilter(testGroup), "off");

  aiFilter.setChatFilter(testGroup, "on");
  assert.equal(aiFilter.getChatFilter(testGroup), "on");

  // Auto-reply
  aiAutoReply.setChatAutoReply(testGroup, "mention");
  assert.equal(aiAutoReply.getChatAutoReply(testGroup), "mention");

  aiAutoReply.setChatAutoReply(testGroup, "all");
  assert.equal(aiAutoReply.getChatAutoReply(testGroup), "all");
});
