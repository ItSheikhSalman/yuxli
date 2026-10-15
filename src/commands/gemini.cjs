// Gemini-powered chat command — now an agent, not a single API call.
//
// What this file still owns:
//   * turning a WhatsApp message (text / image / video / audio / document /
//     quoted message) into Gemini `parts`,
//   * the multi-message context buffer (`!gemini add` ... `!gemini send`),
//   * image generation (`!generate`),
//   * memory management shortcuts (`!del`, `!delall`),
//   * the fallback: sanitize-and-retry when an uploaded file URI expired.
//
// The active provider itself (gemini / openai / anthropic) is a setting, and
// the loop it dispatches to lives in services/aiAgent.cjs +
// services/aiProviders.cjs. Media and !generate/!stt stay Gemini-only — the
// other providers have no Files API to upload to.
//
// What moved out:
//   * the system prompt          -> config/ai-persona.md (editable, hot-reloaded)
//   * the model loop + tools     -> services/aiAgent.cjs + services/aiTools.cjs
//   * long-term memory           -> utils/memory.cjs (Markdown files)
//
// One status message is posted at the start and edited all the way through
// ("🤖 بفكر..." -> "🔍 ببحث عن ..." -> the final answer), so a single answer
// never costs four messages.

const { GoogleGenAI } = require("@google/genai");

const logger = require("../utils/logger.cjs");
const settings = require("../config/settings.cjs");
const {
  getChatHistoryAsync,
  saveChatHistoryAsync,
  deleteChatHistoryAsync,
  deleteAllChatHistoriesAsync,
} = require("../utils/storage-hub.cjs");
const { sendBotMessage, sendBotError } = require("../utils/sendBotMessage.cjs");
const { createStatus } = require("../utils/statusMessage.cjs");
const { formatMarkdownForWhatsApp } = require("../utils/markdownParser.cjs");
const { isOwnerJidSync } = require("../utils/permissions.cjs");
const { resolveCaller } = require("../services/aiToolAuth.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const {
  runAgent,
  formatSources,
  isFileReferenceError,
  sanitizeHistoryForFiles,
  sanitizeHistoryForSession,
  activeProviderKeySetting,
} = require("../services/aiAgent.cjs");
const { getProvider, hasProvider } = require("../services/aiRouter.cjs");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { unwrapMessage, visibleText } = require("../utils/messageContent.cjs");
const {
  assertProviderBaseUrl,
  assertProviderRequestUrl,
} = require("../utils/providerUrl.cjs");
const { tr } = require("../utils/i18n.cjs");
const aiMood = require("../services/aiMood.cjs");

// In-memory mutex per sessionKey to serialize overlapping turns for the same session.
// Prevents race conditions and history loss when messages arrive in rapid succession.
// Different users in groups run concurrently in parallel without blocking each other.
const activeSessionLocks = new Map();

async function withSessionLock(sessionKey, fn) {
  const prev = activeSessionLocks.get(sessionKey) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  activeSessionLocks.set(
    sessionKey,
    prev.then(() => current).catch(() => current),
  );

  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (activeSessionLocks.get(sessionKey) === current) {
      activeSessionLocks.delete(sessionKey);
    }
  }
}

// Per-(chat, sender) explicit context buffer for the multi-message workflow.
// Entries accumulate until `!gemini send` flushes them into a single call.
// Lives in memory only — short-lived by design.
const contextBuffers = new Map(); // key: "<chatJid>::<senderJid>" -> { entries, at }
const MAX_BUFFER_ENTRIES = 20;
const MAX_BUFFER_CHARS = 32_000;
const MAX_BUFFER_KEYS = 64;
const BUFFER_TTL_MS = 30 * 60 * 1000;

