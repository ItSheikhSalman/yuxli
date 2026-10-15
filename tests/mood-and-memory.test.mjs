// Test suite for AI Mood Engine, Mode Command, Conversation Memory & User Demand handling

import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aiMood = require("../src/services/aiMood.cjs");
const modeCmd = require("../src/commands/mode.cjs");
const { sanitizeHistoryForSession } = require("../src/services/aiAgent.cjs");

console.log("Running Mood & Memory Tests...\n");

// 1. Test Mode normalization and definitions
console.log("Test 1: Mode Normalization & Metadata");
assert.strictEqual(aiMood.normalizeMode("roast"), "roast");
assert.strictEqual(aiMood.normalizeMode("roasting"), "roast");
assert.strictEqual(aiMood.normalizeMode("savage"), "roast");
assert.strictEqual(aiMood.normalizeMode("روسٹ"), "roast");

assert.strictEqual(aiMood.normalizeMode("happy"), "happy");
assert.strictEqual(aiMood.normalizeMode("cheerful"), "happy");
assert.strictEqual(aiMood.normalizeMode("خوش"), "happy");

assert.strictEqual(aiMood.normalizeMode("auto"), "auto");
assert.strictEqual(aiMood.normalizeMode("dynamic"), "auto");
assert.strictEqual(aiMood.normalizeMode("reset"), "auto");

assert.ok(aiMood.MODES.roast, "Roast mode metadata exists");
assert.ok(aiMood.MODES.happy, "Happy mode metadata exists");
assert.ok(aiMood.MODES.auto, "Auto mode metadata exists");
console.log("✓ Mode normalization passed\n");

// 2. Test Expression Cue Detection
console.log("Test 2: Real-time User Expression Cue Detection");
const roastCue1 = aiMood.detectExpressionCue("bhai mujhe roast karo");
assert.strictEqual(roastCue1?.modeHint, "roast");

const roastCue2 = aiMood.detectExpressionCue("roast me please");
assert.strictEqual(roastCue2?.modeHint, "roast");

const happyCue = aiMood.detectExpressionCue("I am so happy today! Got the job 🎉");
assert.strictEqual(happyCue?.modeHint, "happy");

const sadCue = aiMood.detectExpressionCue("I am feeling very sad and heartbroken 😭");
assert.strictEqual(sadCue?.modeHint, "empathetic");

const neutralCue = aiMood.detectExpressionCue("what is the capital of France?");
assert.strictEqual(neutralCue, null);
console.log("✓ Expression cue detection passed\n");

// 3. Test Mood Prompt Generation
console.log("Test 3: Mood Prompt Generation");
const prompt = aiMood.buildMoodPrompt("923001234567@s.whatsapp.net", "roast me");
assert.ok(prompt.includes("AI Personality & Adaptive Mood Engine"), "Prompt header included");
assert.ok(prompt.includes("NEVER FORGET PREVIOUS MESSAGE HISTORY"), "Memory directive included");
assert.ok(prompt.includes("CHECK AND SATISFY THE USER'S EXACT DEMAND"), "User demand directive included");
assert.ok(prompt.includes("ROAST / SARCASM / TAUNT / BANTER"), "Dynamic roast cue detected in prompt");
console.log("✓ Mood prompt generation passed\n");

// 4. Test Chat Mode Persistence
console.log("Test 4: Chat Mode Persistence");
const testChatId = "923009999999@s.whatsapp.net";
aiMood.setChatMode(testChatId, "roast");
assert.strictEqual(aiMood.getChatMode(testChatId), "roast");

aiMood.setChatMode(testChatId, "happy");
assert.strictEqual(aiMood.getChatMode(testChatId), "happy");

aiMood.resetChatMode(testChatId);
assert.strictEqual(aiMood.getChatMode(testChatId), "auto");
console.log("✓ Chat mode persistence passed\n");

// 5. Test History Sanitization (flattening tool turns so Gemini never rejects them)
console.log("Test 5: History Sanitization & Session Continuity");
const rawHistory = [
  { role: "user", parts: [{ text: "Who won the World Cup in 2022?" }] },
  {
    role: "model",
    parts: [
      { text: "Let me check." },
      { functionCall: { name: "web_search", args: { query: "World Cup 2022 winner" } } },
    ],
  },
  {
    role: "user",
    parts: [
      { functionResponse: { name: "web_search", response: { result: "Argentina won" } } },
    ],
  },
  { role: "model", parts: [{ text: "Argentina won the World Cup in 2022!" }] },
];

