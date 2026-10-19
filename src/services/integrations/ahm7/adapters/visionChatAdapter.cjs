// file: src/services/integrations/ahm7/adapters/visionChatAdapter.cjs
//
// AHM7 VisionChat Multimodal Adapter
// Maps image question-answering to POST /api/imgchat

const { requestAhm7, assertSafePublicUrl } = require("../client.cjs");
const { isServiceEnabled } = require("../registry.cjs");

/**
 * Analyzes an image with a prompt using VisionChat.
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image
 * @param {string} prompt - Question or instruction about the image
 * @returns {Promise<string>} - Text answer
 */
async function analyzeImage(imageUrl, prompt = "Describe this image in detail") {
  if (!isServiceEnabled("vision")) {
    throw new Error("VisionChat integration is currently disabled");
  }

  // SSRF guard
  const safeUrl = await assertSafePublicUrl(imageUrl);
  const cleanPrompt = (prompt || "Describe this image in detail").trim().slice(0, 1000);

  const payload = {
    url: safeUrl,
    userPrompt: cleanPrompt,
  };

  const data = await requestAhm7("vision", {
    method: "POST",
    data: payload,
    timeout: 30_000,
  });

  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    return data.response || data.text || data.answer || JSON.stringify(data);
  }

  throw new Error("Empty response received from VisionChat");
}

module.exports = {
  analyzeImage,
};
