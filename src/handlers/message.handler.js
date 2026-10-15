import { createRequire } from "module";
import { handleAntiSpam } from "../middleware/antispam.middleware.js";
import { checkBlacklist } from "../middleware/blacklist.middleware.js";
import { trackForwardedMessage } from "../middleware/forward-tracking.middleware.js";
import normalizeJid from "../utils/normalizeJid.esm.js";
import { getSenderCandidates, isBotAdminInGroup, sameUser } from "../utils/permissions.esm.js";
import { rememberMessage } from "../utils/recentMessageCache.esm.js";
import { saveUserMetadata, updateUserLastSeen } from "../utils/storage.esm.js";
import { handleCommand, getLoadedCommands } from "./command.handler.js";

const require = createRequire(import.meta.url);
const logger = require("../utils/logger.cjs");
const { visibleText } = require("../utils/messageContent.cjs");
const { detectLang, withLang } = require("../utils/i18n.cjs");
const autoDelete = require("../services/autoDelete.cjs");
const settings = require("../config/settings.cjs");
const { getProvider, hasProvider } = require("../services/aiRouter.cjs");
const { resolveGroupMetadata } = require("../utils/groupMetadataCache.cjs");
const botAccess = require("../services/botAccess.cjs");

// Envelopes that carry no user-visible content: message revokes and edits
// (protocolMessage), reactions, poll votes, the undecrypted edit envelope, and
// the sibling keys WhatsApp ships alongside a real message.
//
// These used to be swallowed by the anti-delete handler, which returned early
// on them. With that handler gone they have to be filtered here instead —
// otherwise they reach group moderation, where anti-spam counts each one as a
// message from the sender and deleting a few of your own messages in a row
// gets you warned or kicked.
const NON_CONTENT_KEYS = new Set([
  "protocolMessage",
  "reactionMessage",
  "pollUpdateMessage",
  "secretEncryptedMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
]);

// True when the envelope holds something a person actually sent. Note the
// `.some()`: WhatsApp routinely ships senderKeyDistributionMessage next to a
// real `conversation`, so we look for any content key rather than testing the
// first one.
function hasUserContent(message) {
  if (!message) return false;
  return Object.keys(message).some((key) => !NON_CONTENT_KEYS.has(key));
}

// Handle incoming messages
export async function handleIncomingMessage(sock, m) {
  if (m.type !== "notify" || !m.messages[0]) return;

  const msg = m.messages[0];

  // "Message absent from node" is a CIPHERTEXT placeholder: the message node
  // arrived but its content couldn't be decrypted (Baileys requests a resend).
  if (msg?.messageStubParameters?.[0] === "Message absent from node") {
    logger.debug("[Message] Skipping undecryptable/absent message stub");
    return;
  }

  // Baileys' getMessage hook needs to hand back messages WE sent when a peer
  // asks for a retry (see utils/recentMessageCache.esm.js). Only our own
  // outgoing messages are kept, in memory, and only for that purpose.
  if (msg.key?.fromMe && msg.key.id && msg.message) {
    rememberMessage(msg.key.id, msg);
  }

  if (!hasUserContent(msg.message)) return;

  // Track forwarded messages
  await trackForwardedMessage(msg);

  // Skip onward processing for status broadcasts and newsletters.
  if (
    msg.key.remoteJid === "status@broadcast" ||
    msg.key.remoteJid?.endsWith("@broadcast") ||
    msg.key.remoteJid?.endsWith("@newsletter")
  ) {
    return;
  }

  // Parse message context. Crucially we ALSO consider media captions —
  // otherwise sending an image with caption "!gemini حلل ده" is invisible
  // to the command handler and the user sees nothing happen.
  const body = visibleText(msg.message);

  // Keyword auto-delete: after content/status skip, before blacklist/commands
  // /moderation. A successful delete stops the rest of the pipeline.
  try {
    const deleted = await autoDelete.handleIncoming(sock, msg, body, {
      sameUser,
      getSenderCandidates,
      isBotAdminInGroup,
    });
    if (deleted) return;
  } catch (error) {
    logger.error({ err: error }, "auto-delete hook failed");
  }

  // If the message is from the account owner and not a command, record it in chat history
  // so the AI knows what the owner previously said when the other person replies!
  if (msg.key?.fromMe && body && typeof body === "string") {
    const rawChatId = msg.key.remoteJid;
    const prefix = runtimeConfig.getPrefix();
    if (
      !body.startsWith(prefix) &&
      rawChatId &&
      !rawChatId.endsWith("@g.us") &&
      !rawChatId.includes("@broadcast") &&
      !rawChatId.includes("@newsletter")
    ) {
      const { recordOutgoingTurnAsync } = require("../utils/storage-hub.cjs");
      recordOutgoingTurnAsync(normalizeJid(rawChatId), body).catch(() => {});
    }
  }

  // Everything the bot says about this message — a moderation warning, a
  // command's reply — goes out in one language (see utils/i18n.cjs). A
  // command narrows this down to its own arguments.
  return withLang(detectLang(body), () => processMessage(sock, msg, body));
}

