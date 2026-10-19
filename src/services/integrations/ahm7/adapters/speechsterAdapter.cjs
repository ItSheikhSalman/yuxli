// file: src/services/integrations/ahm7/adapters/speechsterAdapter.cjs
//
// AHM7 SpeechSter TTS Adapter
// Maps text-to-speech requests to POST /api/tts

const { requestAhm7 } = require("../client.cjs");
const { isServiceEnabled } = require("../registry.cjs");
const logger = require("../../../../utils/logger.cjs");

let cachedVoices = null;
let lastVoicesFetch = 0;

/**
 * Fetches available voices from /api/voices with 1-hour in-memory cache.
 */
async function getAvailableVoices() {
  const now = Date.now();
  if (cachedVoices && now - lastVoicesFetch < 3600_000) {
    return cachedVoices;
  }

  try {
    const data = await requestAhm7("voices", { timeout: 10_000 });
    if (data && Array.isArray(data.voices)) {
      cachedVoices = data.voices;
      lastVoicesFetch = now;
      return cachedVoices;
    }
  } catch (err) {
    logger.warn({ err: err.message }, "[SpeechSter] Could not refresh voices list");
  }

  return cachedVoices || [];
}

/**
 * Synthesizes text to MP3 audio using SpeechSter.
 * @param {string} text - The input text to speak
 * @param {object} options - { voiceIndex: number, pitch: number, rate: number, lang: string }
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
async function synthesizeSpeech(text, options = {}) {
  if (!isServiceEnabled("tts")) {
    throw new Error("SpeechSter TTS integration is currently disabled");
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("SpeechSter requires non-empty text");
  }

  // Pick voiceIndex based on requested voiceIndex or language
  let voiceIndex = options.voiceIndex !== undefined ? Number(options.voiceIndex) : 1;
  const lang = (options.lang || "").toLowerCase();

  // If language specified, match to known voice indices
  // Index 0: Microsoft Server Speech Translation (en-US-JennyNeural)
  // Index 1: en-US-GuyNeural
  // If Urdu or Arabic, voices can be chosen or defaults used
  if (lang === "ur" || lang === "urdu") {
    // Check if voiceIndex was explicitly passed, else default to index 1 or best match
  }

  const payload = {
    voiceIndex: Number.isInteger(voiceIndex) ? voiceIndex : 1,
    text: text.trim().slice(0, 1000), // Enforce reasonable length
    pitch: options.pitch !== undefined ? Number(options.pitch) : 0,
    rate: options.rate !== undefined ? Number(options.rate) : 0,
  };

  const response = await requestAhm7("tts", {
    method: "POST",
    data: payload,
    responseType: "arraybuffer",
    expectedFormat: "mp3",
    category: "media",
    timeout: 25_000,
  });

  return {
    buffer: response.buffer,
    mimetype: "audio/mpeg",
  };
}

module.exports = {
  synthesizeSpeech,
  getAvailableVoices,
};
