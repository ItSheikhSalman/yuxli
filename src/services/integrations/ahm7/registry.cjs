// file: src/services/integrations/ahm7/registry.cjs
//
// Centralized Service Registry for AHM7 x MAKKI Integration
// Contains service descriptors, categories, command mappings, and status metadata.

const settings = require("../../../config/settings.cjs");

const AHM7_SERVICES = {
  // --- MEDIA ---
  screenshot: {
    id: "screenshot",
    name: "WebSnap",
    category: "Media",
    description: "Full-page, desktop, and mobile webpage capture engine with SSRF isolation.",
    command: "screenshot",
    endpoint: "/api/screenshot",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "image",
    tierRequired: "starter",
  },
  tts: {
    id: "tts",
    name: "SpeechSter",
    category: "Media",
    description: "Neural multilingual text-to-speech with pitch, rate, and multi-voice selection.",
    command: "tts",
    endpoint: "/api/tts",
    method: "POST",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "mp3",
    tierRequired: "free",
  },
  tti: {
    id: "tti",
    name: "PixelSter",
    category: "Media",
    description: "FLUX.1-Dev, Schnell, and SD3 text-to-image synthesis engine.",
    command: "image",
    endpoint: "/api/tti",
    method: "POST",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "image",
    tierRequired: "starter",
  },
  alldl: {
    id: "alldl",
    name: "Universal Downloader",
    category: "Media",
    description: "Multi-platform video and audio extractor (YouTube, TikTok, Instagram, FB, Twitter).",
    command: "alldl",
    endpoint: "/api/alldl",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  transcribe: {
    id: "transcribe",
    name: "TranScribe",
    category: "Media",
    description: "Automated speech transcription and subtitle extraction for YouTube and audio URLs.",
    command: "transcribe",
    endpoint: "/api/transcribe",
    method: "POST",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  vision: {
    id: "vision",
    name: "VisionChat",
    category: "AI",
    description: "Multimodal image analysis and visual question answering adapter.",
    command: "gemini",
    endpoint: "/api/imgchat",
    method: "POST",
    status: "PARTIALLY_WORKING",
    defaultEnabled: false, // Rate limited under load; enabled as secondary fallback only
    tierRequired: "pro",
  },

  // --- DOCUMENTS ---
  handwriting: {
    id: "handwriting",
    name: "Text-to-Handwriting",
    category: "Documents",
    description: "Converts typed assignments and digital text into realistic human handwriting on ruled paper.",
    command: "handwrite",
    endpoint: "/api/hand",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "png",
    tierRequired: "starter",
  },
  wikipdf: {
    id: "wikipdf",
    name: "Wikster",
    category: "Documents",
    description: "Generates formatted, paginated academic PDF documents directly from Wikipedia articles.",
    command: "wikipdf",
    endpoint: "/api/wikipdf",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "pdf",
    tierRequired: "starter",
  },
  certificate: {
    id: "certificate",
    name: "CertSter",
    category: "Documents",
    description: "Generates professional vector certification diplomas with verifiable credentials in PDF format.",
    command: "certificate",
    endpoint: "/api/certificate",
    method: "POST",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "pdf",
    tierRequired: "starter",
  },
  webzip: {
    id: "webzip",
    name: "WebZip",
    category: "Documents",
    description: "Archives complete websites and HTML assets into a downloadable compressed ZIP package.",
    command: "webzip",
    endpoint: "/api/zip",
    method: "POST",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    expectedFormat: "zip",
    tierRequired: "pro",
  },

  // --- PRODUCTIVITY ---
  tempmail: {
    id: "tempmail",
    name: "TempSter",
    category: "Productivity",
    description: "Generates disposable temporary inboxes and fetches incoming verification messages.",
    command: "tempmail",
    endpoint: "/api/mail",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  courses: {
    id: "courses",
    name: "AHM7 Courses",
    category: "Productivity",
    description: "Search and discovery engine for free computer science, engineering, and programming courses.",
    command: "course",
    endpoint: "/api/courses",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "free",
  },
  n8n: {
    id: "n8n",
    name: "n8nSter",
    category: "Productivity",
    description: "Workflow repository searching ready-made n8n automation blueprints with direct JSON schema URLs.",
    command: "n8n",
    endpoint: "/api/n8n",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },

  // --- DISCOVERY ---
  manga: {
    id: "manga",
    name: "MangaSter",
    category: "Discovery",
    description: "Manga search engine indexing chapter counts, ratings, synopses, and official links.",
    command: "manga",
    endpoint: "/api/manga",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  novel: {
    id: "novel",
    name: "NovelSter",
    category: "Discovery",
    description: "Search and catalog index for English light novels, web novels, and fiction.",
    command: "novel",
    endpoint: "/api/novel",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  unovel: {
    id: "unovel",
    name: "UNovelSter",
    category: "Discovery",
    description: "Specialized catalog indexing Urdu literature, romantic/social novels, and classic digests.",
    command: "unovel",
    endpoint: "/api/unovel",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  movie: {
    id: "movie",
    name: "CineSearch",
    category: "Discovery",
    description: "Comprehensive media search engine providing cinema details, casts, ratings, and stream links.",
    command: "movie",
    endpoint: "/api/msearch",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  medicineSearch: {
    id: "medicineSearch",
    name: "MEDSTER Search",
    category: "Discovery",
    description: "Pharmaceutical drug search returning clinical generic names, brands, dosages, and prices.",
    command: "medicine",
    endpoint: "/api/search",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
  medicineDetails: {
    id: "medicineDetails",
    name: "MEDSTER Details",
    category: "Discovery",
    description: "Detailed pharmacology monograph lookup including indications, contraindications, and warnings.",
    command: "medicine",
    endpoint: "/api/details",
    method: "GET",
    status: "VERIFIED_WORKING",
    defaultEnabled: true,
    tierRequired: "starter",
  },
};

/**
 * Returns service descriptor by ID.
 */
function getService(serviceId) {
  return AHM7_SERVICES[serviceId] || null;
}

/**
 * Returns all registered services.
 */
function getAllServices() {
  return Object.values(AHM7_SERVICES);
}

/**
 * Checks whether an AHM7 service is enabled globally / in settings.
 */
function isServiceEnabled(serviceId) {
  const service = getService(serviceId);
  if (!service) return false;

  try {
    const { getBotSetting } = require("../../../utils/storage.cjs");
    const settingVal = getBotSetting(`ahm7_${serviceId}_enabled`, null);
    if (settingVal !== null && settingVal !== undefined) {
      return Boolean(settingVal);
    }
  } catch {}

  return service.defaultEnabled;
}

/**
 * Updates enabled/disabled status of a service in settings.
 */
function setServiceEnabled(serviceId, enabled) {
  const service = getService(serviceId);
  if (!service) throw new Error(`Unknown AHM7 service: ${serviceId}`);

  try {
    const { saveBotSetting } = require("../../../utils/storage.cjs");
    saveBotSetting(`ahm7_${serviceId}_enabled`, Boolean(enabled));
  } catch {}

  return true;
}

module.exports = {
  AHM7_SERVICES,
  getService,
  getAllServices,
  isServiceEnabled,
  setServiceEnabled,
};
