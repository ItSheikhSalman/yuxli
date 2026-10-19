// file: src/services/integrations/ahm7/config.cjs
//
// AHM7 x MAKKI Integration Configuration
// Official Base: https://ahm7xmakki.com
// Official Docs: https://ahm7xmakki.com/docs

module.exports = {
  baseUrl: process.env.AHM7_BASE_URL || "https://ahm7xmakki.com",

  // Timeout settings in milliseconds
  timeouts: {
    default: 15_000,       // 15 seconds for lightweight JSON lookups
    media: 35_000,         // 35 seconds for image generation & downloads
    document: 30_000,      // 30 seconds for PDF & handwriting generation
    archiving: 45_000,     // 45 seconds for web archiving ZIP bundles
  },

  // Max payload/download size limits in bytes (prevent memory exhaustion & WhatsApp 16MB caps)
  limits: {
    maxDownloadBytes: 15 * 1024 * 1024, // 15 MB WhatsApp media limit safe buffer
    maxPromptLength: 2000,               // 2000 chars for prompts
    maxUrlLength: 1024,                  // 1024 chars for target URLs
  },

  // Retry configuration
  retry: {
    maxRetries: 2,
    baseDelayMs: 1500,
    maxDelayMs: 6000,
  },

  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: 3,     // Trip after 3 consecutive failures
    cooldownPeriodMs: 60_000 // 60 seconds cooling off before half-open probe
  },

  // Service Endpoints & Methods (Empirically verified against live server)
  endpoints: {
    // Media
    screenshot: { path: "/api/screenshot", method: "GET" },
    tts: { path: "/api/tts", method: "POST" },
    voices: { path: "/api/voices", method: "GET" },
    tti: { path: "/api/tti", method: "POST" },
    alldl: { path: "/api/alldl", method: "GET" },
    transcribe: { path: "/api/transcribe", method: "POST" },
    vision: { path: "/api/imgchat", method: "POST" },

    // Documents
    handwriting: { path: "/api/hand", method: "GET" },
    wikipdf: { path: "/api/wikipdf", method: "GET" },
    certificate: { path: "/api/certificate", method: "POST" },
    webzip: { path: "/api/zip", method: "POST" },

    // Productivity & AI
    tempmail: { path: "/api/mail", method: "GET" },
    courses: { path: "/api/courses", method: "GET" },
    n8n: { path: "/api/n8n", method: "GET" },

    // Discovery
    manga: { path: "/api/manga", method: "GET" },
    novel: { path: "/api/novel", method: "GET" },
    unovel: { path: "/api/unovel", method: "GET" },
    movie: { path: "/api/msearch", method: "GET" },
    medicineSearch: { path: "/api/search", method: "GET" },
    medicineDetails: { path: "/api/details", method: "GET" },
  },

  // Medical compliance disclaimer
  medicalDisclaimer: "⚠️ *Disclaimer:* This medical information is provided for educational and reference purposes only. It is not personalized medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional or doctor regarding any medical condition or prescription medication.",
};
