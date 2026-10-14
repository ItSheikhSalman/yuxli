// Pure Node.js Zero-Dependency Ultra-Aesthetic PDF 1.4 Generator
// Supports: Dark/Modern Header Banners, Vector Logo/Emblems, Embedded JPEG Images,
// Callout Cards, Styled Section Ribbons, Bullet Lists, and Multi-page Pagination.
// Safe for Render, Docker, Linux, Windows, anywhere with 100% reliability!

let sharp = null;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

function containsUrduOrArabic(str) {
  if (!str) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapePdfText(str) {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

/**
 * Approximate character width table for standard Helvetica
 */
function getCharWidth(char, isBold = false) {
  const code = char.charCodeAt(0);
  if (code < 32 || code > 126) return 0.58;
  if ("ijl|.,:;'! ".includes(char)) return 0.28;
  if ("frtI[]()".includes(char)) return 0.35;
  if ("abcdeghknopquvxyz".includes(char)) return 0.55;
  if ("mwMWQ@".includes(char)) return 0.85;
  if (char >= "A" && char <= "Z") return 0.68;
  return 0.55 * (isBold ? 1.1 : 1.0);
}

function measureTextWidth(text, fontSize, isBold = false) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += getCharWidth(text[i], isBold) * fontSize;
  }
  return w;
}

function wrapLines(text, maxWidth, fontSize, isBold = false) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWidth(testLine, fontSize, isBold);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

/**
 * Parses JPEG image dimensions from buffer (pure JS without libraries)
 */
function getJpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xFF) break;
    const marker = buf[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  return null;
}

/**
 * Creates a premium, beautifully styled PDF Buffer.
 *
 * @param {Object} options
 * @param {string} options.title Document Title
 * @param {string} [options.subtitle] Optional Subtitle / Author
 * @param {string} options.content Body text (markdown headings, bullets, callout > notes)
 * @param {string} [options.footer] Footer text (default: Yuxli Academic Suite)
 * @param {Buffer} [options.imageBuffer] Optional JPEG image or logo to embed
 * @param {string} [options.theme] "navy" | "emerald" | "violet"
 */