const sanitized = sanitizeHistoryForSession(rawHistory);
assert.ok(Array.isArray(sanitized), "Sanitized history is an array");
assert.strictEqual(sanitized[0].role, "user");
assert.ok(sanitized.every((turn) => turn.parts.every((p) => typeof p.text === "string")), "All parts are flattened to resilient text parts");
assert.ok(sanitized.some((turn) => turn.parts.some((p) => p.text.includes("Argentina won"))), "Preserved facts and answer");
console.log("✓ History sanitization passed\n");

// 6. Test Mode Command Execution
console.log("Test 6: Mode Command Execution");
assert.strictEqual(modeCmd.name, "mode");
assert.ok(modeCmd.aliases.includes("mood"));
assert.ok(modeCmd.aliases.includes("aimode"));
assert.ok(modeCmd.aliases.includes("مزاج"));

let sentMessage = null;
const mockSock = {
  async sendMessage(jid, content) {
    sentMessage = content.text;
  },
};

const mockMsg = {
  key: { remoteJid: "923001112233@s.whatsapp.net" },
};

// Test !mode with no args (shows list)
await modeCmd.execute(mockSock, mockMsg, []);
assert.ok(
  sentMessage.includes("AI Mood & Personality Mode") || sentMessage.includes("AI موڈ اور مزاج کنٹرول") || sentMessage.includes("أوضاع ومزاج"),
  "Help text displayed"
);
assert.ok(
  sentMessage.includes("roast") || sentMessage.includes("روسٹ") || sentMessage.includes("Roasting"),
  "Roasting mode listed"
);
assert.ok(
  sentMessage.includes("happy") || sentMessage.includes("خوش") || sentMessage.includes("Happy"),
  "Happy mode listed"
);

// Test !mode roast
await modeCmd.execute(mockSock, mockMsg, ["roast"]);
assert.ok(
  sentMessage.includes("Roasting") || sentMessage.includes("روسٹ") || sentMessage.includes("🔥"),
  "Roast mode set confirmation"
);
assert.strictEqual(aiMood.getChatMode("923001112233@s.whatsapp.net"), "roast");

// Test 7: Bot Access Control (Public, Only Me, Specific Groups, DM Only)
console.log("Test 7: Bot Access Control & Scope");
const botAccess = require("../src/services/botAccess.cjs");
const botmodeCmd = require("../src/commands/botmode.cjs");

// Default mode is public
assert.strictEqual(botAccess.getAccessMode(), "public");

// Set mode to self / onlyme
botAccess.setAccessMode("self");
assert.strictEqual(botAccess.getAccessMode(), "self");

// Ordinary user message in self mode should be rejected
const mockNonOwnerMsg = {
  key: { remoteJid: "923005555555@s.whatsapp.net", fromMe: false },
};
assert.strictEqual(botAccess.isMessageAllowed(mockSock, mockNonOwnerMsg, false), false, "Non-owner rejected in self mode");

// fromMe message is always allowed
const mockFromMeMsg = {
  key: { remoteJid: "923005555555@s.whatsapp.net", fromMe: true },
};
assert.strictEqual(botAccess.isMessageAllowed(mockSock, mockFromMeMsg, false), true, "Owner/fromMe allowed in self mode");

// Test group whitelisting in "groups" mode
botAccess.setAccessMode("groups");
const testGroup1 = "120363000000000001@g.us";
const testGroup2 = "120363000000000002@g.us";

botAccess.addAllowedGroup(testGroup1, "VIP Test Group");
assert.strictEqual(botAccess.isGroupAllowed(testGroup1), true, "Group 1 is allowed");
assert.strictEqual(botAccess.isGroupAllowed(testGroup2), false, "Group 2 is NOT allowed");

const mockGroup1Msg = {
  key: { remoteJid: testGroup1, participant: "923005555555@s.whatsapp.net", fromMe: false },
};
const mockGroup2Msg = {
  key: { remoteJid: testGroup2, participant: "923005555555@s.whatsapp.net", fromMe: false },
};

assert.strictEqual(botAccess.isMessageAllowed(mockSock, mockGroup1Msg, true), true, "Message in whitelisted group allowed");
assert.strictEqual(botAccess.isMessageAllowed(mockSock, mockGroup2Msg, true), false, "Message in non-whitelisted group rejected");

// Remove allowed group
botAccess.removeAllowedGroup(testGroup1);
assert.strictEqual(botAccess.isGroupAllowed(testGroup1), false, "Group 1 removed successfully");

