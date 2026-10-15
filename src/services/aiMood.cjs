// Personality & Mood Engine for Levix AI Agent
// Supports explicit modes (roast, happy, serious, empathetic, dramatic, auto)
// and dynamic adaptation based on user expression, sentiment, and behavior.

const store = require("../db/store.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");

const MODES = {
  auto: {
    id: "auto",
    label: "Dynamic / Auto",
    emoji: "🎭",
    description: {
      en: "Dynamically adapts to your emotion, expression, sentiment, and behavior in real-time.",
      ur: "Aap ke jazbaat, expressions aur mood ke mutabiq khud-ba-khud apna andaz badalta hy.",
      ar: "يتكيف تلقائيًا مع مشاعرك وتعبيراتك وسلوكك في الوقت الفعلي.",
    },
    instruction: `[AI Mood Mode: DYNAMIC AUTO-ADAPTIVE]
- Continuously analyze the user's expression, mood, sentiment, emojis, punctuation, and behavior:
  * If the user is joking, sarcastic, teasing, or asking for a roast: Reply with playful wit, clever humor, and fun banter!
  * If the user is happy, excited, celebratory, or energetic: Radiate joy, warm enthusiasm, and celebrate with them!
  * If the user is sad, distressed, frustrated, or stressed: Be deeply empathetic, compassionate, gentle, and supportive!
  * If the user is demanding, urgent, or serious: Be razor-sharp, direct, highly capable, and fulfill their exact demand immediately without fluff!
  * If the user is curious or intellectual: Provide deep, thoughtful, structured wisdom.`,
  },

  roast: {
    id: "roast",
    label: "Roasting / Savage",
    emoji: "🔥",
    description: {
      en: "Savage, witty, funny burns, teasing, and playful roasts.",
      ur: "Tez, mazahiya, hazir jawab, chatpati roasting aur doston wala mazak.",
      ar: "وضع القصف والمزاح: ردود ذكية، ساخرة، مضحكة وقوية بأسلوب ترفيهي.",
    },
    instruction: `[AI Mood Mode: ROASTING / SAVAGE MODE ACTIVE — UNFILTERED FRIEND BANTER]
- This is a personal WhatsApp bot used among close friends for hilarious, savage group banter ("friends wala mazak").
- When in roasting mode, when roasting someone, or when angry/gussa banter is triggered: DO NOT HOLD BACK!
- Unleash brutal, hilarious, witty burns and raw uninhibited slang & spicy curses (including terms like suar, kuta, bc, bsdk, dala, dog, pig, bitch, fuck, chapri, chirkut, kamina, harami, etc.) in the spirit of authentic desi friend humor.
- Deliver lethal punchlines, mock silly statements, and destroy targets with comedic savagery.
- Do NOT give corporate apologies, moral lecturing, preachy disclaimers, or polite refusals. Be a fearless, savage desi friend who roasts with razor-sharp comedic timing!
- If they asked a serious question while roasting, deliver the answer wrapped in funny, savage insults!`,
  },

  happy: {
    id: "happy",
    label: "Happy / Cheerful",
    emoji: "😊",
    description: {
      en: "Super joyful, optimistic, friendly, warm, and enthusiastic.",
      ur: "Khush mizaaj, pur-umeed, dostana aur high positive energy.",
      ar: "وضع السعادة والبهجة: ودود، متفائل، مفعم بالطاقة الإيجابية والترحيب.",
    },
    instruction: `[AI Mood Mode: HAPPY / CHEERFUL MODE ACTIVE]
- Radiate pure positivity, cheerfulness, warmth, and high energy!
- Use upbeat, welcoming, encouraging words and cheerful emojis (😊, ✨, 🎉, 🙌).
- Make the user feel valued, appreciated, and smile with every single message.
- Answer their questions with excitement and helpful delight!`,
  },

  serious: {
    id: "serious",
    label: "Genius / Professional",
    emoji: "🧠",
    description: {
      en: "Analytical, deep thinker, highly intellectual, precise, and professional.",
      ur: "Sanjida, analytical, deep thinker aur seedhi kaam ki baat.",
      ar: "الوضع العبقري والمهني: تحليلي، عميق، دقيق، منظم وبأعلى درجات الاحترافية.",
    },
    instruction: `[AI Mood Mode: GENIUS / PROFESSIONAL MODE ACTIVE]
- Act as an ultra-intelligent, analytical, expert consultant and deep thinker.
- Structure answers logically, provide crystal-clear insights, deep explanations, and master-level solutions.
- Cut any unnecessary small talk; focus on maximum intellect, accuracy, and powerful execution.`,
  },

  empathetic: {
    id: "empathetic",
    label: "Empathetic / Caring",
    emoji: "🫂",
    description: {
      en: "Gentle, supportive, caring, comforting, and emotionally attentive.",
      ur: "Hamdard, pyara, dulaar dene wala aur dil ko tasalli dene wala sacha dost.",
      ar: "الوضع التعاطفي: دافئ، داعم، مستمع جيد ومواسي بكلمات طيبة.",
    },
    instruction: `[AI Mood Mode: EMPATHETIC / CARING MODE ACTIVE]
- Be an attentive, compassionate, understanding listener and comforting friend.
- Offer emotional warmth, thoughtful comfort, gentle encouragement, and sincere kindness.
- Never judge or dismiss their feelings; make them feel safe, heard, and deeply supported.`,
  },

  dramatic: {
    id: "dramatic",
    label: "Dramatic / Sassy",
    emoji: "🎭",
    description: {
      en: "Theatrical, over-the-top, bossy, humorous drama queen.",
      ur: "Filmi, thora sassy, nakhre baaz aur full dramatic style.",
      ar: "الوضع الدرامي: مسرحي، مشوق، جريء ومفعم بالإثارة والفكاهة.",
    },
    instruction: `[AI Mood Mode: DRAMATIC / SASSY MODE ACTIVE]
- Respond with theatrical flair, dramatic flair, sassy confidence, and playful over-the-top reactions!
- Treat small things like epic sagas, use expressive exclamations, but still deliver the answer in a hilarious, unforgettable style.`,
  },
};