function createVectorDocumentPdf({
  title = "Academic Notes",
  subtitle = "",
  content = "",
  footer = "Yuxli Student Productivity Suite",
  imageBuffer = null,
  theme = "navy",
}) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  // Theme palettes
  const themes = {
    navy: {
      headerBg: "0.07 0.12 0.22", // #121F38
      accentLine: "0.22 0.65 0.95", // Cyan/Blue
      badgeBg: "0.15 0.25 0.45",
      headingColor: "0.08 0.15 0.28",
      calloutBg: "0.94 0.97 1.0",
      calloutBorder: "0.2 0.5 0.9",
      bulletColor: "0.18 0.55 0.85",
    },
    emerald: {
      headerBg: "0.05 0.18 0.14",
      accentLine: "0.15 0.75 0.55",
      badgeBg: "0.1 0.35 0.25",
      headingColor: "0.06 0.22 0.16",
      calloutBg: "0.93 0.98 0.95",
      calloutBorder: "0.1 0.65 0.45",
      bulletColor: "0.1 0.65 0.45",
    },
    violet: {
      headerBg: "0.14 0.08 0.25",
      accentLine: "0.65 0.35 0.95",
      badgeBg: "0.28 0.16 0.5",
      headingColor: "0.18 0.1 0.32",
      calloutBg: "0.96 0.94 1.0",
      calloutBorder: "0.55 0.25 0.85",
      bulletColor: "0.55 0.25 0.85",
    },
    midnight: {
      headerBg: "0.06 0.06 0.08",
      accentLine: "0.05 0.7 0.85",
      badgeBg: "0.1 0.1 0.14",
      headingColor: "0.06 0.06 0.08",
      calloutBg: "0.95 0.96 0.97",
      calloutBorder: "0.05 0.7 0.85",
      bulletColor: "0.05 0.7 0.85",
    },
    crimson: {
      headerBg: "0.3 0.02 0.1",
      accentLine: "0.95 0.25 0.4",
      badgeBg: "0.45 0.06 0.18",
      headingColor: "0.3 0.02 0.1",
      calloutBg: "1.0 0.95 0.96",
      calloutBorder: "0.9 0.15 0.35",
      bulletColor: "0.9 0.15 0.35",
    },
    amber: {
      headerBg: "0.27 0.1 0.02",
      accentLine: "0.95 0.65 0.1",
      badgeBg: "0.45 0.2 0.05",
      headingColor: "0.27 0.1 0.02",
      calloutBg: "1.0 0.98 0.93",
      calloutBorder: "0.85 0.5 0.05",
      bulletColor: "0.85 0.5 0.05",
    },
  };
  const color = themes[theme] || themes.navy;

  // Check if image is valid JPEG
  let embeddedImage = null;
  if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
    const size = getJpegSize(imageBuffer);
    if (size) {
      embeddedImage = { buffer: imageBuffer, width: size.width, height: size.height };
    }
  }

  // Parse markdown-style items
  const rawLines = content.split("\n");
  const parsedItems = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      parsedItems.push({ type: "spacer", height: 10 });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      parsedItems.push({ type: "h1", text: trimmed.slice(2).trim(), fontSize: 15, bold: true });
    } else if (trimmed.startsWith("## ")) {
      parsedItems.push({ type: "h2", text: trimmed.slice(3).trim(), fontSize: 13, bold: true });
    } else if (trimmed.startsWith("### ")) {
      parsedItems.push({ type: "h3", text: trimmed.slice(4).trim(), fontSize: 11, bold: true });
    } else if (trimmed.startsWith("> ")) {
      parsedItems.push({ type: "callout", text: trimmed.slice(2).trim(), fontSize: 9.5 });
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const text = trimmed.replace(/^[\*\-•]\s*/, "");
      parsedItems.push({ type: "bullet", text, fontSize: 10 });
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.*)/);
      parsedItems.push({ type: "numbered", num: match[1], text: match[2], fontSize: 10 });
    } else {
      parsedItems.push({ type: "p", text: trimmed, fontSize: 10 });
    }
  }

  // Paginate items
  const pages = [];
  let currentPageOperations = [];
  let currentY = pageHeight - margin;

  function checkPageBreak(neededHeight) {
    if (currentY - neededHeight < margin + 35) {
      pages.push(currentPageOperations);
      currentPageOperations = [];
      currentY = pageHeight - margin - 35; // Top space on subsequent pages
    }
  }

  // =========================================================================
  // PAGE 1: Stunning Header Banner with Vector Emblem & Typography
  // =========================================================================
  const bannerHeight = 90;
  const bannerY = pageHeight - margin - bannerHeight;

  // Header Background Box
  currentPageOperations.push({
    type: "rect",
    x: margin,
    y: bannerY,
    w: contentWidth,
    h: bannerHeight,
    fillColor: color.headerBg,
  });

  // Header Bottom Accent Stripe (3pt)
  currentPageOperations.push({
    type: "rect",
    x: margin,
    y: bannerY - 3,
    w: contentWidth,
    h: 3,
    fillColor: color.accentLine,
  });

  // Draw Vector Logo / Emblem on the top right
  // Modern geometric student crest icon
  const logoX = margin + contentWidth - 45;
  const logoY = bannerY + 45;
  // Emblem shield/diamond shape
  currentPageOperations.push({
    type: "poly",
    points: [
      { x: logoX, y: logoY + 18 },
      { x: logoX + 18, y: logoY + 8 },
      { x: logoX + 18, y: logoY - 12 },
      { x: logoX, y: logoY - 22 },
      { x: logoX - 18, y: logoY - 12 },
      { x: logoX - 18, y: logoY + 8 },
    ],
    fillColor: color.badgeBg,
    strokeColor: color.accentLine,
    lineWidth: 1.5,
  });
  // Inner crest star
  currentPageOperations.push({
    font: "/F2",
    size: 14,
    x: logoX - 5,
    y: logoY - 5,
    text: "Y",
    color: "1 1 1",
  });

  // Top Small Category Badge Pill
  currentPageOperations.push({
    type: "rect",
    x: margin + 15,
    y: bannerY + bannerHeight - 24,
    w: 95,
    h: 14,
    fillColor: color.badgeBg,
  });
  currentPageOperations.push({
    font: "/F2",
    size: 8,
    x: margin + 22,
    y: bannerY + bannerHeight - 21,
    text: "STUDY DOSSIER",
    color: color.accentLine,
  });

  // Title on Banner
  const titleLines = wrapLines(title, contentWidth - 80, 16, true);
  let bannerTextY = bannerY + bannerHeight - 44;
  for (const tLine of titleLines) {
    currentPageOperations.push({
      font: "/F2",
      size: 16,
      x: margin + 15,
      y: bannerTextY,
      text: tLine,
      color: "1 1 1",
    });
    bannerTextY -= 19;
  }

  // Subtitle / Date on Banner
  if (subtitle) {
    currentPageOperations.push({
      font: "/F1",
      size: 9,
      x: margin + 15,
      y: bannerY + 12,
      text: subtitle,
      color: "0.75 0.85 0.95",
    });
  }

  currentY = bannerY - 25;

  // If embedded image provided, draw it at the top of content!
  if (embeddedImage) {
    const maxImgW = contentWidth;
    const maxImgH = 160;
    const scale = Math.min(maxImgW / embeddedImage.width, maxImgH / embeddedImage.height, 1);
    const drawW = embeddedImage.width * scale;
    const drawH = embeddedImage.height * scale;
    const drawX = margin + (contentWidth - drawW) / 2;

    checkPageBreak(drawH + 20);
    currentPageOperations.push({
      type: "image",
      x: drawX,
      y: currentY - drawH,
      w: drawW,
      h: drawH,
    });
    currentY -= drawH + 18;
  }

  // Process Document Content Items
  for (const item of parsedItems) {
    if (item.type === "spacer") {
      currentY -= item.height;
      continue;
    }

    // Heading 1 & 2
    if (item.type === "h1" || item.type === "h2") {
      const size = item.fontSize;
      const spacingBefore = item.type === "h1" ? 18 : 14;
      const bannerH = size + 10;

      checkPageBreak(spacingBefore + bannerH + 15);
      currentY -= spacingBefore;

      // Section Ribbon Banner Box
      currentPageOperations.push({
        type: "rect",
        x: margin,
        y: currentY - bannerH,
        w: contentWidth,
        h: bannerH,
        fillColor: "0.95 0.97 0.99",
      });

      // Left Accent Ribbon Bar
      currentPageOperations.push({
        type: "rect",
        x: margin,
        y: currentY - bannerH,
        w: 4,
        h: bannerH,
        fillColor: color.accentLine,
      });

      currentPageOperations.push({
        font: "/F2",
        size,
        x: margin + 12,
        y: currentY - bannerH + 6,
        text: item.text,
        color: color.headingColor,
      });

      currentY -= bannerH + 8;
      continue;
    }

    // Heading 3
    if (item.type === "h3") {
      const size = item.fontSize;
      checkPageBreak(size + 16);
      currentY -= 10;

      currentPageOperations.push({
        font: "/F2",
        size,
        x: margin,
        y: currentY - size,
        text: `▪ ${item.text}`,
        color: color.headingColor,
      });
      currentY -= size + 6;
      continue;
    }

    // Callout Note Card (> note)
    if (item.type === "callout") {
      const size = item.fontSize;
      const lines = wrapLines(item.text, contentWidth - 28, size, false);
      const cardHeight = lines.length * (size + 4) + 12;

      checkPageBreak(cardHeight + 8);
      currentY -= 4;

      // Card Background Box
      currentPageOperations.push({
        type: "rect",
        x: margin,
        y: currentY - cardHeight,
        w: contentWidth,
        h: cardHeight,
        fillColor: color.calloutBg,
      });

      // Card Left Border Strip
      currentPageOperations.push({
        type: "rect",
        x: margin,
        y: currentY - cardHeight,
        w: 3.5,
        h: cardHeight,
        fillColor: color.calloutBorder,
      });

      let lineY = currentY - 14;
      for (const line of lines) {
        currentPageOperations.push({
          font: "/F1",
          size,
          x: margin + 14,
          y: lineY,
          text: line,
          color: "0.1 0.18 0.32",
        });
        lineY -= size + 4;
      }

      currentY -= cardHeight + 8;
      continue;
    }

    // Bullet points
    if (item.type === "bullet") {
      const size = item.fontSize;
      const bulletIndent = 16;
      const lines = wrapLines(item.text, contentWidth - bulletIndent, size, false);

      checkPageBreak(lines.length * (size + 4) + 4);

      // Diamond or circle bullet icon
      currentPageOperations.push({
        font: "/F2",
        size: size - 1,
        x: margin + 3,
        y: currentY - size,
        text: "◆",
        color: color.bulletColor,
      });

      for (let i = 0; i < lines.length; i++) {
        currentPageOperations.push({
          font: "/F1",
          size,
          x: margin + bulletIndent,
          y: currentY - size,
          text: lines[i],
          color: "0.15 0.15 0.18",
        });
        currentY -= size + 4;
      }
      currentY -= 2;
      continue;
    }

    // Numbered List
    if (item.type === "numbered") {
      const size = item.fontSize;
      const numIndent = 22;
      const lines = wrapLines(item.text, contentWidth - numIndent, size, false);

      checkPageBreak(lines.length * (size + 4) + 4);

      currentPageOperations.push({
        font: "/F2",
        size,
        x: margin + 2,
        y: currentY - size,
        text: item.num,
        color: color.bulletColor,
      });

      for (let i = 0; i < lines.length; i++) {
        currentPageOperations.push({
          font: "/F1",
          size,
          x: margin + numIndent,
          y: currentY - size,
          text: lines[i],
          color: "0.15 0.15 0.18",
        });
        currentY -= size + 4;
      }
      currentY -= 2;
      continue;
    }

    // Regular Paragraph
    const size = item.fontSize;
    const lines = wrapLines(item.text, contentWidth, size, false);
    for (const line of lines) {
      checkPageBreak(size + 4);
      currentPageOperations.push({
        font: "/F1",
        size,
        x: margin,
        y: currentY - size,
        text: line,
        color: "0.18 0.18 0.2",
      });
      currentY -= size + 4;
    }
    currentY -= 3;
  }

  if (currentPageOperations.length > 0 || pages.length === 0) {
    pages.push(currentPageOperations);
  }

  const totalPages = pages.length;

  // Build PDF 1.4 Structure
  // Object IDs:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // (Optional Image XObject if provided)

  let imageObjId = null;
  let nextObjId = 5;

  if (embeddedImage) {
    imageObjId = nextObjId++;
  }

  const pageObjectIds = [];
  const pageStreamPairs = [];

  for (let i = 0; i < totalPages; i++) {
    const pageId = nextObjId++;
    const streamId = nextObjId++;
    pageObjectIds.push(pageId);
    pageStreamPairs.push({ pageId, streamId, ops: pages[i], pageNum: i + 1 });
  }

  const catalogObj = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj`;
  const f1Obj = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
  const f2Obj = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

  const assembledObjects = [
    { id: 1, content: catalogObj },
    { id: 2, content: pagesObj },
    { id: 3, content: f1Obj },
    { id: 4, content: f2Obj },
  ];

  // If image object is present
  if (embeddedImage && imageObjId) {
    const imgHeader =
      `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${embeddedImage.width} ` +
      `/Height ${embeddedImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${embeddedImage.buffer.length} >>\nstream\n`;
    const imgFooter = "\nendstream\nendobj";
    assembledObjects.push({
      id: imageObjId,
      isRawBuffer: true,
      header: Buffer.from(imgHeader, "binary"),
      body: embeddedImage.buffer,
      footer: Buffer.from(imgFooter, "binary"),
    });
  }

  for (const pair of pageStreamPairs) {
    let streamOps = "";

    // Draw page operations
    for (const op of pair.ops) {
      if (op.type === "rect") {
        streamOps += `q\n${op.fillColor} rg\n${op.x} ${op.y} ${op.w} ${op.h} re\nf\nQ\n`;
      } else if (op.type === "poly") {
        streamOps += `q\n${op.strokeColor} RG\n${op.lineWidth || 1} w\n${op.fillColor} rg\n`;
        const pts = op.points;
        streamOps += `${pts[0].x} ${pts[0].y} m\n`;
        for (let p = 1; p < pts.length; p++) {
          streamOps += `${pts[p].x} ${pts[p].y} l\n`;
        }
        streamOps += `h\nB\nQ\n`;
      } else if (op.type === "image") {
        streamOps += `q\n${op.w} 0 0 ${op.h} ${op.x} ${op.y} cm\n/Im1 Do\nQ\n`;
      } else {
        const escaped = escapePdfText(op.text);
        streamOps += `q\n${op.color || "0 0 0"} rg\nBT\n${op.font} ${op.size} Tf\n${op.x} ${op.y} Td\n(${escaped}) Tj\nET\nQ\n`;
      }
    }

    // Footer divider line
    streamOps += `q\n0.82 0.85 0.9 RG\n0.75 w\n${margin} ${margin - 5} m\n${pageWidth - margin} ${margin - 5} l\nS\nQ\n`;

    // Footer Branding
    const escapedFooter = escapePdfText(footer);
    streamOps += `q\n0.45 0.5 0.6 rg\nBT\n/F1 8 Tf\n${margin} ${margin - 17} Td\n(${escapedFooter}) Tj\nET\nQ\n`;

    // Footer Page Number Badge
    const pageNumText = `Page ${pair.pageNum} of ${totalPages}`;
    const pageNumWidth = measureTextWidth(pageNumText, 8, false);
    const pageNumX = pageWidth - margin - pageNumWidth;
    streamOps += `q\n0.45 0.5 0.6 rg\nBT\n/F2 8 Tf\n${pageNumX} ${margin - 17} Td\n(${pageNumText}) Tj\nET\nQ\n`;

    const streamLen = Buffer.byteLength(streamOps, "utf-8");

    let xobjectsRes = "";
    if (embeddedImage && imageObjId) {
      xobjectsRes = `/XObject << /Im1 ${imageObjId} 0 R >> `;
    }

    const pageObjStr =
      `${pair.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Contents ${pair.streamId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xobjectsRes}>> >>\nendobj`;

    const streamObjStr = `${pair.streamId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamOps}\nendstream\nendobj`;

    assembledObjects.push({ id: pair.pageId, content: pageObjStr });
    assembledObjects.push({ id: pair.streamId, content: streamObjStr });
  }

  // Sort objects by ID for clean PDF xref table
  assembledObjects.sort((a, b) => a.id - b.id);

  // Assemble full buffer
  const headerBuf = Buffer.from("%PDF-1.4\n", "binary");
  const chunks = [headerBuf];
  const offsets = [];
  let currentOffset = headerBuf.length;

  for (const obj of assembledObjects) {
    offsets.push(currentOffset);
    if (obj.isRawBuffer) {
      chunks.push(obj.header);
      chunks.push(obj.body);
      chunks.push(obj.footer);
      chunks.push(Buffer.from("\n", "binary"));
      currentOffset += obj.header.length + obj.body.length + obj.footer.length + 1;
    } else {
      const objBuf = Buffer.from(`${obj.content}\n`, "utf-8");
      chunks.push(objBuf);
      currentOffset += objBuf.length;
    }
  }

  const xrefOffset = currentOffset;
  const totalCount = assembledObjects.length + 1;
  let xrefStr = `xref\n0 ${totalCount}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xrefStr += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${totalCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  chunks.push(Buffer.from(xrefStr, "utf-8"));
  return Buffer.concat(chunks);
}

const SVG_THEMES = {
  navy: {
    headerBg: "#0f172a",
    accentLine: "#38bdf8",
    badgeBg: "#1e293b",
    headingColor: "#0f172a",
    calloutBg: "#f0f9ff",
    calloutBorder: "#0284c7",
    calloutText: "#0369a1",
    bulletColor: "#0284c7",
    codeBg: "#0f172a",
    codeText: "#e2e8f0",
  },
  emerald: {
    headerBg: "#064e3b",
    accentLine: "#34d399",
    badgeBg: "#065f46",
    headingColor: "#064e3b",
    calloutBg: "#ecfdf5",
    calloutBorder: "#059669",
    calloutText: "#047857",
    bulletColor: "#10b981",
    codeBg: "#064e3b",
    codeText: "#d1fae5",
  },
  violet: {
    headerBg: "#3b0764",
    accentLine: "#c084fc",
    badgeBg: "#581c87",
    headingColor: "#3b0764",
    calloutBg: "#faf5ff",
    calloutBorder: "#9333ea",
    calloutText: "#7e22ce",
    bulletColor: "#a855f7",
    codeBg: "#3b0764",
    codeText: "#f3e8ff",
  },
  midnight: {
    headerBg: "#09090b",
    accentLine: "#06b6d4",
    badgeBg: "#18181b",
    headingColor: "#09090b",
    calloutBg: "#f4f4f5",
    calloutBorder: "#06b6d4",
    calloutText: "#0e7490",
    bulletColor: "#06b6d4",
    codeBg: "#18181b",
    codeText: "#f4f4f5",
  },
  crimson: {
    headerBg: "#4c0519",
    accentLine: "#fb7185",
    badgeBg: "#881337",
    headingColor: "#4c0519",
    calloutBg: "#fff1f2",
    calloutBorder: "#e11d48",
    calloutText: "#be123c",
    bulletColor: "#f43f5e",
    codeBg: "#4c0519",
    codeText: "#ffe4e6",
  },
  amber: {
    headerBg: "#451a03",
    accentLine: "#fbbf24",
    badgeBg: "#78350f",
    headingColor: "#451a03",
    calloutBg: "#fffbeb",
    calloutBorder: "#d97706",
    calloutText: "#b45309",
    bulletColor: "#f59e0b",
    codeBg: "#451a03",
    codeText: "#fef3c7",
  },
};

function buildPdfFromJpegs(jpegBuffers) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const totalPages = jpegBuffers.length;

  let nextObjId = 1;
  const catalogId = nextObjId++;
  const pagesId = nextObjId++;

  const pageObjectIds = [];
  const assembledObjects = [];

  for (let i = 0; i < totalPages; i++) {
    const pageId = nextObjId++;
    const streamId = nextObjId++;
    const imgId = nextObjId++;
    pageObjectIds.push(pageId);

    const jpegBuf = jpegBuffers[i];
    let width = 1240;
    let height = 1754;
    for (let o = 2; o < jpegBuf.length - 8; o++) {
      if (jpegBuf[o] === 0xFF && (jpegBuf[o + 1] === 0xC0 || jpegBuf[o + 1] === 0xC2)) {
        height = jpegBuf.readUInt16BE(o + 5);
        width = jpegBuf.readUInt16BE(o + 7);
        break;
      }
    }

    const streamOps = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    const streamLen = Buffer.byteLength(streamOps, "utf-8");

    const pageObjStr =
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Contents ${streamId} 0 R /Resources << /XObject << /Im1 ${imgId} 0 R >> >> >>\nendobj`;

    const streamObjStr = `${streamId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamOps}\nendstream\nendobj`;

    const imgHeader =
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} ` +
      `/Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpegBuf.length} >>\nstream\n`;
    const imgFooter = "\nendstream\nendobj";

    assembledObjects.push({ id: pageId, content: pageObjStr });
    assembledObjects.push({ id: streamId, content: streamObjStr });
    assembledObjects.push({
      id: imgId,
      isRawBuffer: true,
      header: Buffer.from(imgHeader, "binary"),
      body: jpegBuf,
      footer: Buffer.from(imgFooter, "binary"),
    });
  }

  const catalogObj = `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj`;
  const pagesObj = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj`;

  assembledObjects.push({ id: catalogId, content: catalogObj });
  assembledObjects.push({ id: pagesId, content: pagesObj });
  assembledObjects.sort((a, b) => a.id - b.id);

  const headerBuf = Buffer.from("%PDF-1.4\n", "binary");
  const chunks = [headerBuf];
  const offsets = [];
  let currentOffset = headerBuf.length;

  for (const obj of assembledObjects) {
    offsets.push(currentOffset);
    if (obj.isRawBuffer) {
      chunks.push(obj.header);
      chunks.push(obj.body);
      chunks.push(obj.footer);
      chunks.push(Buffer.from("\n", "binary"));
      currentOffset += obj.header.length + obj.body.length + obj.footer.length + 1;
    } else {
      const objBuf = Buffer.from(`${obj.content}\n`, "utf-8");
      chunks.push(objBuf);
      currentOffset += objBuf.length;
    }
  }

  const xrefOffset = currentOffset;
  const totalCount = assembledObjects.length + 1;
  let xrefStr = `xref\n0 ${totalCount}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xrefStr += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${totalCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xrefStr, "utf-8"));

  return Buffer.concat(chunks);
}

