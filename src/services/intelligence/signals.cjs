const SENSITIVE =
  /\b(password|passwd|secret|api[_ -]?key|otp|ssn|credit card|bank account|suicid\w*|self.harm|diagnos\w*|cancer|pregnan\w*|abuse|died|death|funeral|trauma)\b|(?:\d[ -]?){13,19}/i;
const SECRET =
  /\b(password|passwd|secret|api[_ -]?key|otp|ssn|credit card|bank account|private key|access token)\b|(?:\d[ -]?){13,19}/i;
const countMatches = (text, pattern) => (text.match(pattern) || []).length;

function language(text) {
  const value = String(text || "");
  if (/[\u0900-\u097f]/u.test(value)) return "hinglish";
  if (/[\u0600-\u06ff]/u.test(value))
    return /[\u0679\u0688\u0691\u06ba\u06be\u06d2\u06cc\u06af\u0686\u067e]/u.test(value)
      ? "ur"
      : "ar";
  const roman = countMatches(
    value.toLowerCase(),
    /\b(hn|haan|acha|kya|kaisa|kesi|kesy|hai|hy|hain|bhai|yaar|kal|mujhe|samjhao|karna|bjy|kitna|nahi|theek|kidhar)\b/g,
  );
  const hindi = countMatches(
    value.toLowerCase(),
    /\b(accha|kaise|nahi|kya|tum|aap|hai|samjhao)\b/g,
  );
  const english = countMatches(
    value.toLowerCase(),
    /\b(please|explain|what|how|when|is|the|this|order|help|why|can)\b/g,
  );
  if (roman && english > 1) return "mixed";
  if (roman) return "roman-ur";
  if (hindi > 1) return "hinglish";
  return "en";
}

function analyze(text) {
  const value = String(text || "").slice(0, 16000);
  const tokens = value.trim().split(/\s+/u).filter(Boolean);
  const business =
    /\b(order|refund|invoice|customer|pricing|stock|inventory|shipment|return policy|appointment)\b/i.test(
      value,
    );
  const islamic =
    /\b(quran|surah|ayah|hadith|hadees|fiqh|salah|namaz|zakat|hajj|umrah|dua|seerah|fatwa)\b|[\u0642][\u0631][\u0622\u0627][\u0646]/iu.test(
      value,
    );
  const medical =
    /\b(medicine|doctor|symptom|pain|dose|medical|treatment|fever|chest pain|breath|overdose)\b/i.test(
      value,
    );
  const education =
    /\b(pointer|c\+\+|python|algorithm|quiz|exam|assignment|homework|math|science|explain|flashcard|study|programming|operating system)\b/i.test(
      value,
    );
  const emergency =
    /\b(cannot breathe|can.t breathe|severe chest pain|overdose|kill myself|suicide|unconscious)\b/i.test(
      value,
    );
  const conflict = /\b(shut up|hate you|idiot|stupid|fight|argument|kill you|threat)\b/i.test(
    value,
  );
  const sad = /\b(sad|depressed|lonely|grief|died|funeral|crying|hopeless)\b/i.test(value);
  const frustrated = /\b(angry|frustrated|annoyed|furious|not working|delayed|broken)\b/i.test(
    value,
  );
  const confused = /\b(confused|don.t understand|samajh nahi|unclear)\b/i.test(value);
  const humor = /\b(haha\w*|lol|lmao|funny|joke|roast|mazak)\b|\u{1f602}|\u{1f923}/iu.test(value);
  const question =
    /[?\u061f]|\b(what|how|why|when|where|explain|help|kya|kaise|kab|samjhao)\b/i.test(value);
  const acknowledgment =
    /^(thanks?( you)?|thank you|shukriya|ok(ay)?|acha|hn|haan|got it|great|done|resolved|haha\w*|lol)[.!\s\p{Extended_Pictographic}]*$/iu.test(
      value.trim(),
    );
  const tone =
    emergency || sad
      ? "supportive"
      : conflict || frustrated
        ? "calm"
        : confused
          ? "educational"
          : humor
            ? "playful"
            : business
              ? "professional"
              : "neutral";
  return {
    language: language(value),
    words: tokens.length,
    chars: value.length,
    emojiCount: countMatches(value, /\p{Extended_Pictographic}/gu),
    punctuation: countMatches(value, /[.!?,;:\u061f]/gu),
    abbreviations: countMatches(
      value.toLowerCase(),
      /\b(hn|bjy|brb|btw|idk|lol|imo|pls|thx|u|r)\b/g,
    ),
    intent: islamic
      ? "islamic"
      : medical || emergency
        ? "medical"
        : business
          ? "business"
          : education
            ? "education"
            : "general",
    tone,
    confidence: "heuristic",
    sensitive: SENSITIVE.test(value) || medical || emergency || sad,
    secret: SECRET.test(value),
    emergency,
    conflict,
    humor,
    question,
    acknowledgment,
    detailed:
      /\b(in detail|step.by.step|derive|compare|explain|tutorial|proof)\b/i.test(value) ||
      education,
    handoff: /\b(human agent|speak to (a )?human|real person|support agent)\b/i.test(value),
    toolRequest: /\b(schedule|remind me|delete|send|purchase|refund|transfer|book)\b/i.test(value),
    roast: /\b(roast|tease|make fun of|bezzat|zalil)\b/i.test(value),
    selfRoast: /\b(roast me|mujhe roast|meri batting|tease me)\b/i.test(value),
  };
}

module.exports = { analyze, language, SENSITIVE, SECRET };
