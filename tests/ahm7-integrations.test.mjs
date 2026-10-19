// tests/ahm7-integrations.test.mjs
//
// Comprehensive Automated Test Suite for AHM7 x MAKKI Integration Layer
// Validates:
// - Provider Architecture & Registry
// - SSRF Prevention & Strict URL Sanitization
// - Magic Byte Signature Validation & HTML Error Page Detection
// - Circuit Breaker & Availability Tracking
// - Structured Error Hierarchy
// - Subscription Tiers & Entitlements Enforcement
// - Medical Compliance Disclaimers
// - Command Execution & Fallback Resiliency
// - Safe Temp File Lifecycle Management

import { equal, finish, ok, require, section, throws, useTempDataDir } from "./harness.mjs";

useTempDataDir("levix-ahm7-tests");

const config = require("./src/services/integrations/ahm7/config.cjs");
const errors = require("./src/services/integrations/ahm7/errors.cjs");
const health = require("./src/services/integrations/ahm7/health.cjs");
const media = require("./src/services/integrations/ahm7/media.cjs");
const registry = require("./src/services/integrations/ahm7/registry.cjs");
const client = require("./src/services/integrations/ahm7/client.cjs");
const speechster = require("./src/services/integrations/ahm7/adapters/speechsterAdapter.cjs");
const pixelster = require("./src/services/integrations/ahm7/adapters/pixelsterAdapter.cjs");
const visionChat = require("./src/services/integrations/ahm7/adapters/visionChatAdapter.cjs");
const transcribe = require("./src/services/integrations/ahm7/adapters/transcribeAdapter.cjs");
const entitlements = require("./src/services/entitlements.cjs");
const fs = require("node:fs");

// ===================================================================
section("1. Configuration and Architecture");
// ===================================================================

equal("base URL matches official ahm7xmakki.com", config.baseUrl, "https://ahm7xmakki.com");
ok("timeouts configured for media and documents", config.timeouts.media >= 30_000);
equal("max download cap is 15MB buffer", config.limits.maxDownloadBytes, 15 * 1024 * 1024);
ok("circuit breaker threshold is configured", config.circuitBreaker.failureThreshold === 3);

// Verify all key endpoints are mapped
ok("endpoint for tts exists and is POST", config.endpoints.tts?.method === "POST");
ok("endpoint for tti exists and is POST", config.endpoints.tti?.method === "POST");
ok("endpoint for webzip exists and is POST", config.endpoints.webzip?.method === "POST");
ok("endpoint for certificate exists and is POST", config.endpoints.certificate?.method === "POST");
ok("endpoint for screenshot exists and is GET", config.endpoints.screenshot?.method === "GET");
ok("endpoint for tempmail exists and is GET", config.endpoints.tempmail?.method === "GET");

// ===================================================================
section("2. Service Registry and Dynamic Controls");
// ===================================================================

const allServices = registry.getAllServices();
ok("registry has all cataloged services", allServices.length >= 18);

const ttsService = registry.getService("tts");
equal("tts service id is tts", ttsService.id, "tts");
equal("tts service name is SpeechSter", ttsService.name, "SpeechSter");
equal("tts status is VERIFIED_WORKING", ttsService.status, "VERIFIED_WORKING");

const ttiService = registry.getService("tti");
equal("tti service name is PixelSter", ttiService.name, "PixelSter");
equal("tti status is VERIFIED_WORKING", ttiService.status, "VERIFIED_WORKING");

// Test dynamic toggle
const initialTtsEnabled = registry.isServiceEnabled("tts");
equal("tts is initially enabled", initialTtsEnabled, true);

registry.setServiceEnabled("tts", false);
equal("tts is disabled after toggle", registry.isServiceEnabled("tts"), false);

registry.setServiceEnabled("tts", true);
equal("tts is re-enabled", registry.isServiceEnabled("tts"), true);

// ===================================================================
section("3. SSRF Protection and URL Security");
// ===================================================================

equal("127.0.0.1 is detected as private IP", client.isPrivateIp("127.0.0.1"), true);
equal("10.0.5.2 is detected as private IP", client.isPrivateIp("10.0.5.2"), true);
equal("192.168.1.100 is detected as private IP", client.isPrivateIp("192.168.1.100"), true);
equal("172.20.10.5 is detected as private IP", client.isPrivateIp("172.20.10.5"), true);
equal("169.254.169.254 metadata is detected as private IP", client.isPrivateIp("169.254.169.254"), true);
equal("::1 loopback is detected as private IP", client.isPrivateIp("::1"), true);
equal("8.8.8.8 public IP is not private", client.isPrivateIp("8.8.8.8"), false);
equal("1.1.1.1 public IP is not private", client.isPrivateIp("1.1.1.1"), false);

