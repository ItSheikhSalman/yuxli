const store = require("../db/store.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const scope = require("./workspaceScope.cjs");
const signals = require("./intelligence/signals.cjs");

const MODES = Object.freeze({
  auto: {
    id: "auto", label: "Dynamic / Auto", emoji: "🎭",
    description: { en: "Adapts cautiously to the current task and conversational signals.", ur: "Baat ke mutabiq lehja badalta hai.", ar: "يتكيف بحذر مع موضوع الحوار." },
    instruction: "Adapt to the task. Treat inferred emotion as uncertain, not a fact.",
  },
  roast: {
    id: "roast", label: "Consensual Banter", emoji: "🙂",
    description: { en: "Light teasing only with the target's consent.", ur: "Sirf razamandi se halka phulka mazak.", ar: "مزاح لطيف بموافقة الشخص فقط." },
    instruction: "Use light humor only with explicit target consent. Never target protected traits, threaten, humiliate, or reveal private information. Individual opt-out overrides this mode.",
  },
  happy: {
    id: "happy", label: "Happy / Cheerful", emoji: "😊",
    description: { en: "Warm, cheerful and encouraging.", ur: "Khush mizaj aur hosla afzai.", ar: "ودود ومشجع ومتفائل." },
    instruction: "Be warm and encouraging without forced positivity about serious problems.",
  },
  serious: {
    id: "serious", label: "Professional", emoji: "📚",
    description: { en: "Precise, thoughtful and professional.", ur: "Sanjida aur seedhi kaam ki baat.", ar: "دقيق ومنظم ومهني." },
    instruction: "Give precise, grounded explanations. Do not invent credentials or verified facts.",
  },
  empathetic: {
    id: "empathetic", label: "Empathetic / Caring", emoji: "🤝",
    description: { en: "Gentle, supportive and attentive.", ur: "Hamdard aur tawajjo dene wala.", ar: "لطيف وداعم ومتفهم." },
    instruction: "Acknowledge difficulty and offer practical support without claiming human experiences.",
  },
  dramatic: {
    id: "dramatic", label: "Dramatic / Playful", emoji: "🎭",
    description: { en: "Playful flair when appropriate.", ur: "Munasib waqt par filmi andaz.", ar: "أسلوب مرح عندما يناسب الموقف." },
    instruction: "Use playful theatrical language only on light topics. Avoid sarcasm in distress or conflict.",
  },
});

const ALIAS_MAP = Object.freeze(Object.fromEntries([
  ["auto", ["auto", "dynamic", "default", "reset", "normal", "تلقائي", "آٹو"]],
  ["roast", ["roast", "roasting", "savage", "funny", "burn", "روسٹ", "قصف"]],
  ["happy", ["happy", "cheerful", "joy", "friendly", "khush", "خوش", "سعيد"]],
  ["serious", ["serious", "genius", "pro", "smart", "intellectual", "سنجیدہ", "ذہین", "ذكي"]],
  ["empathetic", ["empathetic", "caring", "supportive", "sad", "comfort", "ہمدرد", "تعاطف"]],
  ["dramatic", ["dramatic", "sassy", "bossy", "drama", "ڈرامائی", "دراما"]],
].flatMap(([mode, aliases]) => aliases.map((alias) => [alias, mode]))));

function normalizeMode(value) {
  return ALIAS_MAP[String(value || "").trim().toLowerCase()] || null;
}

function getChatMode(chatId, senderId = null) {
  scope.assertChat(chatId);
  const normalized = normalizeJid(chatId);
  const personal = senderId && store.getBotSetting(`ai_mode:${normalized}::${normalizeJid(senderId)}`);
  const saved = personal || store.getBotSetting(`ai_mode:${normalized}`) || store.getBotSetting("ai_default_mode", "auto");
  return MODES[saved] ? saved : "auto";
}

function setChatMode(chatId, mode) {
  scope.assertChat(chatId);
  const resolved = normalizeMode(mode) || "auto";
  store.saveBotSetting(`ai_mode:${normalizeJid(chatId)}`, resolved);
  return resolved;
}

function resetChatMode(chatId) {
  scope.assertChat(chatId);
  store.deleteBotSetting(`ai_mode:${normalizeJid(chatId)}`);
  return getChatMode(chatId);
}

function detectElderRelationship(options = {}, text = "") {
  const name = String(options.senderName || "");
  const match = name.match(/\b(mami|mamee|mammy|mamoo|mamu|chachi|chacha|chachu|taya|tai|khala|khaloo|khalu|phuppo|phupho|phupo|phupha|ammi|ami|abu|abbu|baba|papa|dada|dadi|nana|nani|aunty|auntie|uncle|sir|madam|teacher|ustad|baji|aapi)\b/i);
  const cue = /\b(beta|betay|bachay|mobile\s*gugu|gugu\s*kay\s*pas)\b/i.test(text);
  return { isElder: Boolean(match || cue), title: match ? match[1][0].toUpperCase() + match[1].slice(1) : cue ? "Respected recipient" : null, confidence: "heuristic" };
}

function detectExpressionCue(text, options = {}) {
  if (typeof text !== "string" || !text || detectElderRelationship(options, text).isElder) return null;
  const signal = signals.analyze(text);
  if (signal.conflict || /\b(suar|kuta|kutta|bc|bsdk|dala|bitch|fuck|harami|kamina|gussa|bakwas)\b/i.test(text)) {
    return { modeHint: "calm", isAnger: true, confidence: "heuristic", reason: "Possible frustration; de-escalate." };
  }
  if (signal.sensitive || /\b(heartbroken|bohot udas|dil toot|pareshan)\b/i.test(text)) {
    return { modeHint: "empathetic", confidence: "heuristic" };
  }
  if (signal.roast || /\b(savage reply|burn me)\b/i.test(text)) return { modeHint: "roast", isAnger: false, confidence: "heuristic" };
  if (/\b(urgent|asap|jaldi|fatafat|hurry|quick|immediately)\b/i.test(text)) return { modeHint: "urgent", confidence: "heuristic" };
  if (/\b(love you|love u|meri jaan|cutie|sweetheart|marry me)\b|[❤😘]/u.test(text)) return { modeHint: "flirt", confidence: "heuristic" };
  if (/\b(happy|celebrating|awesome|yay|alhamdulillah|won|got the job|mubarak|khush)\b|[🎉🥳]/u.test(text)) return { modeHint: "happy", confidence: "heuristic" };
  return null;
}

function buildMoodPrompt(chatId, latestUserText = "", options = {}) {
  const mode = getChatMode(chatId, options.senderId);
  const cue = detectExpressionCue(latestUserText, options);
  const elder = detectElderRelationship(options, latestUserText);
  return [
    "## AI Personality & Adaptive Mood Engine",
    MODES[mode].instruction,
    "You are an AI assistant, not the account owner or a human participant. Never claim to have eaten, travelled, or performed an action you did not perform.",
    "Use natural Roman Urdu when appropriate and match the user's language. Casual replies can be 1-2 short sentences; expand for education, accuracy, or safety.",
    "Use only the current authorized conversation history for continuity; do not invent missing events or schedules. Keep unrelated participants' topics separate.",
    "Emotional and relationship signals are uncertain inferences. Do not diagnose or assert a relationship as fact.",
    elder.isElder ? 'RESPECTFUL RECIPIENT: Use Aap or Ji. Avoid "bhai", sarcasm and teasing; do not assume a family relationship.' : "",
    cue?.isAnger ? "CALM DE-ESCALATION: Acknowledge the practical issue. Never answer anger with insults or retaliatory roasting." : "",
    cue?.modeHint === "empathetic" ? "SUPPORTIVE: Avoid jokes and offer useful next steps. Urgent safety information must not be shortened away." : "",
    cue?.modeHint === "urgent" ? "Be direct; retain essential safety and factual detail." : "",
    cue?.modeHint === "happy" ? "A brief warm acknowledgment may be enough." : "",
    "CONSENSUAL BANTER: A requester cannot consent for somebody else. Group membership, mentions and rude language are not consent. Respect every individual opt-out; never use memories for jokes.",
    options.isGroup ? "Group Conversation & Individual User Topic Continuity: Answer only the invited thread; do not reveal private or global memory." : "",
  ].filter(Boolean).join("\n");
}

module.exports = { MODES, ALIAS_MAP, normalizeMode, getChatMode, setChatMode, resetChatMode, detectElderRelationship, detectExpressionCue, buildMoodPrompt };
