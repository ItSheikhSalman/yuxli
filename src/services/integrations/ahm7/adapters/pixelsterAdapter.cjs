// file: src/services/integrations/ahm7/adapters/pixelsterAdapter.cjs
//
// AHM7 PixelSter Text-to-Image Adapter
// Maps image generation requests to POST /api/tti

const { requestAhm7 } = require("../client.cjs");
const { isServiceEnabled } = require("../registry.cjs");
const logger = require("../../../../utils/logger.cjs");

const ALLOWED_MODELS = new Set(["flux-dev", "flux-schnell", "stable-diffusion-v3"]);

/**
 * Generates an AI image buffer using PixelSter (FLUX.1-Dev / Schnell / SD3).
 * @param {string} prompt - Text description of desired image
 * @param {object} options - { model: string, width: number, height: number }
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
async function generateImage(prompt, options = {}) {
  if (!isServiceEnabled("tti")) {
    throw new Error("PixelSter Image Generation is currently disabled");
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("PixelSter requires a non-empty image prompt");
  }

  const cleanPrompt = prompt.trim().slice(0, 1500);
  let model = (options.model || "flux-dev").toLowerCase();
  if (!ALLOWED_MODELS.has(model)) {
    model = "flux-dev";
  }

  const payload = {
    prompt: cleanPrompt,
    model,
    width: options.width || 1024,
    height: options.height || 1024,
  };

  const response = await requestAhm7("tti", {
    method: "POST",
    data: payload,
    responseType: "arraybuffer",
    expectedFormat: "image",
    category: "media",
    timeout: 35_000,
  });

  return {
    buffer: response.buffer,
    mimetype: response.contentType || "image/jpeg",
  };
}

module.exports = {
  generateImage,
  ALLOWED_MODELS,
};