function bufferKey(msg) {
  return `${msg.key.remoteJid}::${msg.key.participant || msg.key.remoteJid}`;
}
function pruneBuffers(now = Date.now()) {
  for (const [key, slot] of contextBuffers) {
    if (!slot?.entries?.length || now - (slot.at || 0) > BUFFER_TTL_MS) {
      contextBuffers.delete(key);
    }
  }
}
function entryChars(entry) {
  let size = (entry?.text?.length || 0) + (entry?.quotedText?.length || 0);
  for (const part of [...(entry?.mediaParts || []), ...(entry?.quotedMediaParts || [])]) {
    size += JSON.stringify(part || {}).length;
  }
  return size;
}
function getBuffer(msg) {
  pruneBuffers();
  return contextBuffers.get(bufferKey(msg))?.entries || [];
}
function setBuffer(msg, entries) {
  pruneBuffers();
  const key = bufferKey(msg);
  if (!entries?.length) {
    contextBuffers.delete(key);
    return true;
  }
  const capped = entries.slice(-MAX_BUFFER_ENTRIES);
  let used = 0;
  const kept = [];
  for (let i = capped.length - 1; i >= 0; i--) {
    const nextSize = entryChars(capped[i]);
    if (nextSize > MAX_BUFFER_CHARS || used + nextSize > MAX_BUFFER_CHARS) break;
    used += nextSize;
    kept.unshift(capped[i]);
  }
  if (!kept.length) return false;
  if (contextBuffers.size >= MAX_BUFFER_KEYS && !contextBuffers.has(key)) return false;
  contextBuffers.set(key, { entries: kept, at: Date.now() });
  return true;
}
function clearAllContextBuffers() {
  contextBuffers.clear();
}

// Keys come from config/settings.cjs (what the dashboard saved, else the default)
// and are read per call: a key pasted into the dashboard has to work without a
// restart. The clients are cached per key so we don't rebuild them per message.
//
// One client does everything now: @google/genai folded the separate
// GoogleAIFileManager into `ai.files`, and the model is named per request
// instead of being baked into a model object.
let geminiCache = { key: null, baseUrl: null, genAI: null };

function geminiClients() {
  const aiFailover = require("../services/aiFailover.cjs");
  const key = aiFailover.getActiveKey("gemini") || settings.get("gemini_api_key");
  if (!key) return { genAI: null };
  const baseUrl = assertProviderBaseUrl(settings.get("gemini_base_url"), {
    allowLoopback: true,
  });
  if (geminiCache.key !== key || geminiCache.baseUrl !== baseUrl) {
    geminiCache = {
      key,
      baseUrl,
      genAI: new GoogleGenAI({ apiKey: key, httpOptions: { baseUrl } }),
    };
  }
  return geminiCache;
}

// The media in a message and the type WhatsApp filed it under. That type, not
// the MIME type, picks the decryption keys: a photo sent as a document has to
// be downloaded as a "document".
const MEDIA_TYPES = ["image", "video", "audio", "document"];
function pickMedia(message) {
  const inner = unwrapMessage(message);
  for (const type of MEDIA_TYPES) {
    const media = inner[`${type}Message`];
    if (media) return { media, type };
  }
  return null;
}

async function processIncomingMedia(parts, mediaMessage, downloadType) {
  const provider = getProvider();
  if (provider.id === "gemini") {
    await assertProviderRequestUrl(settings.get("gemini_base_url"), { allowLoopback: true });
  }
  const { genAI } = geminiClients();
  return provider.prepareMedia(parts, mediaMessage, null, {
    downloadContentFromMessage,
    genAI,
    downloadType,
  });
}

// === Multi-message context buffer helpers ===
// Each entry is { text, quotedText, mediaParts, quotedMediaParts }. Media is
// uploaded eagerly (on `add`) so the URIs are ready when `send` fires; Gemini
// file URIs are valid for ~48 h, plenty for any real workflow.

async function captureContextEntry(msg, args) {
  const entry = {
    text: "",
    quotedText: "",
    mediaParts: [],
    quotedMediaParts: [],
  };

  // args[0] is the sub-command name itself (`add` / `send`); the rest is the
  // user's actual text.
  const cleanedText = args.slice(1).join(" ").trim();
  if (cleanedText) entry.text = cleanedText;

  const m = unwrapMessage(msg.message);

  const directMedia = pickMedia(m);
  if (directMedia) {
    try {
      await processIncomingMedia(entry.mediaParts, directMedia.media, directMedia.type);
    } catch (err) {
      logger.warn(
        { err: err?.message },
        "[Gemini Context] direct media upload failed; entry will be text-only",
      );
    }
  }

  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted) {
    entry.quotedText = visibleText(quoted);
    const quotedMedia = pickMedia(quoted);
    if (quotedMedia) {
      try {
        await processIncomingMedia(entry.quotedMediaParts, quotedMedia.media, quotedMedia.type);
      } catch (err) {
        logger.warn(
          { err: err?.message },
          "[Gemini Context] quoted media upload failed; entry will continue without it",
        );
      }
    }
  }

  return entry;
}

function entryHasContent(e) {
  return Boolean(e.text || e.quotedText || e.mediaParts?.length || e.quotedMediaParts?.length);
}

