// Pure Node.js Zero-Dependency Ultra-Aesthetic PDF 1.4 Generator
// Supports: Dark/Modern Header Banners, Vector Logo/Emblems, Embedded JPEG Images,
// Callout Cards, Styled Section Ribbons, Bullet Lists, and Multi-page Pagination.
// Safe for Render, Docker, Linux, Windows, anywhere with 100% reliability!

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
function createDocumentPdf({
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

module.exports = {
  createDocumentPdf,
  getJpegSize,
};