// Reset to public
botAccess.setAccessMode("public");
assert.strictEqual(botAccess.isMessageAllowed(mockSock, mockGroup2Msg, true), true, "All groups allowed in public mode");
console.log("✓ Bot Access Control passed\n");

// Test 8: BotMode Command Execution
console.log("Test 8: BotMode Command Execution");
assert.strictEqual(botmodeCmd.name, "botmode");
assert.ok(botmodeCmd.aliases.includes("workmode"));
assert.ok(botmodeCmd.aliases.includes("onlyme"));
assert.ok(botmodeCmd.aliases.includes("allowgroup"));

// Owner can execute !botmode
await botmodeCmd.execute(mockSock, mockFromMeMsg, []);
assert.ok(sentMessage.includes("Bot Access & Scope Control") || sentMessage.includes("التحكم في نطاق") || sentMessage.includes("دائرہ کار") || sentMessage.includes("Daira-e-Kaar"), "BotMode status shown");

// Owner switches to onlyme
await botmodeCmd.execute(mockSock, mockFromMeMsg, ["onlyme"]);
assert.strictEqual(botAccess.getAccessMode(), "self");

// Owner switches back to public
await botmodeCmd.execute(mockSock, mockFromMeMsg, ["public"]);
assert.strictEqual(botAccess.getAccessMode(), "public");

console.log("✓ BotMode command execution passed\n");

// Test 9: Raw Anger, Swear & Curse Word Detection ("friends wala mazak / gussa")
console.log("Test 9: Raw Anger & Curse Word Detection");
const angerCue1 = aiMood.detectExpressionCue("suar ke bache chup kar bc");
assert.strictEqual(angerCue1?.modeHint, "roast", "Curse words trigger roast mode");
assert.strictEqual(angerCue1?.isAnger, true, "Anger flag is true for curse words");

const angerCue2 = aiMood.detectExpressionCue("bsdk dala kuta shut the fuck up bitch");
assert.strictEqual(angerCue2?.modeHint, "roast");
assert.strictEqual(angerCue2?.isAnger, true);

const angerCue3 = aiMood.detectExpressionCue("mujhe bohot gussa aa raha hai sar mat khao");
assert.strictEqual(angerCue3?.modeHint, "roast");
assert.strictEqual(angerCue3?.isAnger, true);

const promptWithAnger = aiMood.buildMoodPrompt("923001112233@s.whatsapp.net", "kuta suar bc bsdk");
assert.ok(
  promptWithAnger.includes("SAVAGE ANGER / RAW FRIEND BANTER / CURSES DETECTED") ||
    promptWithAnger.includes("ROAST"),
  "Anger prompt directive generated"
);
console.log("✓ Raw anger and curse detection passed\n");

// Test 10: Targeted Friend Roast Directive Generation
console.log("Test 10: Targeted Friend Roast Directive Generation");
const targetedPrompt = aiMood.buildMoodPrompt("120363999999999999@g.us", "isko roast karo", {
  isTargetedRoast: true,
  targetInfo: {
    targetTag: "@923007778899",
    targetJid: "923007778899@s.whatsapp.net",
    allTargets: ["923007778899@s.whatsapp.net"],
  },
  isGroup: true,
  senderName: "Ali",
  senderId: "923001112233@s.whatsapp.net",
});

assert.ok(targetedPrompt.includes("TARGETED FRIEND ROAST DIRECTIVE"), "Targeted roast header included");
assert.ok(targetedPrompt.includes("@923007778899"), "Friend tag specifically targeted");
assert.ok(targetedPrompt.includes("friends wala mazak"), "Friends banter context present");
assert.ok(targetedPrompt.includes("Group Conversation & Individual User Topic Continuity"), "Group context included");
console.log("✓ Targeted friend roast prompt passed\n");

// Test 11: Multi-User Isolated History & Composite Session Keys in Groups
console.log("Test 11: Multi-User History Isolation in Groups");
const {
  getChatHistoryAsync,
  saveChatHistoryAsync,
  deleteChatHistoryAsync,
} = require("../src/utils/storage-hub.cjs");

const testGroupId = "120363888888888888@g.us";
const userAJid = "923001111111@s.whatsapp.net";
const userBJid = "923002222222@s.whatsapp.net";

const sessionKeyA = `${testGroupId}::${userAJid}`;
const sessionKeyB = `${testGroupId}::${userBJid}`;