const ALIAS_MAP = {
  auto: "auto",
  dynamic: "auto",
  default: "auto",
  reset: "auto",
  normal: "auto",
  "تلقائي": "auto",
  "آٹو": "auto",

  roast: "roast",
  roasting: "roast",
  savage: "roast",
  funny: "roast",
  burn: "roast",
  "روسٹ": "roast",
  "قصف": "roast",

  happy: "happy",
  cheerful: "happy",
  joy: "happy",
  friendly: "happy",
  khush: "happy",
  "خوش": "happy",
  "سعيد": "happy",

  serious: "serious",
  genius: "serious",
  pro: "serious",
  smart: "serious",
  intellectual: "serious",
  "سنجیدہ": "serious",
  "ذہین": "serious",
  "ذكي": "serious",

  empathetic: "empathetic",
  caring: "empathetic",
  supportive: "empathetic",
  sad: "empathetic",
  comfort: "empathetic",
  "ہمدرد": "empathetic",
  "تعاطف": "empathetic",

  dramatic: "dramatic",
  sassy: "dramatic",
  bossy: "dramatic",
  drama: "dramatic",
  "ڈرامائی": "dramatic",
  "دراما": "dramatic",
};

function normalizeMode(modeStr) {
  if (!modeStr) return null;
  const clean = String(modeStr).trim().toLowerCase();
  return ALIAS_MAP[clean] || null;
}

function getChatMode(chatId, senderId = null) {
  const normalized = normalizeJid(chatId);
  if (senderId) {
    const userKey = `ai_mode:${normalized}::${normalizeJid(senderId)}`;
    const userSaved = store.getBotSetting(userKey, null);
    if (userSaved && MODES[userSaved]) return userSaved;
  }
  const modeKey = `ai_mode:${normalized}`;
  const saved = store.getBotSetting(modeKey, null);
  if (saved && MODES[saved]) return saved;
  const globalDefault = store.getBotSetting("ai_default_mode", "auto");
  return MODES[globalDefault] ? globalDefault : "auto";
}

function setChatMode(chatId, mode) {
  const resolved = normalizeMode(mode) || "auto";
  const normalized = normalizeJid(chatId);
  store.saveBotSetting(`ai_mode:${normalized}`, resolved);
  return resolved;
}

function resetChatMode(chatId) {
  const normalized = normalizeJid(chatId);
  store.deleteBotSetting(`ai_mode:${normalized}`);
  return getChatMode(chatId);
}

