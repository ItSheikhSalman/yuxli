// Command: !image (Aliases: !dp, !logo, !imagine, !pic, !avatar)
// Completely FREE AI Image, Logo, Avatar & Profile Picture (DP) Generator!
// Runs 100% free with zero API key requirement, works flawlessly on Render!

const axios = require("axios");
const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const { createStatus } = require("../utils/statusMessage.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const settings = require("../config/settings.cjs");

/**
 * Downloads image buffer from Pollinations AI (Free FLUX / SDXL engine)
 */
async function fetchPollinationsImage(prompt, width = 1024, height = 1024, model = "flux") {
  const seed = Math.floor(Math.random() * 1000000);
  const cleanPrompt = encodeURIComponent(prompt.trim());
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${model}`;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) YuxliBot/1.0",
    },
  });

  return Buffer.from(response.data);
}

module.exports = {
  name: "image",
  aliases: ["dp", "logo", "imagine", "pic", "avatar"],
  description: {
    en: "Generates free AI images, modern logos, and stylish WhatsApp profile pictures (DPs).",
    ar: "توليد صور ذكاء اصطناعي وشعارات (لوجو) وصور شخصية (DP) مجاناً بالكامل.",
  },
  usage: {
    en: "!dp <style description>\n!logo <brand or topic>\n!image <prompt>",
    ar: "!dp <الوصف>\n!logo <اسم الشعار>\n!image <الوصف>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
    const userTag = `@${senderId.split("@")[0]}`;

    const invokedAs = (meta.invokedName || "image").toLowerCase();
    const promptInput = args.join(" ").trim();

    if (!promptInput) {
      return await sock.sendMessage(chatId, {
        text:
          "🎨 *FREE AI Image, Logo & DP Generator*\n\n" +
          "Aap niche di gayi commands sy koi bhi image/logo bilkul free bana saktay hain:\n\n" +
          "1️⃣ *WhatsApp DP / Profile Picture:*\n" +
          "• `!dp stylish boy with neon jacket portrait 8k`\n" +
          "• `!dp cute aesthetic girl reading book in cozy cafe`\n" +
          "• `!dp modern professional developer avatar with glasses`\n\n" +
          "2️⃣ *Professional Logo:*\n" +
          "• `!logo Yuxli AI Bot modern vector shield emblem`\n" +
          "• `!logo Quantum Tech Club futuristic 3D icon`\n" +
          "• `!logo Royal Coffee Bar vintage minimalist badge`\n\n" +
          "3️⃣ *Any Image / Diagram:*\n" +
          "• `!image solar system with labeled planets study diagram`\n" +
          "• `!image futuristic cyber city at midnight 4k wallpaper`\n\n" +
          "✨ 100% Free, high quality & instant download!",
      });
    }

    // Determine generation mode and optimize prompt
    let finalPrompt = promptInput;
    let categoryBadge = "🖼️ AI Image";
    let width = 1024;
    let height = 1024;

    if (invokedAs === "dp" || invokedAs === "avatar") {
      categoryBadge = "👤 WhatsApp Profile Picture (DP)";
      width = 1024;
      height = 1024; // 1:1 square ratio is perfect for DP
      finalPrompt = `${promptInput}, high quality profile picture avatar, detailed portrait photography, cinematic lighting, 8k resolution, centered subject, aesthetic framing, masterpiece`;
    } else if (invokedAs === "logo") {
      categoryBadge = "💎 Brand & Emblem Logo";
      width = 1024;
      height = 1024;
      finalPrompt = `professional vector logo design of ${promptInput}, modern minimalist emblem, clean vector lines, isolated on solid white background, graphic design masterpiece, Behance trending, high contrast`;
    } else {
      categoryBadge = "🎨 AI Art";
      width = 1024;
      height = 1024;
      finalPrompt = `${promptInput}, highly detailed, sharp focus, 8k resolution, photorealistic masterpiece`;
    }

    const status = await createStatus(
      sock,
      chatId,
      `🎨 Generating ${categoryBadge} for you... Please wait...`,
      { replyTo: msg },
    );

    try {
      logger.info({ prompt: promptInput, invokedAs }, "[Image] Generating free image");

      const imageBuffer = await fetchPollinationsImage(finalPrompt, width, height, "flux");

      if (status?.remove) await status.remove();

      const captionText =
        `${categoryBadge}\n` +
        `👤 *Created for:* ${userTag}\n` +
        `📝 *Prompt:* "${promptInput}"\n\n` +
        `💡 _Tip: Is image ko WhatsApp DP ya Group icon par set karein!_`;

      await sock.sendMessage(
        chatId,
        {
          image: imageBuffer,
          caption: captionText,
          mentions: [senderId],
        },
        { quoted: msg },
      );
    } catch (err) {
      logger.error({ err, command: "image" }, "Error in image generation");
      if (status?.finish) {
        await status.finish(`❌ Image generate karne me masla aaya: ${err.message || "Network timeout"}`);
      } else {
        await sock.sendMessage(chatId, {
          text: `❌ Image generate karne me masla aaya: ${err.message || "Network timeout"}`,
        });
      }
    }
  },
};