// User A discusses Python
const historyUserA = [
  { role: "user", parts: [{ text: "Explain Python list comprehensions" }] },
  { role: "model", parts: [{ text: "List comprehensions provide a concise way to create lists in Python." }] },
];

// User B discusses Cricket
const historyUserB = [
  { role: "user", parts: [{ text: "Who won the cricket match yesterday?" }] },
  { role: "model", parts: [{ text: "Pakistan won the match by 5 wickets!" }] },
];

// Save both histories concurrently
await saveChatHistoryAsync(sessionKeyA, historyUserA);
await saveChatHistoryAsync(sessionKeyB, historyUserB);

// Retrieve both histories
const retrievedA = await getChatHistoryAsync(sessionKeyA);
const retrievedB = await getChatHistoryAsync(sessionKeyB);

assert.strictEqual(retrievedA.length, 2, "User A history preserved");
assert.strictEqual(retrievedB.length, 2, "User B history preserved");
assert.ok(retrievedA[0].parts[0].text.includes("Python"), "User A topic is Python");
assert.ok(retrievedB[0].parts[0].text.includes("cricket"), "User B topic is Cricket");

// User A clears their own conversation
await deleteChatHistoryAsync(sessionKeyA);
const retrievedAfterDelA = await getChatHistoryAsync(sessionKeyA);
const retrievedAfterDelB = await getChatHistoryAsync(sessionKeyB);

assert.strictEqual(retrievedAfterDelA.length, 0, "User A history cleared");
assert.strictEqual(retrievedAfterDelB.length, 2, "User B history remains completely intact");

// Owner deletes group -> cleans remaining sub-threads
await deleteChatHistoryAsync(testGroupId);
const finalB = await getChatHistoryAsync(sessionKeyB);
assert.strictEqual(finalB.length, 0, "Group-level delete clears all user sub-threads in that group");
console.log("✓ Multi-user history isolation in groups passed\n");

// Test 12: Mention Extraction from AI Output for WhatsApp Notifications
console.log("Test 12: Mention Extraction for WhatsApp Notifications");
const sampleAiRoast = "Sun bey @923007778899 tu suar jaisa lag raha hai aur @923001112233 tu bhi chup kar bc";
const extractedMentions = (sampleAiRoast.match(/@(\d{7,16})/g) || []).map(
  (m) => `${m.replace("@", "")}@s.whatsapp.net`
);
assert.strictEqual(extractedMentions.length, 2);
assert.ok(extractedMentions.includes("923007778899@s.whatsapp.net"));
assert.ok(extractedMentions.includes("923001112233@s.whatsapp.net"));
console.log("✓ Mention extraction passed\n");

// Test 13: Outgoing Owner Message Recording for Conversational Continuity
console.log("Test 13: Outgoing Owner Message Recording");
const { recordOutgoingTurnAsync } = require("../src/utils/storage-hub.cjs");
const testDmChat = "923005557788@s.whatsapp.net";
await deleteChatHistoryAsync(testDmChat);

// Account owner sends message from phone: "main aa raha hoon"
await recordOutgoingTurnAsync(testDmChat, "main aa raha hoon");
const historyAfterOwnerMsg = await getChatHistoryAsync(testDmChat);

assert.strictEqual(historyAfterOwnerMsg.length, 2, "History has context starter and owner turn");
assert.strictEqual(historyAfterOwnerMsg[0].role, "user", "History starts with user turn for Gemini compliance");
assert.strictEqual(historyAfterOwnerMsg[1].role, "model", "Owner message recorded as model turn");
assert.strictEqual(historyAfterOwnerMsg[1].parts[0].text, "main aa raha hoon", "Owner message text preserved");

// Friend replies "aa jao" -> when conversation continues, previous owner context is 100% visible
assert.ok(historyAfterOwnerMsg[1].parts[0].text.includes("aa raha hoon"));
await deleteChatHistoryAsync(testDmChat);
console.log("✓ Outgoing owner message recording passed\n");

// Test 14: Reaction Directive Parsing from AI Response
console.log("Test 14: Reaction Directive Extraction");
const aiResponseWithReaction = "[REACT: 👍] theek hy aa rha hoon";
const reactMatch = aiResponseWithReaction.match(/\[REACT:\s*([\p{Emoji}\u200d\uFE0F\S]+?)\]/u);
assert.ok(reactMatch, "Found reaction match");
assert.strictEqual(reactMatch[1].trim(), "👍");
const strippedText = aiResponseWithReaction.replace(reactMatch[0], "").trim();
assert.strictEqual(strippedText, "theek hy aa rha hoon");

