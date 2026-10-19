// file: src/services/integrations/ahm7/media.cjs
//
// Safe media utilities: Magic byte validation, temp file lifecycles, and cleanup guards.

const fs = require("node:fs");
const fsp = require("node:fs").promises;
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const logger = require("../../../utils/logger.cjs");

// Magic byte signatures for verified response types
const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  zip: [0x50, 0x4b, 0x03, 0x04],       // PK\x03\x04
  zipEmpty: [0x50, 0x4b, 0x05, 0x06],  // PK\x05\x06
  mp3Id3: [0x49, 0x44, 0x33],          // ID3
};

function matchesBytes(buffer, bytes) {
  if (!buffer || buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Checks whether a buffer matches an MP3 signature (either ID3 tag or MPEG sync header)
 */
function isMp3(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // ID3v2 tag
  if (matchesBytes(buffer, SIGNATURES.mp3Id3)) return true;
  // MPEG Audio Frame Sync: 11 set bits: 0xFF followed by 0xE0 or higher
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  return false;
}

/**
 * Validates that buffer matches expected binary format and is not an HTML error page.
 */
function validateMediaBuffer(buffer, expectedFormat) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Empty media buffer received");
  }

  // Detect HTML or JSON error payloads masquerading as binary
  const preview = buffer.subarray(0, 50).toString("utf8").trim().toLowerCase();
  if (preview.startsWith("<!doctype html") || preview.startsWith("<html") || preview.startsWith("<head") || preview.startsWith("<?xml")) {
    throw new Error("Received HTML webpage instead of binary file");
  }
  if (preview.startsWith('{"error"') || preview.startsWith('{"message"')) {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      throw new Error(parsed.message || parsed.error || "Upstream returned API error JSON");
    } catch (e) {
      if (e.message !== "Unexpected end of JSON input") throw e;
    }
  }

  const format = String(expectedFormat || "").toLowerCase();
  switch (format) {
    case "png":
      if (!matchesBytes(buffer, SIGNATURES.png)) {
        throw new Error("Corrupted or invalid PNG binary signature");
      }
      return { mime: "image/png", ext: "png" };
    case "jpeg":
    case "jpg":
      if (!matchesBytes(buffer, SIGNATURES.jpeg)) {
        throw new Error("Corrupted or invalid JPEG binary signature");
      }
      return { mime: "image/jpeg", ext: "jpg" };
    case "image": // Could be PNG or JPEG
      if (matchesBytes(buffer, SIGNATURES.png)) return { mime: "image/png", ext: "png" };
      if (matchesBytes(buffer, SIGNATURES.jpeg)) return { mime: "image/jpeg", ext: "jpg" };
      throw new Error("Binary buffer is neither valid PNG nor JPEG");
    case "pdf":
      if (!matchesBytes(buffer, SIGNATURES.pdf)) {
        throw new Error("Corrupted or invalid PDF binary signature");
      }
      return { mime: "application/pdf", ext: "pdf" };
    case "mp3":
    case "audio":
      if (!isMp3(buffer)) {
        throw new Error("Corrupted or invalid MP3 audio stream signature");
      }
      return { mime: "audio/mpeg", ext: "mp3" };
    case "zip":
      if (!matchesBytes(buffer, SIGNATURES.zip) && !matchesBytes(buffer, SIGNATURES.zipEmpty)) {
        throw new Error("Corrupted or invalid ZIP archive signature");
      }
      return { mime: "application/zip", ext: "zip" };
    default:
      return { mime: "application/octet-stream", ext: "bin" };
  }
}

/**
 * Creates a unique safe temporary file path in the OS temp directory.
 */
function createTempFilePath(prefix = "yuxli-ahm7", ext = "tmp") {
  const nonce = crypto.randomBytes(8).toString("hex");
  const filename = `${prefix}-${Date.now()}-${nonce}.${ext.replace(/^\./, "")}`;
  return path.join(os.tmpdir(), filename);
}

/**
 * Safely writes a buffer to a temporary file.
 */
async function writeTempFile(buffer, prefix = "yuxli-ahm7", ext = "tmp") {
  const filePath = createTempFilePath(prefix, ext);
  await fsp.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Safely unlinks a temporary file without throwing if already removed.
 */
async function cleanupTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fsp.unlink(filePath);
    }
  } catch (err) {
    logger.debug({ err: err.message, filePath }, "[AHM7 Media] Non-fatal temp file cleanup error");
  }
}

module.exports = {
  validateMediaBuffer,
  createTempFilePath,
  writeTempFile,
  cleanupTempFile,
  SIGNATURES,
};
