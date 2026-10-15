const { tr } = require("./i18n.cjs");

// file: src/utils/markdownParser.cjs
//
// Converts standard Markdown output (especially from LLMs) into human-readable
// WhatsApp formatting:
//   - **bold** -> *bold*
//   - ~~strike~~ -> ~strike~
//   - __italic__ -> _italic_
//   - # Headings -> *Headings*
//   - Markdown tables (| col1 | col2 |) -> clean, itemized WhatsApp cards

/**
 * Parses markdown table text into structured data:
 * { headers: string[], rows: string[][] }
 */
function parseMarkdownTable(tableLines) {
  const cleanCells = (line) => {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  };

  if (tableLines.length < 2) return null;

  const headers = cleanCells(tableLines[0]);
  // Line 1 is usually the separator: |---|---|
  const separatorLine = tableLines[1];
  if (!/^[\s|:-]+$/.test(separatorLine)) return null;

  const rows = [];
  for (let i = 2; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (!line) continue;
    rows.push(cleanCells(line));
  }

  return { headers, rows };
}

/**
 * Formats parsed table data into a clean WhatsApp-friendly list of cards.
 */
function formatTableForWhatsApp({ headers, rows }) {
  if (!headers.length || !rows.length) return "";

  const cards = [];

  rows.forEach((row, rowIndex) => {
    const primaryLabel = row[0] || tr(`Item ${rowIndex + 1}`, `عنصر ${rowIndex + 1}`);
    const fields = [];

    // If there's more than 1 column, list the remaining fields with bullet points
    if (headers.length > 1) {
      for (let c = 0; c < headers.length; c++) {
        const headerName = headers[c] || tr(`Column ${c + 1}`, `عمود ${c + 1}`);
        const cellValue = row[c] || "—";
        fields.push(`  • *${headerName}:* ${cellValue}`);
      }
    } else {
      fields.push(`  • ${primaryLabel}`);
    }

    cards.push(`📋 *${primaryLabel}*\n${fields.join("\n")}`);
  });

  return cards.join("\n\n");
}

/**
 * Replaces markdown table blocks with WhatsApp-friendly formatted cards.
 */
function convertMarkdownTables(text) {
  const lines = text.split("\n");
  const output = [];
  let currentTable = [];

  const flushTable = () => {
    if (currentTable.length >= 2) {
      const parsed = parseMarkdownTable(currentTable);
      if (parsed) {
        output.push(formatTableForWhatsApp(parsed));
      } else {
        output.push(...currentTable);
      }
    } else {
      output.push(...currentTable);
    }
    currentTable = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      currentTable.push(line);
    } else {
      flushTable();
      output.push(line);
    }
  }
  flushTable();

  return output.join("\n");
}

const LANG_BADGES = {
  javascript: "💻 *JavaScript:*",
  js: "💻 *JavaScript:*",
  typescript: "💻 *TypeScript:*",
  ts: "💻 *TypeScript:*",
  python: "🐍 *Python:*",
  py: "🐍 *Python:*",
  html: "🌐 *HTML:*",
  htm: "🌐 *HTML:*",
  css: "🎨 *CSS:*",
  bash: "⌨️ *Command / Bash:*",
  sh: "⌨️ *Shell Script:*",
  shell: "⌨️ *Shell Script:*",
  terminal: "⌨️ *Terminal:*",
  json: "📦 *JSON Data:*",
  sql: "🗄️ *SQL Query:*",
  php: "🐘 *PHP:*",
  cpp: "⚙️ *C++:*",
  "c++": "⚙️ *C++:*",
  c: "⚙️ *C Language:*",
  csharp: "🔷 *C#:*",
  cs: "🔷 *C#:*",
  java: "☕ *Java:*",
  rust: "🦀 *Rust:*",
  go: "🐹 *Go:*",
  golang: "🐹 *Go:*",
  kotlin: "📱 *Kotlin:*",
  swift: "🍎 *Swift:*",
  dart: "🎯 *Dart / Flutter:*",
  yaml: "📄 *YAML Config:*",
  yml: "📄 *YAML Config:*",
  xml: "📄 *XML:*",
  markdown: "📝 *Markdown:*",
  md: "📝 *Markdown:*",
};