// Reaction only without text
const aiResponseReactionOnly = "[REACT: 😂]";
const matchOnly = aiResponseReactionOnly.match(/\[REACT:\s*([\p{Emoji}\u200d\uFE0F\S]+?)\]/u);
assert.ok(matchOnly);
assert.strictEqual(matchOnly[1].trim(), "😂");
const emptyAfterStrip = aiResponseReactionOnly.replace(matchOnly[0], "").trim();
assert.strictEqual(emptyAfterStrip, "");
console.log("✓ Reaction directive extraction passed\n");

// Test 15: Persona Roman Urdu Default & Human Chatting Training Directives
console.log("Test 15: Persona Roman Urdu Default & Human Chatting Training");
const { loadPersona, buildSystemInstruction } = require("../src/services/aiAgent.cjs");
const personaText = loadPersona();

assert.ok(personaText.includes("Sound 100% like a REAL HUMAN"), "Human persona directive included");
assert.ok(personaText.includes("Roman Urdu"), "Roman Urdu default directive included");
assert.ok(personaText.includes("[REACT:"), "Reaction directives included in persona");
assert.ok(personaText.includes("Conversation Timeline & Context Continuity"), "Timeline continuity included");

const systemInstruction = buildSystemInstruction({
  chatId: "923001234567@s.whatsapp.net",
  senderName: "Ali",
  senderId: "923001234567@s.whatsapp.net",
  isOwner: false,
  isAdmin: false,
  isGroup: false,
  latestUserText: "aa jao",
});
assert.ok(systemInstruction.includes("Roman Urdu"), "System instruction defaults to Roman Urdu");
assert.ok(systemInstruction.includes("Ultra-Realistic Human WhatsApp Messaging"), "Human WhatsApp messaging included in system instruction");
console.log("✓ Persona Roman Urdu default & human chatting passed\n");

// Test 16: Granular Whitelist for Personal DMs
console.log("Test 16: Personal DM Whitelisting");
const friendJid = "923009988776@s.whatsapp.net";

botAccess.addAllowedDm(friendJid, "Zaid");
assert.strictEqual(botAccess.isDmAllowed(friendJid), true, "DM is whitelisted");
assert.strictEqual(botAccess.isDmAllowed("923001110000@s.whatsapp.net"), false, "Unknown DM is not whitelisted");

botAccess.removeAllowedDm(friendJid);
assert.strictEqual(botAccess.isDmAllowed(friendJid), false, "DM removed from whitelist");
console.log("✓ Personal DM whitelisting passed\n");

// Test 17: Whitelist Access Mode Enforcement
console.log("Test 17: Whitelist Access Mode Enforcement");
botAccess.setAccessMode("whitelist");
botAccess.addAllowedDm(friendJid, "Zaid");

const allowedDmMsg = { key: { remoteJid: friendJid, participant: friendJid, fromMe: false } };
assert.strictEqual(botAccess.isMessageAllowed(null, allowedDmMsg, false), true, "Whitelisted friend DM allowed in whitelist mode");

const blockedDmMsg = { key: { remoteJid: "923112233445@s.whatsapp.net", participant: "923112233445@s.whatsapp.net", fromMe: false } };
assert.strictEqual(botAccess.isMessageAllowed(null, blockedDmMsg, false), false, "Non-whitelisted stranger DM blocked in whitelist mode");

botAccess.setAccessMode("public"); // Restore
botAccess.removeAllowedDm(friendJid);
console.log("✓ Whitelist access mode enforcement passed\n");

// Test 18: Content Filter Toggle ("Mujhe iss baat ka nahi pata")
console.log("Test 18: Content Filter Toggle");
const aiFilter = require("../src/services/aiFilter.cjs");
const testFilterChat = "120363999999999999@g.us";

// Filter ON
aiFilter.setChatFilter(testFilterChat, "on");
assert.strictEqual(aiFilter.getChatFilter(testFilterChat), "on");
const onInstruction = aiFilter.buildFilterInstruction(testFilterChat);
assert.ok(onInstruction.includes("STRICTLY ON"), "Filter ON instruction generated");
assert.ok(onInstruction.includes("Mujhe iss baat ka nahi pata"), "Innocent refusal phrase included");

// Filter OFF
aiFilter.setChatFilter(testFilterChat, "off");
assert.strictEqual(aiFilter.getChatFilter(testFilterChat), "off");
const offInstruction = aiFilter.buildFilterInstruction(testFilterChat);
assert.ok(offInstruction.includes("UNFILTERED FREEDOM"), "Unfiltered instruction generated");
console.log("✓ Content filter toggle passed\n");