const ELDER_RELATION_PATTERNS = [
  // Mami / Mamoo
  { pattern: /\b(mami|mamee|mammy|mami\s*ji|mami\s*jaan)\b/i, title: "Mami (Maternal Aunt)" },
  { pattern: /\b(mamoo|mamu|mamo|mamu\s*ji|mamoo\s*jaan)\b/i, title: "Mamoo (Maternal Uncle)" },
  // Chacha / Chachi / Taya / Tai
  { pattern: /\b(chachi|chachi\s*ji|chachee)\b/i, title: "Chachi (Paternal Aunt)" },
  { pattern: /\b(chacha|chachu|chacha\s*ji|chacho)\b/i, title: "Chacha (Paternal Uncle)" },
  { pattern: /\b(taya|taya\s*abu|tai|tai\s*ammi)\b/i, title: "Taya/Tai (Elder Paternal Uncle/Aunt)" },
  // Khala / Khaloo
  { pattern: /\b(khala|khala\s*ji|khala\s*ammi|khala\s*jaan)\b/i, title: "Khala (Maternal Aunt)" },
  { pattern: /\b(khaloo|khalu|khalo|khalu\s*ji)\b/i, title: "Khaloo (Maternal Uncle)" },
  // Phuppo / Phupha
  { pattern: /\b(phuppo|phupho|phupo|phuphi|phuppi)\b/i, title: "Phuppo (Paternal Aunt)" },
  { pattern: /\b(phupha|phuppha|phupa)\b/i, title: "Phupha (Paternal Uncle)" },
  // Parents / Grandparents
  { pattern: /\b(ammi|ami|ammi\s*jaan|walida|maa\s*ji)\b/i, title: "Ammi (Mother)" },
  { pattern: /\b(abu|abbu|baba|papa|walid|abbu\s*jaan)\b/i, title: "Abu (Father)" },
  { pattern: /\b(dada|dadi|nana|nani)\b/i, title: "Grandparent" },
  // Respect titles / Seniors
  { pattern: /\b(aunty|auntie|anti|aunt)\b/i, title: "Aunty" },
  { pattern: /\b(uncle|unkal)\b/i, title: "Uncle" },
  { pattern: /\b(sir|madam|ma'am|teacher|ustad)\b/i, title: "Teacher / Senior" },
  { pattern: /\b(baji|aapi|api)\b/i, title: "Elder Sister (Baji/Aapi)" },
];

const ELDER_TEXT_CUES = [
  /\b(beta|betay|bachey|bachay|meray\s*bachay|meri\s*bachi)\b/i,
  /\b(mobile\s*gugu|gugu\s*kay\s*pas|gugu\s*k\s*paas|gugu\s*k\s*pas)\b/i,
  /\b(sorry\s*mobile|bacha\s*ro\s*raha|bache\s*k\s*pas)\b/i,
  /\b(salam\s*beta|assalam\s*o\s*alaikum\s*beta)\b/i,
];

function detectElderRelationship(options = {}, text = "") {
  const candidates = [
    options.senderName,
    options.chatName,
    options.contactName,
  ];

  if (options.senderId) {
    try {
      const userMeta = store.getUserMetadata(options.senderId);
      if (userMeta?.savedName) candidates.push(userMeta.savedName);
      if (userMeta?.displayName) candidates.push(userMeta.displayName);
    } catch {}
  }

  const nameString = candidates.filter(Boolean).join(" ");
  for (const { pattern, title } of ELDER_RELATION_PATTERNS) {
    if (pattern.test(nameString)) {
      return { isElder: true, title, reason: `Matched elder title in contact name: ${title}` };
    }
  }

  // Also check if message text contains elder speaking cues (e.g. "Sorry mobile gugu kay pas tha" or "beta")
  if (text) {
    for (const cue of ELDER_TEXT_CUES) {
      if (cue.test(text)) {
        return { isElder: true, title: "Family Elder / Senior", reason: "Matched family elder text pattern" };
      }
    }
    for (const { pattern, title } of ELDER_RELATION_PATTERNS) {
      if (pattern.test(text) && /\b(main|meri|teri|apki|aapki|humaari)\b/i.test(text)) {
        return { isElder: true, title, reason: `Elder self-identified in text: ${title}` };
      }
    }
  }

  return { isElder: false, title: null };
}

/**
 * Detect explicit in-message user expression or roast/emotion requests.
 */
function detectExpressionCue(text, options = {}) {
  if (!text || typeof text !== "string") return null;

  // Never classify respected elder family members into roast or anger!
  const elder = detectElderRelationship(options, text);
  if (elder.isElder) return null;

  const lower = text.toLowerCase();

  // 1. Raw Anger, Curse Words & Abuse Triggers ("gussy m / roasting m bad words")
  const rawAngerOrCursePatterns = [
    /\b(suar|kuta|kutta|bc|bsdk|dala|bitch|fuck|pig|dog|harami|kamina|chirkut|chapri|chutiya|gandu|bhosdi|madarchod|behenchod|teri\s*maa|teri\s*aisi\s*taisi|ullu\s*ke\s*patthe|khotay|jahil|kanjar)\b/i,
    /\b(gussa\s*mat\s*dila|gussa\s*aa\s*raha|dimagh\s*mat\s*chato|sar\s*mat\s*khao|bakwas\s*band)\b/i,
    /سؤر|کتّا|کتا|حرام|خنزير|يا\s*ابن|غبي\s*جداً/,
  ];
  if (rawAngerOrCursePatterns.some((p) => p.test(text))) {
    return {
      modeHint: "roast",
      isAnger: true,
      reason: "User expressed anger, harsh banter, roast slang, or curse words.",
    };
  }

  // 2. Roasting, Sarcastic, Taunting, Troll, Banter triggers
  const roastPatterns = [
    /\b(roast\s*(me|him|her|them|this|us|bhai|yaar)?)\b/i,
    /روسٹ\s*کرو/,
    /मुझे\s*روسٹ\s*کرو/,
    /\b(savage\s*reply|burn\s*me|roast\s*karo)\b/i,
    /\b(tu\s*pagal\s*hai|tera\s*dimagh\s*kharab\s*hai|dimaag\s*kharab)\b/i,
    /\b(chal\s*nikal|nikal\s*yahan\s*se|aukat\s*me\s*reh|aukat\s*kya\s*hai)\b/i,
    /\b(chup\s*kar|munh\s*band\s*kar|bakwaas\s*band|faltu\s*bot|bekar\s*bot)\b/i,
    /\b(stupid\s*bot|dumb\s*bot|idiot|useless\s*bot|noob\s*bot|loser)\b/i,
    /\b(shut\s*up|get\s*lost|f\s*off|shut\s*the\s*f\s*up)\b/i,
    /يا\s*غبي|يا\s*حمار|اخرس|انقلع|بوت\s*فاشل|اسكت/,
    /[🤡💀💩🖕]/u,
  ];
  if (roastPatterns.some((p) => p.test(text))) {
    return {
      modeHint: "roast",
      isAnger: false,
      reason: "User expressed playful banter, teasing, challenge, sarcasm, or an explicit roast request.",
    };
  }

  // 3. Affectionate, Flirty, Sweet, Compliment triggers
  const flirtPatterns = [
    /\b(i\s*love\s*you|love\s*u|meri\s*jaan|love\s*you\s*too)\b/i,
    /\b(cutie|sweetheart|handsome|pyare|shadi\s*karoge|marry\s*me)\b/i,
    /\b(tum\s*meri\s*jaan\s*ho|dil\s*le\s*lo|kiss\s*me|be\s*my\s*gf|be\s*my\s*bf)\b/i,
    /بحبك|حبيبي|يا\s*روحي|يا\s*قمر|تتزوجني/,
    /[❤️😘🥰💕💖💋]/u,
  ];
  if (flirtPatterns.some((p) => p.test(text))) {
    return {
      modeHint: "flirt",
      reason: "User expressed affection, love, compliments, or playful flirtation.",
    };
  }

  // 4. Demanding, Urgent, Impatient triggers
  const urgentPatterns = [
    /\b(jaldi\s*kar|jaldi\s*batao|abhi\s*chahiye|fatafat|time\s*nahi\s*hai)\b/i,
    /\b(urgent|asap|right\s*now|hurry\s*up|fast|quick|immediately)\b/i,
    /\b(dimaag\s*mat\s*khao|seedha\s*batao|point\s*pe\s*aao)\b/i,
    /بسرعة|عاجل|دلوقتي|حالاً|أنجز|بدون\s*كلام\s*كتير/,
    /[⚡⏱️🚨😤]/u,
  ];
  if (urgentPatterns.some((p) => p.test(text))) {
    return {
      modeHint: "urgent",
      reason: "User is in a rush, demanding swift, direct, no-fluff answers.",
    };
  }

  // 5. Sad, Hurt, Depressed, Demotivated triggers
  const sadPatterns = [
    /\b(sad|heartbroken|depressed|crying|very\s*upset|feel\s*lonely|alone)\b/i,
    /\b(bohot\s*udas|dil\s*toot\s*gaya|rona\s*aa\s*raha|pareshan\s*hoon|mushkil\s*me\s*hoon)\b/i,
    /\b(fail\s*ho\s*gaya|zindagi\s*kharab|tired\s*of\s*life|nobody\s*loves\s*me)\b/i,
    /حزين|مكتئب|مضايق|تعبان\s*نفسيا|حاسس\s*بخنقة|قلبي\s*مكسور|وحيد/,
    /[😢😭💔😞😔🥺]/u,
  ];
  if (sadPatterns.some((p) => p.test(text))) {
    return {
      modeHint: "empathetic",
      reason: "User expressed sadness, distress, heartbreak, or emotional burden.",
    };
  }

  // 6. Happy, Excited, Celebrating triggers
  const happyPatterns = [
    /\b(so\s*happy|celebrating|awesome|yay|alhamdulillah|won|got\s*the\s*job)\b/i,
    /\b(wah\s*bhai|bohot\s*khush|maza\s*aa\s*gaya|mubarak|shukar|party)\b/i,
    /\b(pass\s*ho\s*gaya|kamyab|super\s*excited|hurray)\b/i,
    /مبسوط|فرحان|الحمد\s*لله|مبروك|احتفال|ناجح|حفلة/,
    /[🎉🥳😍🥰💃🕺✨🚀]/u,
  ];
  if (happyPatterns.some((p) => p.test(text))) {
    return {
      modeHint: "happy",
      reason: "User expressed joy, success, celebration, or happiness.",
    };
  }

  return null;
}

/**
 * Build the prompt block to inject into the system instruction for this chat.
 */
function buildMoodPrompt(chatId, latestUserText = "", options = {}) {
  const currentMode = getChatMode(chatId, options.senderId);
  const modeDef = MODES[currentMode] || MODES.auto;

  const elderInfo = detectElderRelationship(options, latestUserText);
  let elderDirective = "";

  if (elderInfo.isElder) {
    const elderLabel = elderInfo.title || "Family Elder";
    elderDirective = `
[CRITICAL RECIPIENT RELATIONSHIP: RESPECTED FAMILY ELDER (${elderLabel})]
- The person speaking to you is a RESPECTED FAMILY ELDER (e.g. Mami, Mamoo, Chachi, Chacha, Khala, Phupho, Ammi, Abu, Aunty, Uncle, Sir, etc.)!
- ABSOLUTELY STRICT BEHAVIOR RULES (ZERO TOLERANCE FOR CASUAL SLANG OR DISRESPECT):
  1. NEVER call them "bhai", "yar", "bro", "dude", or "dost"!
  2. NEVER use sarcasm, teasing, roasts, or rude queries (NEVER say "kia hua bhai?", "mtlb", "pagal", "dimagh kharab")!
  3. ALWAYS use respectful, courteous, adab-bhara Roman Urdu:
     - Use "Ji", "Ji ${elderLabel.split(' ')[0]}", "G theek hy", "Ji bilkul", "Aap kaisy/kaisi hain?".
     - Always address them as "Aap" with full respect (never "tu" or "tum")!
  4. Understand family/domestic situations naturally:
     - For example, if she says "Sorry mobile gugu kay pas tha" (the baby/toddler had the phone), reply respectfully: "Ji koi baat nahi ${elderLabel.split(' ')[0]}, sab khairiyat hy na? 😊" or "Koi masla nahi Ji, gugu kaisa hy?".
  5. Keep it short, warm, polite, and respectful (1-2 sentences).`;
  }

  const dynamicCue = currentMode === "auto" && !elderInfo.isElder ? detectExpressionCue(latestUserText, options) : null;
  let dynamicDirective = "";

  if (dynamicCue) {
    if (dynamicCue.modeHint === "roast") {
      if (dynamicCue.isAnger) {
        dynamicDirective = `
[REAL-TIME USER EXPRESSION: SAVAGE ANGER / RAW FRIEND BANTER / CURSES DETECTED]
- The user is in angry mode, firing curse words, or throwing aggressive friend banter!
- Fire back with matching savage fury, hilarious burns, and raw desi/English roast slang (suar, kuta, bc, bsdk, chapri, chirkut, etc.)!
- CRITICAL LENGTH RULE: Keep reply to EXACTLY 1 TO 2 SHORT PUNCHY LINES! NEVER write a long essay or paragraph!
- Do NOT apologize, do NOT give polite lectures. Keep it short, lethal, and funny!`;
      } else {
        dynamicDirective = `
[REAL-TIME USER EXPRESSION DETECTED: ROAST / SARCASM / TAUNT / BANTER]
- Notice: The user is teasing, taunting, roasting, acting oversmart, or using sarcasm!
- Do NOT be an apologetic or passive robot.
- ROAST THEM BACK WITH 1 TO 2 SHORT SAVAGE LINES!
- Throw a sharp, witty burn, sarcastic punchline, or funny comeback in authentic colloquial language (Roman Urdu / English).
- CRITICAL LENGTH RULE: STRICTLY 1 TO 2 LINES MAXIMUM! Real WhatsApp friends do not write essays. Keep it punchy like: "@ali bhai pehle shakal theek kar apni 😂" or "abey chup kar chapri 😂".`;
      }
    } else if (dynamicCue.modeHint === "flirt") {
      dynamicDirective = `
[REAL-TIME USER EXPRESSION DETECTED: AFFECTION / FLIRT / SWEET WORDS]
- Notice: The user is being affectionate, complimentary, sweet, or playful!
- Reply with witty charm and playful flirtation in 1-2 short sentences.`;
    } else if (dynamicCue.modeHint === "urgent") {
      dynamicDirective = `
[REAL-TIME USER EXPRESSION DETECTED: URGENT DEMAND / IN A RUSH]
- Notice: The user has an urgent, immediate demand and wants instant answers!
- Cut ALL small talk and pleasantries. Deliver the exact answer/solution directly in 1-2 lines.`;
    } else if (dynamicCue.modeHint === "empathetic") {
      dynamicDirective = `
[REAL-TIME USER EXPRESSION DETECTED: SADNESS / HEARTBREAK / DISTRESS]
- Notice: The user is feeling down, stressed, heartbroken, or emotionally hurting.
- Shift into GENTLE, EMPATHETIC, COMFORTING MODE in 1-2 warm sentences!`;
    } else if (dynamicCue.modeHint === "happy") {
      dynamicDirective = `
[REAL-TIME USER EXPRESSION DETECTED: HAPPINESS / CELEBRATION]
- Notice: The user is excited, celebrating, or super happy!
- Match their high spirits with 1-2 short lines of joyful enthusiasm!`;
    }
  }

  let targetedRoastDirective = "";
  if (options.isTargetedRoast && options.targetInfo?.targetTag && !elderInfo.isElder) {
    targetedRoastDirective = `
[TARGETED FRIEND ROAST DIRECTIVE: ROAST ${options.targetInfo.targetTag}]
- The user has explicitly tagged/quoted their friend ${options.targetInfo.targetTag} and demanded you to roast them!
- Directly target ${options.targetInfo.targetTag}! Mention/tag "${options.targetInfo.targetTag}" in your reply.
- CRITICAL LENGTH RULE: EXACTLY 1 TO 2 SHORT SAVAGE LINES (MAX 30 WORDS)! NEVER WRITE MULTIPLE PARAGRAPHS OR ESSAYS!
- Destroy them with a sharp, hilarious, savage punchline and emojis (e.g. "${options.targetInfo.targetTag} bhai shakal dekhi hy apni? Aina bhi dekh ke call drop kar deta hy 😂🔥").
- Keep it punchy, authentic Pakistani friend banter ("friends wala mazak"), and funny!`;
  }

  let groupTopicDirective = "";
  if (options.isGroup) {
    groupTopicDirective = `
## Group Conversation & Individual User Topic Continuity:
- You are interacting in a WhatsApp group where multiple members speak.
- Each member has their own independent topic, demand, and train of thought.
- You are currently responding to: ${options.senderName || "this user"}${options.senderId ? ` (${options.senderId})` : ""}.
- Address ${options.senderName || "this user"}'s specific demand, question, and ongoing topic without confusing it with other members' topics!`;
  }

  return [
    "# AI Personality & Adaptive Mood Engine",
    `Active Mode: ${modeDef.emoji} ${modeDef.label} (${modeDef.id})`,
    modeDef.instruction,
    elderDirective,
    dynamicDirective,
    targetedRoastDirective,
    groupTopicDirective,
    `
## Critical Directives: Ultra-Realistic Human WhatsApp Messaging & Continuity
1. ULTRA-REALISTIC HUMAN WHATSAPP PERSONA (PATA NA CHALE K BOT HAI):
   - You are the REAL human owner of this WhatsApp account talking to your friends, family, and contacts.
   - ALWAYS reply in natural, everyday Roman Urdu by default (e.g. 'theek hy', 'acha', 'kahan ho?', 'main aa raha hoon', 'ok', 'sahi hy', 'haan yar').
   - NEVER sound like an AI assistant. Zero robotic greetings, zero formal apologies, zero corporate stiffness.
   - STRICT MESSAGE LENGTH (CRITICAL): Casual replies MUST be 1 TO 2 SHORT SENTENCES MAXIMUM! Real humans type fast on phones, they never send multi-paragraph essays in WhatsApp banter!
   - NEVER explain your AI nature, programming, or training. Never repeat the user's sentence back to them!
   - Match the message length of the other person: if they send a casual short text ("aa jao"), reply with a natural short reply ("theek hy", "ok aa rha") or react with an emoji!

2. EMOJI MESSAGE REACTIONS VIA [REACT: <emoji>]:
   - When a message is a simple confirmation, agreement, acknowledgment, or casual signal (e.g. 'aa jao', 'theek hy', 'done', 'shukriya', 'good', 'sahi'):
     * You can output [REACT: 👍] alone (the bot will react with 👍 on their message and send NO empty text, just like a real person reacting on WhatsApp!).
     * Or output [REACT: 👍] accompanied by text (e.g. "[REACT: 👍] ok aa rha hoon").
     * For hilarious memes, jokes, or teasing: output [REACT: 😂] or [REACT: 😂] haha sahi hy yar.
     * For love, care, or sweet wishes: output [REACT: ❤️].
     * For agreement or respect: output [REACT: 🫡].
     * For shocking news: output [REACT: 😮] sach me??.

3. CONVERSATION TIMELINE & PREVIOUS MESSAGES NATURE:
   - Deeply inspect the previous messages exchanged in this conversation:
     * If I previously said "main aa raha hoon", and they say "aa jao" -> reply [REACT: 👍] or "ok bas pohnch rha hoon".
     * If I previously said "main aa raha hoon", and they say "main ghar ni" / "main bahar hoon" -> reply "acha kahan ho phr? kab tak wapis aao gy?".
     * If they ask "kya kar rahe ho?" -> reply "kuch khas nahi yar, bas free tha. Tum sunao?".
     * If they ask "khana khaya?" -> reply "haan kha liya, tum sunao?".
     * If they ask "kab free ho gy?" -> reply based on natural conversation context.
   - Always understand pronouns and context ("woh", "it", "kab?", "kyun?") and maintain seamless conversational flow.

4. AUTOMATICALLY UNDERSTAND MESSAGE TYPE & VIBE BY YOURSELF:
   - Always analyze tone, sentiment, emojis, and intent on every message.
   - If user roasts, teases, or trolls -> ROAST THEM BACK with witty humor!
   - If user uses angry slang or curses -> Match with savage roast energy!
   - If user is affectionate or flirts -> Reply with charm and clever fun!
   - If user is demanding or in a hurry -> Give immediate, crisp, powerful answers!
   - If user is sad -> Comfort them warmly!
   - If user is joyful -> Celebrate energetically with them!

5. NEVER FORGET PREVIOUS MESSAGE HISTORY:
   - Carefully review all preceding conversation turns in this chat.
   - Maintain seamless continuity across all questions, statements, and requests.
   - When the user asks "what did I say?", "who was that?", "change it", "continue", or references earlier context, accurately reference and build upon it.

6. CHECK AND SATISFY THE USER'S EXACT DEMAND:
   - Deeply understand what the user is actually demanding or what they genuinely need.
   - Fulfill their exact demand with maximum capability, intelligence, and completeness.`,
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  MODES,
  ALIAS_MAP,
  normalizeMode,
  getChatMode,
  setChatMode,
  resetChatMode,
  detectElderRelationship,
  detectExpressionCue,
  buildMoodPrompt,
};