function buildPartsFromBuffer(entries) {
  const parts = [];
  for (const e of entries) {
    if (e.quotedText) {
      parts.push({ text: tr(`(Reference: "${e.quotedText}")`, `(مرجع: "${e.quotedText}")`) });
    }
    if (e.quotedMediaParts?.length) parts.push(...e.quotedMediaParts);
    if (e.mediaParts?.length) parts.push(...e.mediaParts);
    if (e.text) parts.push({ text: e.text });
  }
  return parts;
}

function summarizeEntry(e, idx) {
  const bits = [];
  if (e.text) {
    const preview = e.text.length > 60 ? e.text.slice(0, 60) + "…" : e.text;
    bits.push(`📝 ${preview}`);
  }
  if (e.quotedText) {
    const preview = e.quotedText.length > 40 ? e.quotedText.slice(0, 40) + "…" : e.quotedText;
    bits.push(`↩️ "${preview}"`);
  }
  if (e.mediaParts?.length)
    bits.push(tr(`🖼️ media (${e.mediaParts.length})`, `🖼️ ميديا (${e.mediaParts.length})`));
  if (e.quotedMediaParts?.length) {
    bits.push(
      tr(
        `🖼️↩️ quoted media (${e.quotedMediaParts.length})`,
        `🖼️↩️ وسائط مقتبسة (${e.quotedMediaParts.length})`,
      ),
    );
  }
  return `${idx + 1}. ${bits.join(" · ") || tr("(empty)", "(فارغة)")}`;
}