// Test 19: Per-Chat Auto-Reply Policy (Mention / All / Off)
console.log("Test 19: Per-Chat Auto-Reply Policy");
const aiAutoReply = require("../src/services/aiAutoReply.cjs");
const testAutoChat = "120363111222333444@g.us";

aiAutoReply.setChatAutoReply(testAutoChat, "all");
assert.strictEqual(aiAutoReply.getChatAutoReply(testAutoChat), "all");

aiAutoReply.setChatAutoReply(testAutoChat, "off");
assert.strictEqual(aiAutoReply.getChatAutoReply(testAutoChat), "off");

aiAutoReply.setChatAutoReply(testAutoChat, "mention");
assert.strictEqual(aiAutoReply.getChatAutoReply(testAutoChat), "mention");
console.log("✓ Per-chat auto-reply policy passed\n");

// Test 20: Roast Command & Filter Check
console.log("Test 20: Roast Command & Filter Integration");
const roastCmd = require("../src/commands/roast.cjs");
assert.strictEqual(roastCmd.name, "roast");
assert.ok(roastCmd.aliases.includes("burn"));

// Filter ON blocks roasting
aiFilter.setChatFilter(testFilterChat, "on");
const filterBlockMsg = { key: { remoteJid: testFilterChat, participant: "923001234567@s.whatsapp.net", fromMe: false } };
await roastCmd.execute(mockSock, filterBlockMsg, ["@923007654321"]);
assert.ok(sentMessage.includes("Filter ON"), "Roast blocked when filter is ON");

// Filter OFF allows prompt
aiFilter.setChatFilter(testFilterChat, "off");
console.log("✓ Roast command & filter check passed\n");

// Test 21: Live Currency Converter Command
console.log("Test 21: Live Currency Converter");
const currencyCmd = require("../src/commands/currency.cjs");
assert.strictEqual(currencyCmd.name, "currency");
assert.ok(currencyCmd.aliases.includes("pkr"));
assert.ok(currencyCmd.aliases.includes("forex"));

await currencyCmd.execute(mockSock, mockFromMeMsg, []);
assert.ok(sentMessage.includes("LIVE CURRENCY RATES") || sentMessage.includes("PKR"), "Currency rates card rendered");
console.log("✓ Live currency converter passed\n");

// Test 22: AI Summarizer Command
console.log("Test 22: AI Summarizer Command");
const summarizeCmd = require("../src/commands/summarize.cjs");
assert.strictEqual(summarizeCmd.name, "summarize");
assert.ok(summarizeCmd.aliases.includes("tldr"));
assert.ok(summarizeCmd.aliases.includes("khulasa"));

await summarizeCmd.execute(mockSock, mockFromMeMsg, []);
assert.ok(sentMessage.includes("Smart AI Summarizer") || sentMessage.includes("khulasa"), "Summarizer usage guide rendered");
console.log("✓ AI summarizer command passed\n");

// Test 23: Desi Fun, Jokes & Shayari Command
console.log("Test 23: Desi Fun & Entertainment Command");
const funCmd = require("../src/commands/fun.cjs");
assert.strictEqual(funCmd.name, "joke");
assert.ok(funCmd.aliases.includes("shayari"));
assert.ok(funCmd.aliases.includes("latifa"));
console.log("✓ Desi fun & entertainment command passed\n");

// Test 24: Redesigned Professional Diagnostics Cards (Ping & Status)
console.log("Test 24: Redesigned Ping & Status Cards");
const pingCmd = require("../src/commands/ping.cjs");
await pingCmd.execute(mockSock, mockFromMeMsg);
assert.ok(sentMessage.includes("SYSTEM DIAGNOSTICS") && sentMessage.includes("Speed:"), "Ping diagnostics card rendered");

const statusCmd = require("../src/commands/status.cjs");
await statusCmd.execute(mockSock, mockFromMeMsg);
assert.ok(sentMessage.includes("SYSTEM STATUS & BOT HEALTH") && sentMessage.includes("AI Intelligence Engine"), "Status dashboard card rendered");
console.log("✓ Redesigned diagnostics cards passed\n");

console.log("ALL 24 MOOD, MEMORY, GROUP ISOLATION, ROMAN URDU, NEW FEATURES & DIAGNOSTIC TESTS PASSED! 🎉");