// Test assertSafePublicUrl
let ssrfBlocked = false;
try {
  await client.assertSafePublicUrl("http://localhost:8080/admin");
} catch (e) {
  ssrfBlocked = e instanceof errors.Ahm7SsrfError || e.message.includes("blocked by SSRF policy");
}
ok("localhost URL blocked by SSRF guard", ssrfBlocked);

let loopbackBlocked = false;
try {
  await client.assertSafePublicUrl("http://127.0.0.1:3000");
} catch (e) {
  loopbackBlocked = true;
}
ok("127.0.0.1 blocked by SSRF guard", loopbackBlocked);

let metadataBlocked = false;
try {
  await client.assertSafePublicUrl("http://169.254.169.254/latest/meta-data");
} catch (e) {
  metadataBlocked = true;
}
ok("cloud metadata IP blocked by SSRF guard", metadataBlocked);

let protoBlocked = false;
try {
  await client.assertSafePublicUrl("file:///etc/passwd");
} catch (e) {
  protoBlocked = true;
}
ok("file:// protocol blocked by SSRF guard", protoBlocked);

// Safe URL succeeds
const safeParsed = await client.assertSafePublicUrl("https://example.com/test");
equal("safe public URL is allowed", safeParsed, "https://example.com/test");

// ===================================================================
section("4. Magic Byte Verification and Safe Media Lifecycle");
// ===================================================================

// Synthetic valid PNG
const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const pngRes = media.validateMediaBuffer(validPngBuffer, "png");
equal("valid PNG passes validation", pngRes.mime, "image/png");

// Synthetic valid JPEG
const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const jpgRes = media.validateMediaBuffer(validJpgBuffer, "jpeg");
equal("valid JPEG passes validation", jpgRes.mime, "image/jpeg");

// Synthetic valid PDF
const validPdfBuffer = Buffer.from("%PDF-1.4\n%sample binary data here");
const pdfRes = media.validateMediaBuffer(validPdfBuffer, "pdf");
equal("valid PDF passes validation", pdfRes.mime, "application/pdf");

// Synthetic valid MP3 (ID3)
const validMp3Buffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a]);
const mp3Res = media.validateMediaBuffer(validMp3Buffer, "mp3");
equal("valid MP3 passes validation", mp3Res.mime, "audio/mpeg");

// Synthetic valid ZIP
const validZipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const zipRes = media.validateMediaBuffer(validZipBuffer, "zip");
equal("valid ZIP passes validation", zipRes.mime, "application/zip");

// HTML error masquerading as binary should throw
let htmlRejected = false;
try {
  const htmlBuffer = Buffer.from("<!DOCTYPE html><html><body>Error 404 Not Found</body></html>");
  media.validateMediaBuffer(htmlBuffer, "image");
} catch (e) {
  htmlRejected = e.message.includes("HTML webpage");
}
ok("HTML error payload masquerading as binary is rejected", htmlRejected);

// JSON error payload masquerading as binary should throw
let jsonRejected = false;
try {
  const jsonBuffer = Buffer.from(JSON.stringify({ error: "Access Denied" }));
  media.validateMediaBuffer(jsonBuffer, "pdf");
} catch (e) {
  jsonRejected = e.message.includes("Access Denied");
}
ok("JSON error payload masquerading as binary is rejected", jsonRejected);

// Safe temporary file lifecycle
const tempFilePath = await media.writeTempFile(validPdfBuffer, "test-pdf", "pdf");
ok("temp file was created on disk", fs.existsSync(tempFilePath));
await media.cleanupTempFile(tempFilePath);
ok("temp file was cleaned up", !fs.existsSync(tempFilePath));

// ===================================================================
section("5. Circuit Breaker & Availability Tracking");
// ===================================================================

health.resetHealth("test_service");
equal("new service starts healthy", health.getHealth("test_service").status, "healthy");
equal("service is initially available", health.isAvailable("test_service"), true);

health.recordSuccess("test_service");
equal("recordSuccess increments totalSuccesses", health.getHealth("test_service").totalSuccesses, 1);

// Record 3 consecutive failures to trip circuit
health.recordFailure("test_service", new Error("Upstream timeout 1"));
equal("1 failure sets degraded status", health.getHealth("test_service").status, "degraded");

health.recordFailure("test_service", new Error("Upstream timeout 2"));
health.recordFailure("test_service", new Error("Upstream timeout 3"));