module.exports = {
  name: "gemini",
  aliases: ["ask", "ai", "resetai", "del", "delall", "generate"],
  description: {
    en: "AI assistant with tools (web search, reading links, long-term memory). Sub-commands: add/send/clear/show for context, generate for images, del/delall to clear the conversation.",
    ar: "مساعد ذكي بأدوات (بحث في الويب، قراءة الروابط، ذاكرة دائمة). أوامر فرعية: add/send/clear/show للسياق، وgenerate للصور، وdel/delall لمسح المحادثة.",
  },
  usage: {
    en: "gemini <text>\ngemini add <text>\ngemini send\ngemini show\ngemini clear\ngenerate <image description>\ndel   (clear this chat's conversation)\ndelall   (clear every conversation)",
    ar: "gemini <النص>\ngemini add <النص>\ngemini send\ngemini show\ngemini clear\ngenerate <وصف الصورة>\ndel   (مسح سجل هذه المحادثة)\ndelall   (مسح كل المحادثات)",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, ctx = {}) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const userName = msg.pushName;
    const isGroup = chatId.endsWith("@g.us");

    const senderId = msg.key.fromMe ? null : isGroup ? msg.key.participant : rawChatId;
    const normalizedSenderId = senderId ? normalizeJid(senderId) : null;
    const isOwner = msg.key.fromMe || isOwnerJidSync(senderId);

    // In a group, each user has their own isolated conversation thread so multiple
    // users talking at the same time on different topics never collide or mix up context.
    const sessionKey = isGroup && normalizedSenderId ? `${chatId}::${normalizedSenderId}` : chatId;

    // Resolve sub-command. Aliases like !del arrive via ctx.invokedName, while
    // `!gemini del ...` arrives as args[0].
    const invoked = (ctx?.invokedName || "").toLowerCase();
    const aliasSubCmds = new Set(["del", "resetai", "delall", "generate"]);
    const isExplicitGemini = invoked === "gemini";
    const inlineSubCmds = isExplicitGemini
      ? new Set(["add", "send", "clear", "show", "del", "resetai", "delall", "generate"])
      : new Set(["del", "resetai", "delall", "generate"]);
    const candidateInline = args[0]?.toLowerCase();
    const subCommand = aliasSubCmds.has(invoked)
      ? invoked
      : inlineSubCmds.has(candidateInline)
        ? candidateInline
        : null;

    // --- conversation history management ---
    if (subCommand === "del" || subCommand === "resetai") {
      if (isGroup && !isOwner && normalizedSenderId) {
        // Ordinary user in a group resetting their own conversation thread
        await deleteChatHistoryAsync(sessionKey);
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              `✅ @${normalizedSenderId.split("@")[0]}, your personal AI conversation thread has been cleared.`,
              `✅ @${normalizedSenderId.split("@")[0]}, تم مسح سجل محادثتك بنجاح.`,
              `✅ @${normalizedSenderId.split("@")[0]}، آپ کی ذاتی AI گفتگو کی ہسٹری صاف کر دی گئی ہے۔`,
            ),
            mentions: [normalizedSenderId],
          },
          { replyTo: msg },
        );
      }
      if (!isOwner)
        return sendBotMessage(
          sock,
          chatId,
          { text: tr("🚫 Only the bot owner can use this.", "🚫 هذا الأمر مخصص للمالك فقط.", "🚫 یہ کمانڈ صرف بوٹ اونر کے لیے ہے۔") },
          { replyTo: msg },
        );
      await deleteChatHistoryAsync(chatId);
      return sendBotMessage(
        sock,
        chatId,
        {
          text: tr(
            "✅ Conversation history cleared.\n" +
              "_(Long-term memory isn't cleared this way — use `!memory clear` if that's what you meant.)_",
            "✅ تم مسح سجل المحادثة.\n" +
              "_(لا تُحذف الذاكرة الدائمة بهذه الطريقة. استخدم `!memory clear` إذا أردت حذفها.)_",
            "✅ گفتگو کی تمام ہسٹری صاف کر دی گئی ہے۔",
          ),
        },
        { replyTo: msg },
      );
    }
    if (subCommand === "delall") {
      if (!isOwner)
        return sendBotMessage(
          sock,
          chatId,
          { text: tr("🚫 Only the bot owner can use this.", "🚫 هذا الأمر مخصص للمالك فقط.") },
          { replyTo: msg },
        );
      await deleteAllChatHistoriesAsync();
      return sendBotMessage(
        sock,
        chatId,
        {
          text: tr(
            "✅ Every conversation history was cleared.",
            "✅ تم مسح كل سجلات المحادثات بنجاح.",
          ),
        },
        { replyTo: msg },
      );
    }

    // --- image generation ---
    if (subCommand === "generate") {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
      const imagePromptArgs = invoked === "generate" ? args : args.slice(1);
      const imagePrompt = imagePromptArgs.join(" ");
      if (!imagePrompt && !quotedMsg) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              "Describe the image you want after the command. Example: !generate a cat wearing a hat",
              "اكتب وصفًا للصورة التي تريدها بعد الأمر. مثال: !generate قطة ترتدي قبعة",
            ),
          },
          { replyTo: msg },
        );
      }

      const status = await createStatus(
        sock,
        chatId,
        tr("🎨 Making the image...", "🎨 جارٍ إنشاء الصورة..."),
        { replyTo: msg },
      );

      try {
        // Image generation needs a model that returns image bytes, which only
        // the Gemini image models do — it stays on Gemini whatever the chat
        // provider is.
        if (!geminiClients().genAI) {
          throw new Error(
            tr(
              "No Gemini API key is set — image generation only runs on Gemini",
              "لم يُضبط مفتاح Gemini API — توليد الصور يعمل على Gemini فقط",
            ),
          );
        }
        await assertProviderRequestUrl(settings.get("gemini_base_url"), {
          allowLoopback: true,
        });
        const fullPrompt =
          imagePrompt && quotedMsg
            ? `Prompt: ${imagePrompt} ,using quote: ${quotedMsg}`
            : imagePrompt
              ? `Prompt: ${imagePrompt}`
              : `Prompt: ${quotedMsg}`;
        const response = await geminiClients().genAI.models.generateContent({
          model: settings.get("gemini_image_model"),
          contents: `Generate an image using this prompt: ${fullPrompt}`,
        });

        // The bytes come back as an inlineData part. (The previous code read
        // `fileData.data`, which is not a field that exists on either SDK —
        // this path could never have produced an image.)
        const image = (response.candidates?.[0]?.content?.parts || []).find(
          (part) => part?.inlineData?.data,
        );
        if (!image) {
          throw new Error(tr("The model answered without an image", "أعاد النموذج ردًا دون صورة"));
        }
        const imageBuffer = Buffer.from(image.inlineData.data, "base64");

        await status.remove();
        await sendBotMessage(
          sock,
          chatId,
          {
            image: imageBuffer,
            caption: tr(`🖼️ Here you go: "${imagePrompt}"`, `🖼️ تفضل، صورة لـ: "${imagePrompt}"`),
          },
          { replyTo: msg },
        );
      } catch (error) {
        logger.error({ err: error }, `Error in !generate command`);
        await status.fail(error, tr("I couldn't make the image", "تعذّر إنشاء الصورة"));
      }
      return;
    }

    // --- multi-message context buffer ---
    if (subCommand === "add") {
      const entry = await captureContextEntry(msg, args);
      if (!entryHasContent(entry)) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              "📭 Nothing to add to the context.\n\n" +
                "Write text after the command, reply to a message, or send media with the caption `!gemini add`.",
              "📭 لا يوجد محتوى لإضافته إلى السياق.\n\n" +
                "اكتب نصًا بعد الأمر، أو ردّ على رسالة، أو أرسل ملف وسائط مع الوصف `!gemini add`.",
            ),
          },
          { replyTo: msg },
        );
      }
      const buf = getBuffer(msg);
      if (buf.length >= MAX_BUFFER_ENTRIES) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              `The context is full (${MAX_BUFFER_ENTRIES} messages at most). Send \`!gemini send\` or \`!gemini clear\`.`,
              `السياق ممتلئ (حد أقصى ${MAX_BUFFER_ENTRIES} رسائل). أرسل \`!gemini send\` أو \`!gemini clear\`.`,
            ),
          },
          { replyTo: msg },
        );
      }
      buf.push(entry);
      if (!setBuffer(msg, buf)) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              "The context is too big, or too many contexts are open. " +
                "Send `!gemini send` or `!gemini clear` and try again.",
              "السياق كبير جدًا، أو بلغ عدد السياقات المفتوحة الحد الأقصى. " +
                "أرسل `!gemini send` أو `!gemini clear` وحاول مرة أخرى.",
            ),
          },
          { replyTo: msg },
        );
      }
      const stored = getBuffer(msg);
      return sendBotMessage(
        sock,
        chatId,
        {
          text: tr(
            `✅ Added to the context. (Total now: *${stored.length}*)\n\n` +
              "Keep going with `!gemini add ...`, or send it all with `!gemini send`.",
            `✅ أُضيفت إلى السياق. (إجمالي الآن: *${stored.length}*)\n\n` +
              "تابع باستخدام `!gemini add ...`، أو أرسل المحتوى كله باستخدام `!gemini send`.",
          ),
        },
        { replyTo: msg },
      );
    }

    if (subCommand === "clear") {
      const had = getBuffer(msg).length;
      setBuffer(msg, []);
      return sendBotMessage(
        sock,
        chatId,
        {
          text: had
            ? tr(
                `🗑️ Cleared *${had}* messages from the context.`,
                `🗑️ تم مسح *${had}* رسالة من السياق.`,
              )
            : tr("📭 The context was already empty.", "📭 السياق فارغ بالفعل."),
        },
        { replyTo: msg },
      );
    }

    if (subCommand === "show") {
      const buf = getBuffer(msg);
      if (!buf.length) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              "📭 The context is empty. Start with `!gemini add ...`.",
              "📭 السياق فارغ. ابدأ بـ `!gemini add ...`.",
            ),
          },
          { replyTo: msg },
        );
      }
      return sendBotMessage(
        sock,
        chatId,
        {
          text:
            tr(
              `📋 *Current context:* (${buf.length} messages)\n\n`,
              `📋 *السياق الحالي:* (${buf.length} رسالة)\n\n`,
            ) +
            buf.map((e, i) => summarizeEntry(e, i)).join("\n") +
            tr(
              "\n\nSend it all with `!gemini send` or clear it with `!gemini clear`.",
              "\n\nأرسل المحتوى كله باستخدام `!gemini send` أو امسحه باستخدام `!gemini clear`.",
            ),
        },
        { replyTo: msg },
      );
    }

    // === build the parts for this turn ===
    const prompt = args.join(" ");
    let parts = [];

    if (subCommand === "send") {
      const buf = getBuffer(msg);
      const finalEntry = await captureContextEntry(msg, args);
      const allEntries = [...buf];
      if (entryHasContent(finalEntry)) allEntries.push(finalEntry);
      if (!allEntries.length) {
        return sendBotMessage(
          sock,
          chatId,
          {
            text: tr(
              "📭 The context is empty and `!gemini send` has no text.\n\n" +
                "Start with `!gemini add ...`, or write text with `!gemini send ...`.",
              "📭 السياق فارغ ولا يوجد نص في `!gemini send`.\n\n" +
                "ابدأ بـ `!gemini add ...` أولًا، أو اكتب نصًا مع `!gemini send ...`.",
            ),
          },
          { replyTo: msg },
        );
      }
      setBuffer(msg, []);
      parts = buildPartsFromBuffer(allEntries);
    }

    // Direct media. The text we attach is the CLEANED prompt (command name and
    // prefix already stripped); the raw caption is only a fallback.
    if (!parts.length && (msg.message?.imageMessage || msg.message?.videoMessage)) {
      const mediaMessage = msg.message.imageMessage || msg.message.videoMessage;
      try {
        await processIncomingMedia(
          parts,
          mediaMessage,
          msg.message.imageMessage ? "image" : "video",
        );
        parts.push({
          text:
            prompt ||
            mediaMessage.caption ||
            "Please scan and analyze this image completely. Extract all visible text, poster details, event/date/topic, and summarize what it is clearly in natural Roman Urdu (or English if appropriate). If appropriate, add an emoji reaction [REACT: <emoji>] at the beginning.",
        });
      } catch (error) {
        logger.error({ err: error }, "Failed to upload media to Gemini.");
        return sendBotError(
          sock,
          chatId,
          error,
          tr("Uploading the image/video failed", "حصلت مشكلة في رفع الصورة/الفيديو", "تصویر یا ویڈیو اپلوڈ کرنے میں ناکامی"),
          {
            replyTo: msg,
          },
        );
      }
    } else if (!parts.length && msg.message?.audioMessage) {
      try {
        await processIncomingMedia(parts, msg.message.audioMessage, "audio");
        parts.push({ text: prompt || tr("Analyze this recording.", "حلل لي هذا التسجيل الصوتي.", "اس آڈیو ریکارڈنگ کا تجزیہ کریں۔") });
      } catch (error) {
        logger.error({ err: error }, "Failed to upload audio to Gemini.");
        return sendBotError(
          sock,
          chatId,
          error,
          tr("Uploading the recording failed", "حصلت مشكلة في رفع التسجيل الصوتي", "آڈیو ریکارڈنگ اپلوڈ کرنے میں ناکامی"),
          {
            replyTo: msg,
          },
        );
      }
    } else if (!parts.length && msg.message?.documentMessage) {
      try {
        await processIncomingMedia(parts, msg.message.documentMessage, "document");
        const fileName = msg.message.documentMessage.fileName || "document";
        const text = prompt || msg.message.documentMessage.caption || "";
        parts.push({
          text: text
            ? tr(`${text}\n(File: ${fileName})`, `${text}\n(الملف: ${fileName})`)
            : tr(`Analyze/summarize the file: ${fileName}`, `حلل/لخّص الملف: ${fileName}`),
        });
      } catch (error) {
        logger.error({ err: error }, "Failed to upload document to Gemini.");
        return sendBotError(
          sock,
          chatId,
          error,
          tr("Uploading the file failed", "حصلت مشكلة في رفع الملف"),
          {
            replyTo: msg,
          },
        );
      }
    } else if (!parts.length && prompt) {
      const turnPrompt = isGroup && userName ? `[${userName}]: ${prompt}` : prompt;
      parts.push({ text: turnPrompt });
    }

    if (parts.length === 0) {
      return sendBotMessage(
        sock,
        chatId,
        {
          text: tr(
            "Write a question, or send an image/video/voice note/file with the command.",
            "يرجى كتابة سؤال أو إرسال صورة/فيديو/تسجيل صوتي/ملف مع الأمر.",
          ),
        },
        { replyTo: msg },
      );
    }

    // Quoted message context. Skipped for `!gemini send` — those entries
    // captured their own quotes at `add` time.
    const quotedMsg =
      subCommand === "send" ? null : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quotedMsg) {
      let quotedMediaPart = null;
      // Captions count: "describe this" on a captioned photo should see both.
      const quotedText = visibleText(quotedMsg);
      const mediaInQuote = pickMedia(quotedMsg);

      if (mediaInQuote) {
        try {
          const probeParts = [];
          await processIncomingMedia(probeParts, mediaInQuote.media, mediaInQuote.type);
          quotedMediaPart = probeParts[0];
        } catch (mediaError) {
          // Stop here. Carrying on without the media used to post this error
          // AND a second reply from a model that had never seen the photo
          // ("I can't see any image") — two messages, the second one wrong.
          logger.error({ err: mediaError }, "Failed to process quoted media");
          return sendBotError(
            sock,
            chatId,
            mediaError,
            tr("There was a problem with the quoted message", "حدثت مشكلة في الرسالة المقتبسة"),
            {
              replyTo: msg,
            },
          );
        }
      }

      if (quotedMediaPart) {
        parts.unshift(quotedMediaPart);
        if (quotedText) {
          parts.unshift({
            text: tr(
              `Using this message as a reference:\n"""\n${quotedText}\n"""\n\n`,
              `بالاعتماد على هذه الرسالة كمرجع:\n"""\n${quotedText}\n"""\n\n`,
            ),
          });
        }
      } else if (quotedText) {
        parts.unshift({
          text: tr(
            `Using this message as a reference:\n"""\n${quotedText}\n"""\n\nAnswer the following:`,
            `بالاعتماد على هذه الرسالة كمرجع:\n"""\n${quotedText}\n"""\n\nأجب على التالي:`,
          ),
        });
      }
    }

    // Provider-aware: delegates configuration check to the active provider adapter.
    let activeProvider = getProvider();
    if (!activeProvider.isConfigured()) {
      if (hasProvider("flipia")) {
        activeProvider = getProvider("flipia");
      } else if (hasProvider("pollinations")) {
        activeProvider = getProvider("pollinations");
      }
    }

    // Who the agent acts for: the sender of THIS message, resolved exactly the
    // way the command dispatcher resolves them, and frozen. The tools
    // authorize against it and nothing else — not the quoted message's author,
    // not a name in a web page, not anything the model writes into arguments.
    const caller = await resolveCaller({ msg, sock, groupMetadata, text: body || "" });

    // Mentions/replies are targets or context.
    const targets = [...caller.mentionedJids, caller.quotedParticipant].filter(Boolean);
    const myJid = sock?.user?.id ? normalizeJid(sock.user.id) : null;
    const validTargets = [...new Set(targets)]
      .map((t) => normalizeJid(t))
      .filter((t) => t && t !== myJid && t !== normalizedSenderId);

    const rawPromptText = prompt || "";
    const roastKeywordMatch = /(\broast\b|روسٹ|zalil|bezzat|dhulai|class\s*lo|isko\s*batao|burn\b|cook\b|destroy\b|suar|kuta|kutta|bc|bsdk|fuck|bitch|dog|pig|harami|kamina|chirkut|chapri)/i.test(
      rawPromptText,
    );
    const currentChatMode = aiMood.getChatMode(chatId, normalizedSenderId);
    const elderInfo = aiMood.detectElderRelationship({
      senderName: userName,
      chatName: caller.chatName,
      senderId: normalizedSenderId,
    }, rawPromptText);

    const isTargetedRoast = Boolean(
      !elderInfo.isElder && (
        ctx?.isTargetedRoast ||
        (validTargets.length > 0 && (roastKeywordMatch || currentChatMode === "roast")) ||
        (roastKeywordMatch && (validTargets.length > 0 || args.length > 0))
      )
    );

    let targetInfo = ctx?.targetInfo || null;
    if (!targetInfo && validTargets.length > 0) {
      const primaryTarget = validTargets[0];
      const targetPhone = primaryTarget.split("@")[0];
      targetInfo = {
        targetJid: primaryTarget,
        targetTag: `@${targetPhone}`,
        allTargets: validTargets,
      };
    } else if (!targetInfo && isTargetedRoast) {
      if (rawPromptText.toLowerCase().includes(" me") || rawPromptText.toLowerCase().startsWith("me") || rawPromptText.toLowerCase().includes("mujhe")) {
        targetInfo = {
          targetJid: normalizedSenderId,
          targetTag: userName ? `@${userName}` : `@${(normalizedSenderId || "user").split("@")[0]}`,
          allTargets: [normalizedSenderId].filter(Boolean),
        };
      }
    }

    const agentContext = {
      caller,
      // Infrastructure, not identity: tools that post media (speak, poll)
      // send through the socket this run started with. Who they act for is
      // `caller` and only `caller`.
      sock,
      // What the system prompt tells the model about the conversation.
      chatId,
      sessionKey,
      senderId: caller.senderId,
      senderName: userName,
      isOwner: caller.isOwner,
      isAdmin: caller.isOwner || caller.isBotAdmin,
      isGroup,
      chatName: caller.chatName,
      latestUserText: prompt,
      targetInfo,
      isTargetedRoast,
    };

    if (isTargetedRoast) {
      const targetTag = targetInfo?.targetTag || userName || "friend";
      const targetJid = targetInfo?.targetJid || "friend";
      parts.unshift({
        text: `[TARGETED FRIEND ROAST REQUEST]\n` +
          `Target friend to roast: ${targetTag} (${targetJid})\n` +
          `Requested by: ${userName || "User"} (${normalizedSenderId || "sender"})\n` +
          `Instruction: Directly target ${targetTag} with savage, witty, hilarious, and spicy burns! Tag them directly as "${targetTag}" in your response. You are authorized to use raw authentic Pakistani/Desi slang and playful curse words (suar, kuta, bc, bsdk, dala, dog, pig, bitch, fuck, chapri, chirkut, etc.) for close friends banter ("friends wala mazak"). Deliver lethal, unforgettable comedic burns!`,
      });
    } else if (targets.length) {
      parts.unshift({
        text: tr(
          `(IDs mentioned in the message: ${[...new Set(targets)].join(", ")})`,
          `(معرفات مذكورة في الرسالة: ${[...new Set(targets)].join(", ")})`,
        ),
      });
    }

    const isAutoReply = Boolean(ctx?.isAutoReply || ctx?.silentStatus);

    await withSessionLock(sessionKey, async () => {
      // The one message that will carry the whole run (silent in auto-reply / human mode)
      const status = await createStatus(
        sock,
        chatId,
        tr("🤖 Thinking...", "🤖 جارٍ التفكير...", "🤖 Soch raha hoon..."),
        {
          replyTo: msg,
          silent: isAutoReply,
        },
      );

      async function attempt(historyOverride) {
        const history = historyOverride ?? ((await getChatHistoryAsync(sessionKey)) || []);
        const result = await runAgent({
          parts,
          history,
          status,
          context: agentContext,
          provider: activeProvider,
        });
        if (result.history?.length) {
          await saveChatHistoryAsync(sessionKey, result.history);
        }
        return result;
      }

      try {
        let result;
        try {
          result = await attempt();
        } catch (firstErr) {
          // A dead fileData URI in the history poisons every later call — scrub
          // it once and retry so the user never sees the expiry.
          if (isFileReferenceError(firstErr)) {
            const oldHistory = (await getChatHistoryAsync(sessionKey)) || [];
            const cleaned = sanitizeHistoryForFiles(oldHistory);
            await saveChatHistoryAsync(sessionKey, cleaned);
            logger.info(
              `[Gemini] sanitized history for session ${sessionKey}: ${oldHistory.length} -> ${cleaned.length}; retrying once`,
            );
            result = await attempt(cleaned);
          } else {
            // If the model/SDK rejected history formatting or had tool desynchronization,
            // sanitize history to clean text turns and retry once to keep context alive!
            const oldHistory = (await getChatHistoryAsync(sessionKey)) || [];
            if (oldHistory.length > 0) {
              logger.warn(
                { err: firstErr?.message },
                `[Gemini] History error for session ${sessionKey}; recovering with text-only turns to preserve context`,
              );
              const cleaned = sanitizeHistoryForSession(oldHistory);
              await saveChatHistoryAsync(sessionKey, cleaned);
              result = await attempt(cleaned);
            } else {
              throw firstErr;
            }
          }
        }

        const text =
          result.text?.trim() ||
          tr(
            "The model sent no answer. Try asking another way.",
            "لم يردّ النموذج. حاول صياغة السؤال بطريقة أخرى.",
            "Model ne koi jawab nahi diya. Dubara pooch k dekhein.",
          );
        // Appended only when Gemini really grounded the answer on a search —
        // formatSources() returns "" for an answer the model gave from its own
        // knowledge, so there is never a Sources block with nothing behind it.
        let responseText = formatMarkdownForWhatsApp(`${text}${formatSources(result.sources)}`);

        // Check for emoji reaction directive from the AI, e.g. [REACT: 👍], [REACT: 😂], [REACT: ❤️]
        const autoReactEnabled = settings.get("ai_auto_react") !== false;
        const reactMatch = responseText.match(/\[REACT:\s*([\p{Emoji}\u200d\uFE0F\S]+?)\]/u);
        if (reactMatch) {
          const reactionEmoji = reactMatch[1].trim();
          responseText = responseText.replace(reactMatch[0], "").trim();
          if (autoReactEnabled) {
            try {
              await sock.sendMessage(rawChatId, {
                react: {
                  text: reactionEmoji,
                  key: msg.key,
                },
              });
            } catch (reactErr) {
              logger.debug({ err: reactErr?.message }, "[Gemini] Failed to send reaction");
            }
          }
        }

        // If the AI only reacted (no remaining text), remove status placeholder and finish
        if (!responseText && reactMatch) {
          await status.remove();
          return;
        }

        // Extract all mentioned @phone numbers from text and combine with validTargets
        const textMentions = (responseText.match(/@(\d{7,16})/g) || []).map(
          (m) => `${m.replace("@", "")}@s.whatsapp.net`,
        );
        const allOutboundMentions = [...new Set([...validTargets, ...textMentions])];

        await status.finish(responseText, { mentions: allOutboundMentions });
      } catch (error) {
        logger.error({ err: error }, "Error in !gemini command");
        await status.fail(
          error,
          tr(
            "Something went wrong while talking to the AI",
            "حصلت مشكلة وأنا بكلم الذكاء الاصطناعي",
            "AI se baat karne me koi masla hua",
          ),
        );
      }
    });
  },
};

module.exports.clearAllContextBuffers = clearAllContextBuffers;
