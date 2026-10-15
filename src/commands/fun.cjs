// Desi Fun, Jokes & Shayari Command (!joke, !shayari, !poetry, !latifa, !quote)
// Delivers hilarious desi jokes and deep Roman Urdu poetry on demand

const geminiCmd = require("./gemini.cjs");

module.exports = {
  name: "joke",
  aliases: ["latifa", "shayari", "poetry", "shairi", "quote", "اقوال", "لطيفة"],
  description: {
    en: "Get hilarious desi jokes, funny memes, or deep Roman Urdu shayari.",
    ur: "Mazedaar desi lateefay ya dilchasp Roman Urdu shayari hasil karein.",
    ar: "الحصول على نكات مضحكة أو شعر بالرومانية الأردية.",
  },
  usage: {
    en: "joke [topic]\nshayari [romantic|sad|funny]\nquote",
    ur: "joke [topic]\nshayari [dard|romantic|dosti|funny]\nlatifa",
    ar: "joke\nshayari",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const invoked = (meta?.invokedName || "joke").toLowerCase();
    const topic = args.join(" ").trim();

    let prompt = "";
    if (invoked === "shayari" || invoked === "poetry" || invoked === "shairi") {
      const type = topic || "deep & relatable";
      prompt = `Write 2 to 4 lines of original, beautiful Urdu shayari written in clean Roman Urdu on the topic: "${type}". Include poetic depth, emotion, and add a brief 1-line witty or thoughtful reflection below it. Do NOT sound robotic.`;
    } else if (invoked === "quote" || invoked === "aqwal") {
      const type = topic || "life wisdom & motivation";
      prompt = `Share a powerful, inspiring, and thought-provoking life quote or reality check in natural Roman Urdu about: "${type}". Keep it impactful and memorable.`;
    } else {
      // Joke / Latifa
      const type = topic ? `about "${topic}"` : "relatable Pakistani everyday life, friends, marriage, or family";
      prompt = `Tell an original, hilarious, punchy stand-up style joke or funny incident ${type} in authentic conversational Roman Urdu. Make it truly funny with great comedic timing, funny punchlines, and zero corporate stiffness!`;
    }

    return geminiCmd.execute(sock, msg, prompt.split(/ +/), prompt, groupMetadata, {
      invokedName: invoked,
    });
  },
};
