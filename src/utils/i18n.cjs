// The language the bot answers in.
//
// Every reply is written in both languages where it is sent —
// `tr("Done.", "تم.")` — and tr() picks one for the message being answered.
// The choice is made once per incoming message, before any handler runs, and
// AsyncLocalStorage carries it through everything that message causes: the
// helpers deep inside a command, the status line it edits, a timer it starts.
// Nothing has to pass a `lang` argument around.
//
//   bot_language = ar | en   that language, always
//   bot_language = auto      the language the message is written in:
//                            Arabic letters          -> Arabic
//                            English words, other than the command's own
//                            syntax (`add`, `on`, `list`, ...) -> English
//                            a bare command (`!ping`, `!kick @x`) -> Arabic
//
// A bare command carries no language of its own, and Arabic is what the bot
// has always answered in, so an operator on the default setting sees no change
// until someone actually writes to it in English. Outside any message (a
// scheduled send, a member joining a group) there is nothing to detect, and
// auto means Arabic there too.

const { AsyncLocalStorage } = require("node:async_hooks");
const settings = require("../config/settings.cjs");

const scope = new AsyncLocalStorage();

const ARABIC_LETTERS = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/;
const URDU_LETTERS = /[\u0679\u0688\u0691\u06BA\u06C1\u06D2\u06BE\u067E\u0686\u06AF\u0698]/;
const URDU_WORDS = /(?:^|\s)(?:کیا|کیسے|کیسی|کیسا|حال|ٹھیک|ہاں|نہیں|مجھے|میرا|میری|میرے|تیرا|تیری|تیرے|آپ|تم|ہم|ہمارا|ہونا|کرو|کریں|بتاؤ|بتائیں|شکریہ|اچھا|بھائی|یار|کیوں|کب|کہاں|کون|کس|والا|والی|والے|تھا|تھی|تھے|ہوں|ہیں|ہے)(?:$|\s)/;
const ROMAN_URDU_WORDS = /\b(kya|kaise|kaisay|kaisa|kaisi|haal|theek|thik|haan|han|nahi|nahin|na|mujhe|mujhey|tum|tumhara|tumhari|aap|aapka|aapki|aapke|hum|hamara|mera|meri|mere|tera|teri|tere|karo|karein|batao|batayein|bolo|shukriya|acha|achha|bhai|yaar|yr|kyun|kyu|kab|kahan|kaun|wala|wali|wale|tha|thi|the|hoon|hon|hain|hai|hy|bhi|hi|pe|pr|ko|se|sy|par|ab|phir|phr|bhejo|sunao|dekh|dekho|smjh|samjho|yar)\b/i;