/**
 * Main parser: converts standard Markdown to professional WhatsApp formatting.
 * - Code blocks: Wrapped in triple backticks with clean padding so WhatsApp renders a tap-to-copy box.
 * - Links: [Title](url) -> *Title:* url (making it clickable on WhatsApp).
 * - Bullet lists: Converted to bullet points (•) to avoid bold delimiter collisions.
 * - Headings: Styled with clean badges (📌, 🔹, •).
 * - Tables: Rendered as itemized card lists.
 */
function formatMarkdownForWhatsApp(content) {
  if (!content || typeof content !== "string") return content;

  // 1. Protect code blocks and format into dedicated WhatsApp copy boxes
  const codeBlocks = [];
  let masked = content.replace(/```([a-zA-Z0-9_#+-]*)\r?\n?([\s\S]*?)```/g, (_, rawLang, rawCode) => {
    const lang = String(rawLang || "").trim().toLowerCase();
    const cleanCode = String(rawCode || "").trim();

    let header = "";
    if (lang && LANG_BADGES[lang]) {
      header = `${LANG_BADGES[lang]}\n`;
    } else if (lang) {
      header = `💻 *${lang.toUpperCase()} Code:*\n`;
    } else if (cleanCode.includes("\n")) {
      header = `📋 *Code (Copy Box):*\n`;
    }

    // Newlines inside ``` guarantee WhatsApp displays a full monospace copy card
    const formattedBlock = `${header}\`\`\`\n${cleanCode}\n\`\`\``;
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
    codeBlocks.push(formattedBlock);
    return placeholder;
  });

  const inlineCodes = [];
  masked = masked.replace(/`([^`\n]+)`/g, (_, code) => {
    const placeholder = `\x00INLINECODE${inlineCodes.length}\x00`;
    inlineCodes.push(`\`${code.trim()}\``);
    return placeholder;
  });

  // 2. Convert markdown tables into WhatsApp cards
  masked = convertMarkdownTables(masked);

  // 3. Make Markdown links WhatsApp-clickable: [Title](url) -> *Title:* url
  masked = masked.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "*$1:* $2");

  // 4. Bullet lists: replace raw `* ` or `- ` with clean `• ` to prevent WhatsApp bold collisions
  masked = masked.replace(/(^|\n)[\*\-]\s+([^\n]+)/g, "$1• $2");

  // 5. Horizontal dividers: --- or *** on its own line
  masked = masked.replace(/(^|\n)(?:[-*_]){3,}\s*(?=\n|$)/g, "$1───────────────────");

  // 6. Convert Headings with professional badges:
  masked = masked.replace(/(^|\n)#\s+([^\n]+)/g, "$1📌 *$2*");
  masked = masked.replace(/(^|\n)##\s+([^\n]+)/g, "$1🔹 *$2*");
  masked = masked.replace(/(^|\n)#{3,6}\s+([^\n]+)/g, "$1• *$2*");

  // 7. Bold/Italic/Strikethrough:
  masked = masked.replace(/\*\*\*([^*\n]+)\*\*\*/g, "*_$1_*");
  masked = masked.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
  masked = masked.replace(/~~([^~\n]+)~~/g, "~$1~");
  masked = masked.replace(/__([^_\n]+)__/g, "_$1_");

  // 8. Restore inline code and code blocks safely
  inlineCodes.forEach((code, idx) => {
    masked = masked.split(`\x00INLINECODE${idx}\x00`).join(code);
  });
  codeBlocks.forEach((block, idx) => {
    masked = masked.split(`\x00CODEBLOCK${idx}\x00`).join(block);
  });

  // 9. Clean excessive blank lines (3+ into 2)
  masked = masked.replace(/\n{3,}/g, "\n\n").trim();

  return masked;
}

module.exports = {
  formatMarkdownForWhatsApp,
  convertMarkdownTables,
  parseMarkdownTable,
};