async function processMessage(sock, msg, body) {
  const isGroup = msg.key.remoteJid.endsWith("@g.us");

  // Update user metadata (last seen)
  const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
  if (senderId && !senderId.includes("@broadcast") && !senderId.includes("@newsletter")) {
    try {
      saveUserMetadata({
        jid: senderId,
        lid: null,
        phone: senderId.split("@")[0],
        displayName: msg.pushName || null,
      });
      updateUserLastSeen(senderId);
    } catch (err) {
      logger.error({ err }, "Failed to update user metadata");
    }
  }

  // Enforce Bot Access Mode (public, onlyme/self, specific allowed groups, dm_only)
  if (!botAccess.isMessageAllowed(sock, msg, isGroup)) {
    return;
  }

  if (isGroup) {
    const isBlacklisted = await checkBlacklist(sock, msg);
    if (isBlacklisted) return;
  }

  // Try to handle as command
  try {
    const wasCommand = await handleCommand(sock, msg, body);
    if (wasCommand) {
      logger.info(`[Message] Handled as command: "${body}"`);
      return;
    }
  } catch (error) {
    logger.error({ err: error }, "Error handling command");
  }

  // Handle regular group messages (moderation)
  if (isGroup) {
    await handleGroupModeration(sock, msg);
  }

  // Handle direct AI auto-response (DMs or mentions in groups)
  try {
    await handleAutoAiReply(sock, msg, body, isGroup);
  } catch (error) {
    logger.error({ err: error }, "Error in auto AI reply");
  }
}

async function handleAutoAiReply(sock, msg, body, isGroup) {
  if (msg.key?.fromMe) return false;

  const hasVoice = Boolean(msg.message?.audioMessage);
  const hasImage = Boolean(msg.message?.imageMessage);
  const hasVideo = Boolean(msg.message?.videoMessage);
  const hasDocument = Boolean(msg.message?.documentMessage);
  const hasMedia = hasVoice || hasImage || hasVideo || hasDocument;

  const rawText = String(body || "").trim();
  if (!rawText && !hasMedia) return false;

  const autoDm = settings.get("ai_auto_reply_dm");
  const autoMention = settings.get("ai_auto_reply_mention");

  let shouldReply = false;
  let cleanText = rawText;
  if (!cleanText && hasVoice) cleanText = "";
  else if (!cleanText && hasImage) cleanText = "";
  else if (!cleanText && hasVideo) cleanText = "";
  else if (!cleanText && hasDocument) cleanText = "";

  const chatId = normalizeJid(msg.key.remoteJid);
  const { getChatAutoReply } = require("../services/aiAutoReply.cjs");
  const chatPolicy = getChatAutoReply(chatId);

  if (!isGroup) {
    if (autoDm && chatPolicy !== "off") {
      shouldReply = true;
    }
  } else {
    if (chatPolicy === "off") {
      shouldReply = false;
    } else if (chatPolicy === "all") {
      shouldReply = true;
    } else if (chatPolicy === "mention" && autoMention) {
      const botJid = normalizeJid(sock.user?.id);
      const botNum = botJid ? botJid.split("@")[0] : null;
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;

      const mentionedJids = (contextInfo?.mentionedJid || []).map(normalizeJid);
      const isMentioned = Boolean(botJid && mentionedJids.includes(botJid));

      // In groups, only auto-reply when the bot is explicitly tagged/mentioned (@bot).
      // Simply quoting an old bot message to discuss it with a friend will NOT trigger the bot!
      if (isMentioned) {
        shouldReply = true;
        if (botNum && cleanText) {
          cleanText = cleanText.replace(new RegExp(`@${botNum}\\b`, "gi"), "").trim();
        }
      }
    }
  }

  if (!shouldReply) return false;

  try {
    let provider = getProvider();
    if (!provider || !provider.isConfigured()) {
      if (hasProvider("flipia")) {
        provider = getProvider("flipia");
      } else {
        return false;
      }
    }

    const geminiCmd = getLoadedCommands().get("gemini");
    if (!geminiCmd) return false;

    const groupMeta = isGroup ? await resolveGroupMetadata(sock, msg.key.remoteJid) : null;
    logger.info({ chat: msg.key.remoteJid, isGroup }, "[AI] Direct auto-response triggered");
    await geminiCmd.execute(sock, msg, cleanText.split(/ +/), cleanText, groupMeta, {
      invokedName: "ai",
      isAutoReply: true,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "[AI] Direct auto-response failed");
    return false;
  }
}

// Handle group moderation
async function handleGroupModeration(sock, msg) {
  try {
    const { handleAntiLink } = require("../commands/group/antilink.cjs");
    const { handleMediaControl } = require("../commands/group/media.cjs");
    const { handleForbiddenWords } = require("../commands/mod.cjs");

    const wordActionTaken = await handleForbiddenWords(sock, msg);
    if (wordActionTaken) return;

    const linkActionTaken = await handleAntiLink(sock, msg, {}, normalizeJid);
    if (linkActionTaken) return;

    const mediaActionTaken = await handleMediaControl(sock, msg, {}, normalizeJid);
    if (mediaActionTaken) return;

    await handleAntiSpam(sock, msg);
  } catch (error) {
    logger.error({ err: error }, "Error in group moderation");
  }
}