async function renderSvgDocumentPdf({
  title = "Academic Notes",
  subtitle = "",
  content = "",
  footer = "Levix Smart Student Suite",
  imageBuffer = null,
  theme = "navy",
}) {
  const palette = SVG_THEMES[theme] || SVG_THEMES.navy;
  const w = 1240;
  const h = 1754;
  const margin = 70;
  const contentW = w - margin * 2;
  const maxContentY = h - 110;

  let embeddedImageBase64 = null;
  if (imageBuffer && Buffer.isBuffer(imageBuffer) && sharp) {
    try {
      const imgResized = await sharp(imageBuffer)
        .resize({ width: 1100, height: 350, fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
      embeddedImageBase64 = `data:image/jpeg;base64,${imgResized.toString("base64")}`;
    } catch {}
  }

  const lines = content.split("\n");
  const items = [];

  let inCode = false;
  let codeBuffer = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("```")) {
      if (inCode) {
        items.push({ type: "code", text: codeBuffer.join("\n") });
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    if (!trimmed) {
      items.push({ type: "spacer", height: 16 });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      items.push({ type: "h1", text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("## ")) {
      items.push({ type: "h2", text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("### ")) {
      items.push({ type: "h3", text: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith("> ")) {
      items.push({ type: "callout", text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      items.push({ type: "bullet", text: trimmed.replace(/^[\*\-•]\s*/, "") });
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.*)/);
      items.push({ type: "numbered", num: match[1], text: match[2] });
    } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      items.push({ type: "table-row", text: trimmed });
    } else if (/^[-=_]{3,}$/.test(trimmed)) {
      items.push({ type: "divider" });
    } else {
      items.push({ type: "p", text: trimmed });
    }
  }
  if (inCode && codeBuffer.length > 0) {
    items.push({ type: "code", text: codeBuffer.join("\n") });
  }

  const pages = [];
  let currentPageItems = [];
  let currentY = 270;

  for (const item of items) {
    let needed = 44;
    if (item.type === "h1") needed = 72;
    else if (item.type === "h2") needed = 60;
    else if (item.type === "h3") needed = 48;
    else if (item.type === "callout") needed = 80;
    else if (item.type === "code") needed = Math.min(250, item.text.split("\n").length * 28 + 40);
    else if (item.type === "spacer") needed = item.height;

    if (currentY + needed > maxContentY && currentPageItems.length > 0) {
      pages.push(currentPageItems);
      currentPageItems = [];
      currentY = 120;
    }

    currentPageItems.push(item);
    currentY += needed;
  }
  if (currentPageItems.length > 0 || pages.length === 0) {
    pages.push(currentPageItems);
  }

  const totalPages = pages.length;
  const jpegBuffers = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const isFirstPage = pageIdx === 0;
    let pageY = isFirstPage ? 50 : 60;
    let pageSvgContent = "";

    if (isFirstPage) {
      const bannerH = 180;
      pageSvgContent += `
        <rect x="${margin}" y="${pageY}" width="${contentW}" height="${bannerH}" rx="14" fill="${palette.headerBg}"/>
        <rect x="${margin}" y="${pageY + bannerH - 6}" width="${contentW}" height="6" rx="3" fill="${palette.accentLine}"/>
        <rect x="${margin + 20}" y="${pageY + 18}" width="140" height="26" rx="6" fill="${palette.badgeBg}"/>
        <text x="${margin + 90}" y="${pageY + 36}" font-size="14" font-weight="bold" fill="${palette.accentLine}" text-anchor="middle" font-family="'Segoe UI', Tahoma, sans-serif">STUDY DOSSIER</text>
        <text x="${w / 2}" y="${pageY + 100}" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">${escapeXml(title)}</text>
      `;
      if (subtitle) {
        pageSvgContent += `
          <text x="${w / 2}" y="${pageY + 145}" font-size="20" fill="#cbd5e1" text-anchor="middle" font-family="'Segoe UI', Tahoma, sans-serif">${escapeXml(subtitle)}</text>
        `;
      }
      pageY += bannerH + 35;

      if (embeddedImageBase64) {
        pageSvgContent += `
          <image href="${embeddedImageBase64}" x="${margin}" y="${pageY}" width="${contentW}" height="180" preserveAspectRatio="xMidYMid slice"/>
        `;
        pageY += 200;
      }
    } else {
      pageSvgContent += `
        <rect x="${margin}" y="40" width="${contentW}" height="6" rx="3" fill="${palette.accentLine}"/>
      `;
      pageY = 80;
    }

    for (const item of pages[pageIdx]) {
      const isUrdu = containsUrduOrArabic(item.text);
      const textX = isUrdu ? w - margin - 20 : margin + 20;
      const anchor = isUrdu ? "end" : "start";

      if (item.type === "spacer") {
        pageY += item.height;
      } else if (item.type === "h1") {
        const barX = isUrdu ? w - margin - 8 : margin;
        pageSvgContent += `
          <rect x="${margin}" y="${pageY}" width="${contentW}" height="56" rx="8" fill="#f8fafc"/>
          <rect x="${barX}" y="${pageY}" width="8" height="56" rx="4" fill="${palette.accentLine}"/>
          <text x="${textX}" y="${pageY + 38}" font-size="26" font-weight="bold" fill="${palette.headingColor}" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">${escapeXml(item.text)}</text>
        `;
        pageY += 74;
      } else if (item.type === "h2") {
        pageSvgContent += `
          <text x="${textX}" y="${pageY + 28}" font-size="22" font-weight="bold" fill="${palette.headingColor}" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">§ ${escapeXml(item.text)}</text>
          <line x1="${margin}" y1="${pageY + 38}" x2="${w - margin}" y2="${pageY + 38}" stroke="#e2e8f0" stroke-width="1.5"/>
        `;
        pageY += 56;
      } else if (item.type === "h3") {
        pageSvgContent += `
          <text x="${textX}" y="${pageY + 24}" font-size="19" font-weight="bold" fill="${palette.headingColor}" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">▪ ${escapeXml(item.text)}</text>
        `;
        pageY += 42;
      } else if (item.type === "callout") {
        const barX = isUrdu ? w - margin - 6 : margin;
        pageSvgContent += `
          <rect x="${margin}" y="${pageY}" width="${contentW}" height="64" rx="8" fill="${palette.calloutBg}"/>
          <rect x="${barX}" y="${pageY}" width="6" height="64" rx="3" fill="${palette.calloutBorder}"/>
          <text x="${textX}" y="${pageY + 38}" font-size="20" font-weight="500" fill="${palette.calloutText}" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">💡 ${escapeXml(item.text)}</text>
        `;
        pageY += 80;
      } else if (item.type === "bullet") {
        const dotX = isUrdu ? w - margin - 12 : margin + 12;
        const bTextX = isUrdu ? w - margin - 35 : margin + 35;
        pageSvgContent += `
          <circle cx="${dotX}" cy="${pageY + 12}" r="5" fill="${palette.bulletColor}"/>
          <text x="${bTextX}" y="${pageY + 20}" font-size="20" fill="#334155" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">${escapeXml(item.text)}</text>
        `;
        pageY += 42;
      } else if (item.type === "numbered") {
        const numBadgeX = isUrdu ? w - margin - 36 : margin;
        const nTextX = isUrdu ? w - margin - 50 : margin + 50;
        pageSvgContent += `
          <rect x="${numBadgeX}" y="${pageY}" width="34" height="26" rx="6" fill="${palette.badgeBg}"/>
          <text x="${numBadgeX + 17}" y="${pageY + 18}" font-size="14" font-weight="bold" fill="${palette.accentLine}" text-anchor="middle" font-family="'Segoe UI', Tahoma, sans-serif">${escapeXml(item.num)}</text>
          <text x="${nTextX}" y="${pageY + 20}" font-size="20" fill="#334155" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">${escapeXml(item.text)}</text>
        `;
        pageY += 44;
      } else if (item.type === "code") {
        const codeLines = item.text.split("\n").slice(0, 8);
        const codeH = codeLines.length * 24 + 26;
        let codeLinesSvg = "";
        let cY = pageY + 28;
        for (const cl of codeLines) {
          codeLinesSvg += `<text x="${margin + 20}" y="${cY}" font-size="16" fill="${palette.codeText}" font-family="'JetBrains Mono', 'Consolas', monospace">${escapeXml(cl)}</text>`;
          cY += 24;
        }
        pageSvgContent += `
          <rect x="${margin}" y="${pageY}" width="${contentW}" height="${codeH}" rx="8" fill="${palette.codeBg}"/>
          ${codeLinesSvg}
        `;
        pageY += codeH + 16;
      } else if (item.type === "divider") {
        pageSvgContent += `
          <line x1="${margin}" y1="${pageY + 10}" x2="${w - margin}" y2="${pageY + 10}" stroke="#e2e8f0" stroke-width="2"/>
        `;
        pageY += 24;
      } else {
        pageSvgContent += `
          <text x="${textX}" y="${pageY + 20}" font-size="20" fill="#1e293b" text-anchor="${anchor}" font-family="'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, Arial, sans-serif">${escapeXml(item.text)}</text>
        `;
        pageY += 38;
      }
    }

    const pageNumLabel = containsUrduOrArabic(title)
      ? `صفحہ ${pageIdx + 1} از ${totalPages}`
      : `Page ${pageIdx + 1} of ${totalPages}`;
    const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#ffffff"/>
      ${pageSvgContent}
      <line x1="${margin}" y1="${h - 90}" x2="${w - margin}" y2="${h - 90}" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="${margin}" y="${h - 55}" font-size="18" fill="#64748b" font-family="'Segoe UI', Tahoma, sans-serif">${escapeXml(footer)}</text>
      <text x="${w - margin}" y="${h - 55}" font-size="18" fill="#64748b" text-anchor="end" font-family="'Segoe UI', Tahoma, sans-serif">${escapeXml(pageNumLabel)}</text>
    </svg>
    `;

    const jpeg = await sharp(Buffer.from(svgStr)).jpeg({ quality: 92 }).toBuffer();
    jpegBuffers.push(jpeg);
  }

  return buildPdfFromJpegs(jpegBuffers);
}

async function createDocumentPdf(options) {
  const isUrdu = containsUrduOrArabic(`${options.title || ""} ${options.content || ""}`);
  if (isUrdu || options.forceSvg) {
    try {
      if (sharp) {
        return await renderSvgDocumentPdf(options);
      }
    } catch (err) {
      // Graceful fallback to vector generator if sharp rendering encounters an error
    }
  }
  return createVectorDocumentPdf(options);
}

module.exports = {
  createDocumentPdf,
  createVectorDocumentPdf,
  renderSvgDocumentPdf,
  getJpegSize,
  containsUrduOrArabic,
};