const LATIN_WORD = /[a-z][a-z'’-]*/gi;
// A whole token made of letters. `3fa85f64-…` (an id), `2d6`, `10pm` are not
// words in any language.
const ENGLISH_WORD = /^[a-z][a-z'’-]*[a-z]$/i;
const TOKEN_EDGES = /^[\s.,!?:;()"'`[\]{}<>|*_~]+|[\s.,!?:;()"'`[\]{}<>|*_~]+$/g;
// Not language: links, mentions, e-mail addresses.
const NOT_WORDS = /(?:https?:\/\/|www\.)\S+|\S+@\S+|@\S+/gi;

const ROMAN_URDU_DICTIONARY = {
  // General & status
  "Something went wrong": "Kuch masla ho gaya",
  "Something went wrong.": "Kuch masla ho gaya.",
  "Something went wrong with the sticker.": "Sticker me koi masla aa gaya.",
  "Something went wrong while talking to the AI": "AI se baat karne me masla hua",
  "unknown": "maloom nahi",
  "Error": "Masla",
  "Done.": "Ho gaya.",
  "Done": "Ho gaya",
  "Success": "Kamyab",
  "Please wait...": "Thora intezar karein...",
  "Processing...": "Process ho raha hy...",
  "Searching...": "Dhoond raha hoon...",
  "Writing the answer...": "Jawab likh raha hoon...",
  "Thinking...": "Soch raha hoon...",
  "🤖 Thinking...": "🤖 Soch raha hoon...",
  "🤖 Writing the answer...": "🤖 Jawab likh raha hoon...",
  "🔗 Shortening...": "🔗 Link chota kar raha hoon...",
  "📥 Sending...": "📥 Bhej raha hoon...",
  "🎨 Making the image...": "🎨 Image bana raha hoon...",
  "The model sent no answer. Try asking another way.": "Model ne koi jawab nahi diya. Dubara pooch k dekhein.",
  "I ran the tools I have but couldn't reach a final answer. Try asking more clearly.": "Pura dhoondne ke baad bhi koi final jawab nahi mila. Thora wazeh pooch k dekhein.",
  "No Gemini API key is set": "Gemini API key set nahi hy",
  "No Gemini API key is set — image generation only runs on Gemini": "Gemini API key set nahi hy — image generation sirf Gemini pe chalti hy",
  "*Sources:*": "*Hawalay / Sources:*",
  "There is nothing to save": "Save karne ke liye kuch nahi hy",

  // Permissions & access
  "Only the bot owner can use this command.": "Sirf bot owner yeh command use kar sakta hy.",
  "🚫 Only the bot owner can use this command.": "🚫 Sirf bot owner yeh command use kar sakta hy.",
  "Only group admins can use this command.": "Sirf group admins yeh command use kar sakte hain.",
  "🚫 Only group admins can use this command.": "🚫 Sirf group admins yeh command use kar sakte hain.",
  "⚠️ This command only works in groups (or for the owner in private).": "⚠️ Yeh command sirf groups me kaam karti hy (ya owner ke liye private me).",
  "Only group admins and the owner can use this command.": "Sirf group admins aur owner yeh command use kar sakte hain.",
  "🚫 Only group admins and the owner can use this command.": "🚫 Sirf group admins aur owner yeh command use kar sakte hain.",
  "⚠️ This command only works in groups, or for the owner.": "⚠️ Yeh command sirf groups me ya owner ke liye kaam karti hy.",
  "Unknown permission level.": "Permission level maloom nahi hy.",
  "🚫 Unknown permission level.": "🚫 Permission level maloom nahi hy.",
  "⛔ This command is turned off right now.": "⛔ Yeh command abhi band hy.",
  "⚠️ This command only works in groups.": "⚠️ Yeh command sirf groups me kaam karti hy.",
  "⚠️ This command only works in private chats.": "⚠️ Yeh command sirf private chat me kaam karti hy.",
  "⚠️ This command only works in private chat.": "⚠️ Yeh command sirf private chat me kaam karti hy.",
  "⚠️ You need to be a group admin to use this command.": "⚠️ Yeh command chalane ke liye aap ka group admin hona zaroori hy.",
  "⚠️ I need to be a group admin to do that.": "⚠️ Yeh karne ke liye bot ka group admin hona zaroori hy.",
  "⚠️ Sorry, only the bot owner and admins can change the bot's language.": "⚠️ Yeh setting sirf bot owner aur admins change kar sakte hain.",
  "❌ Unknown option.": "❌ Galat option.",

  // Status & options
  "Auto (follows each message)": "Auto (har message ki zuban ke mutabiq)",
  "English": "English",
  "Arabic": "Arabic (العربية)",
  "Roman Urdu": "Roman Urdu (رومن اردو)",
};

function toRomanUrdu(text) {
  if (typeof text !== "string") return text;
  const direct = ROMAN_URDU_DICTIONARY[text] || ROMAN_URDU_DICTIONARY[text.trim()];
  if (direct) return direct;

  if (text.startsWith("❌ *") && text.includes("*Type:*")) {
    return text
      .replace(/\*Type:\*/g, "*Qisam:*")
      .replace(/\*Details:\*/g, "*Tafseelat:*")
      .replace(/Something went wrong while talking to the AI/g, "AI se baat karne me masla hua")
      .replace(/Something went wrong/g, "Kuch masla ho gaya")
      .replace(/The command failed/g, "Command run nahi ho saki")
      .replace(/unknown/g, "maloom nahi");
  }

  const timeoutMatch = text.match(/^(.*?) took longer than (\d+) seconds$/);
  if (timeoutMatch) {
    return `${timeoutMatch[1]} me ${timeoutMatch[2]} second se zyada waqt lag gaya`;
  }

  const notFoundMatch = text.match(/^❌ Command "\*?(.*?)\*?" not found\./);
  if (notFoundMatch) {
    return `❌ Command "*${notFoundMatch[1]}*" nahi mili.\nSaari commands dekhne ke liye !help likhein.`;
  }

  return text;
}

/** The configured language, or null for "auto". */
function configuredLang() {
  const setting = settings.get("bot_language");
  return setting === "ar" || setting === "en" || setting === "ur" ? setting : "ur";
}

/**
 * The language to answer `text` in.
 *
 * @param {string} text   what the person wrote (for a command: the part after
 *                        the command name)
 * @param {object} [options]
 * @param {Iterable<string>} [options.syntax] words that are the command's own
 *                        syntax rather than language — see syntaxWords()
 */
function detectLang(text = "", { syntax = [] } = {}) {
  const fixed = configuredLang();
  if (fixed) return fixed;

  const clean = String(text || "").replace(NOT_WORDS, " ");

  // Urdu-specific letters or common Urdu words
  if (URDU_LETTERS.test(clean) || URDU_WORDS.test(clean)) return "ur";

  // Roman Urdu words
  if (ROMAN_URDU_WORDS.test(clean)) return "ur";

  if (ARABIC_LETTERS.test(clean)) return "ar";

  const ignore = new Set([...syntax].map((word) => String(word).toLowerCase()));
  const words = clean
    .split(/\s+/)
    .map((token) => token.replace(TOKEN_EDGES, "").toLowerCase())
    .filter((token) => ENGLISH_WORD.test(token) && !ignore.has(token));
  return words.length ? "en" : "ur";
}

/**
 * The Latin words that are part of a command's syntax: its name, its aliases,
 * the literal keywords in its usage (`add`, `on|off`, `global`, `--multi`)
 * and any `keywords` it declares.
 * The Urdu/Arabic usage is where those keywords live on their own — its
 * placeholders are Urdu/Arabic — so it is the one read.
 */
function syntaxWords(command, aliases = command?.aliases || []) {
  const words = new Set();
  const add = (text) => {
    for (const word of String(text || "").match(LATIN_WORD) || []) words.add(word.toLowerCase());
  };
  add(command?.name);
  for (const alias of aliases || []) add(alias);
  const usage = command?.usage;
  add(typeof usage === "string" ? usage : usage?.ur || usage?.ar || usage?.en);
  // Synonyms a command accepts but doesn't list in its usage (`grant`, `me`).
  for (const keyword of command?.keywords || []) add(keyword);
  return words;
}

/**
 * The language to answer a command in, judged on its arguments. A command
 * whose arguments are never language — a city name `!prayer` wants in English,
 * a link — sets `neutralArgs` and is answered like a bare command.
 */
function langForCommand(command, args = [], aliases = command?.aliases || []) {
  const text = command?.neutralArgs ? "" : args.join(" ");
  return detectLang(text, { syntax: syntaxWords(command, aliases) });
}

/** Run `fn` with replies in `lang`. Returns what `fn` returns. */
function withLang(lang, fn) {
  const chosen = lang === "en" ? "en" : lang === "ar" ? "ar" : "ur";
  return scope.run(chosen, fn);
}

/** The language of the message being answered right now. */
function currentLang() {
  return scope.getStore() || configuredLang() || "ur";
}

/** Pick the reply for the current message. */
function tr(en, ar, ur) {
  const lang = currentLang();
  if (lang === "en") return en;
  if (lang === "ar") return ar;
  if (ur) return ur;
  return toRomanUrdu(en);
}

module.exports = { detectLang, syntaxWords, langForCommand, withLang, currentLang, tr, toRomanUrdu };