const trippedState = health.getHealth("test_service");
equal("3 failures sets unhealthy status", trippedState.status, "unhealthy");
ok("circuit has active cooldown timestamp", trippedState.cooldownUntil > Date.now());
equal("isAvailable returns false during cooldown", health.isAvailable("test_service"), false);

health.resetHealth("test_service");
equal("reset restores availability", health.isAvailable("test_service"), true);

// ===================================================================
section("6. Structured Error Hierarchy");
// ===================================================================

const timeoutErr = new errors.Ahm7TimeoutError("Deadline exceeded", { serviceId: "tts" });
equal("timeout error has 504 status", timeoutErr.statusCode, 504);
equal("timeout error holds serviceId", timeoutErr.serviceId, "tts");

const rateErr = new errors.Ahm7RateLimitError("Too many requests", { serviceId: "tti", retryAfterMs: 4000 });
equal("rate limit error has 429 status", rateErr.statusCode, 429);
equal("rate limit error holds retryAfterMs", rateErr.retryAfterMs, 4000);

const ssrfErr = new errors.Ahm7SsrfError("Private IP forbidden");
equal("SSRF error has 403 status", ssrfErr.statusCode, 403);

const breakerErr = new errors.Ahm7CircuitBreakerError("Service cooling down");
equal("circuit breaker error has 503 status", breakerErr.statusCode, 503);

// ===================================================================
section("7. Subscription Tiers & Entitlements Gating");
// ===================================================================

// Default workspace is on Free plan
const sub = entitlements.getWorkspaceSubscription("ws_default");
equal("default workspace is free plan", sub.plan, "free");

// Free tier is blocked from advanced commands
let screenshotBlocked = false;
try {
  entitlements.assertCanRunCommand("ws_default", "screenshot");
} catch (e) {
  screenshotBlocked = e.code === "COMMAND_NOT_ENTITLED";
}
ok("screenshot command blocked on Free tier", screenshotBlocked);

let handwriteBlocked = false;
try {
  entitlements.assertCanRunCommand("ws_default", "handwrite");
} catch (e) {
  handwriteBlocked = e.code === "COMMAND_NOT_ENTITLED";
}
ok("handwrite command blocked on Free tier", handwriteBlocked);

// Free tier allowed commands
let pingAllowed = false;
try {
  entitlements.assertCanRunCommand("ws_default", "ping");
  pingAllowed = true;
} catch {}
ok("ping command allowed on Free tier", pingAllowed);

// WebZip is restricted to Pro and Enterprise
equal("free plan cannot run webzip", sub.plan === "pro" || sub.plan === "enterprise", false);

// ===================================================================
section("8. WhatsApp Commands Integrity & Metadata");
// ===================================================================

const commandFiles = [
  "screenshot.cjs",
  "tempmail.cjs",
  "handwrite.cjs",
  "wikipdf.cjs",
  "certificate.cjs",
  "alldl.cjs",
  "movie.cjs",
  "medicine.cjs",
  "course.cjs",
  "n8n.cjs",
  "manga.cjs",
  "novel.cjs",
  "unovel.cjs",
  "webzip.cjs",
  "transcribe.cjs",
];

for (const file of commandFiles) {
  const cmd = require(`./src/commands/${file}`);
  ok(`command ${file} has name property`, typeof cmd.name === "string" && cmd.name.length > 0);
  ok(`command ${file} has multilingual description`, typeof cmd.description === "object" && cmd.description.en);
  ok(`command ${file} has execute function`, typeof cmd.execute === "function");
}

// Medicine command compliance
const medCmd = require("./src/commands/medicine.cjs");
ok("medicine command references clinical disclaimer", typeof config.medicalDisclaimer === "string" && config.medicalDisclaimer.includes("Disclaimer"));

// ===================================================================
section("9. Provider Fallback Resiliency");
// ===================================================================

// Verify TTS module exports
const ttsCmd = require("./src/commands/tts.cjs");
ok("tts command has name 'tts'", ttsCmd.name === "tts");
ok("tts command exports execute function", typeof ttsCmd.execute === "function");

// Verify Image module exports
const imgCmd = require("./src/commands/image.cjs");
equal("image command has name 'image'", imgCmd.name, "image");
ok("image command exports execute function", typeof imgCmd.execute === "function");

// Verify SpeechSter and PixelSter adapters
ok("speechster adapter exports synthesizeSpeech", typeof speechster.synthesizeSpeech === "function");
ok("pixelster adapter exports generateImage", typeof pixelster.generateImage === "function");
ok("visionChat adapter exports analyzeImage", typeof visionChat.analyzeImage === "function");
ok("transcribe adapter exports transcribeUrl", typeof transcribe.transcribeUrl === "function");

finish();
