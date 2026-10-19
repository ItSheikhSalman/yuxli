// file: src/services/integrations/ahm7/adapters/transcribeAdapter.cjs
//
// AHM7 TranScribe Adapter
// Maps URL audio/video transcription to POST /api/transcribe

const { requestAhm7, assertSafePublicUrl } = require("../client.cjs");
const { isServiceEnabled } = require("../registry.cjs");

/**
 * Transcribes speech from a YouTube, audio, or video URL.
 * @param {string} mediaUrl - Public HTTP/HTTPS URL
 * @returns {Promise<{ transcript: string, title?: string, duration?: string }>}
 */
async function transcribeUrl(mediaUrl) {
  if (!isServiceEnabled("transcribe")) {
    throw new Error("TranScribe integration is currently disabled");
  }

  // SSRF guard
  const safeUrl = await assertSafePublicUrl(mediaUrl);

  const payload = {
    url: safeUrl,
  };

  const data = await requestAhm7("transcribe", {
    method: "POST",
    data: payload,
    timeout: 45_000,
  });

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response received from TranScribe");
  }

  return {
    transcript: data.transcript || data.text || data.result || "",
    title: data.title || null,
    duration: data.duration || null,
  };
}

module.exports = {
  transcribeUrl,
};
