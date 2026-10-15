// Bot Access Mode & Group Whitelisting Command (Owner Only)
// Allows switching between:
// - Public (Works everywhere)
// - Only Me (Owner only)
// - Specific Groups (Whitelisted groups only)
// - DM Only (Private chats only)

const botAccess = require("../services/botAccess.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const { isOwnerJidSync } = require("../utils/permissions.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const { tr } = require("../utils/i18n.cjs");

module.exports = {
  name: "botmode",
  aliases: [
    "workmode",
    "scope",
    "allow",
    "disallow",
    "allowdm",
    "disallowdm",
    "allowgroup",
    "disallowgroup",
    "whitelist",
    "allowed",
    "allowedlist",
    "groupscope",
    "onlyme",
  ],
  description: {
    en: "Controls bot work mode: public, onlyme (self), specific groups, or whitelist. Manually allow specific individual contacts and groups.",
    ur: "بوٹ کے کام کرنے کا دائرہ کار: پبلک، صرف میں (Only Me)، مخصوص گروپس، یا مخصوص منظور شدہ کانٹیکٹس (Whitelist)۔",
    ar: "التحكم في نطاق عمل البوت: عام، خاص بالمالك فقط (Only Me)، مجموعات محددة، أو قائمة المسموح لهم (Whitelist).",
  },
  usage: {
    en: "!allow (whitelists this chat/contact)\n!disallow (removes this chat)\n!allowed (lists all allowed chats)\n!botmode whitelist\n!botmode public",
    ur: "!allow (اس کانٹیکٹ یا گروپ کو منظور کریں)\n!disallow (اسے لسٹ سے ہٹائیں)\n!allowed (منظور شدہ کانٹیکٹس کی لسٹ دیکھیں)\n!botmode whitelist (صرف منظور شدہ چیٹس کے لیے)\n!botmode public (سب کے لیے کھلا)",
    ar: "!allow (السماح لهذه المحادثة/جهة الاتصال)\n!disallow (إزالة من القائمة)\n!allowed (عرض القائمة المسموحة)\n!botmode whitelist\n!botmode public",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, ctx = {}) {
    const rawChatId = msg.key.remoteJid;
    const isGroup = rawChatId.endsWith("@g.us");
    const senderId = normalizeJid(isGroup ? msg.key.participant : rawChatId);
    const isOwner = Boolean(msg.key.fromMe || isOwnerJidSync(senderId));

    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    // Strict Owner Only Protection
    if (!isOwner) {
      return reply(
        tr(
          "🚫 Only the bot owner can change the bot access mode or manage allowed groups.",
          "🚫 هذا الأمر مخصص لمالك البوت فقط لتحديد نطاق عمل البوت.",
          "🚫 Sirf bot owner hi access mode ya allowed chats change kar sakta hy."
        )
      );
    }

    const invoked = (ctx?.invokedName || "").toLowerCase();
    const prefix = runtimeConfig.getPrefix();
    let action = (args[0] || "").toLowerCase().trim();

    // Direct alias shortcuts:
    if (invoked === "onlyme") {
      action = "onlyme";
    } else if (invoked === "allow" || invoked === "allowgroup" || invoked === "allowdm") {
      action = "allow";
    } else if (invoked === "disallow" || invoked === "disallowgroup" || invoked === "disallowdm") {
      action = "disallow";
    } else if (invoked === "allowed" || invoked === "allowedlist" || (invoked === "whitelist" && (!args[0] || args[0] === "list"))) {
      action = "list";
    }

    // 1. Allow Shortcut (Groups or DMs)
    if (action === "allow" || action === "add") {
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;
      const quoted = contextInfo?.participant;
      const mentioned = contextInfo?.mentionedJid?.[0];

      let candidate = null;
      for (const a of args) {
        if (!a) continue;
        const lower = a.toLowerCase();
        if (lower === "allow" || lower === "add" || lower === "dm" || lower === "group") continue;
        candidate = a;
        break;
      }
      let rawTarget = candidate || mentioned || quoted || rawChatId;

      let target = normalizeJid(rawTarget);
      if (!target.includes("@") || target === "@s.whatsapp.net") {
        const digits = String(rawTarget).replace(/\D/g, "");
        if (digits) {
          target = `${digits}@s.whatsapp.net`;
        } else {
          target = normalizeJid(rawChatId);
        }
      }
      const targetIsGroup = target.endsWith("@g.us");

      if (targetIsGroup) {
        const subject = isGroup && normalizeJid(rawChatId) === target ? groupMetadata?.subject || "Group" : null;
        const added = botAccess.addAllowedGroup(target, subject);

        const currentMode = botAccess.getAccessMode();
        let modeNote = "";
        if (currentMode !== "groups" && currentMode !== "whitelist") {
          botAccess.setAccessMode("whitelist");
          modeNote = "\n🔄 _Switched Bot Mode to **Whitelist** (authorized chats only)._";
        }

        if (added) {
          return reply(`✅ Group added to allowed list!${modeNote}\n🏷️ *Name:* ${subject || "Group"}\n🆔 *ID:* \`${target}\`\n\n_Sirf is group aur doosre allowed chats me bot active rahega._`);
        } else {
          return reply(`ℹ️ This group is already in the allowed list.${modeNote}`);
        }
      } else {
        // Personal DM whitelist
        const dmPhone = target.split("@")[0];
        let contactName = null;
        try {
          const { getUserMetadata } = require("../db/store.cjs");
          const meta = getUserMetadata(target);
          contactName = meta?.savedName || meta?.displayName || null;
        } catch {}

        const added = botAccess.addAllowedDm(target, contactName || dmPhone);

        const currentMode = botAccess.getAccessMode();
        let modeNote = "";
        if (currentMode !== "whitelist" && currentMode !== "groups") {
          botAccess.setAccessMode("whitelist");
          modeNote = "\n🔄 _Switched Bot Mode to **Whitelist** (authorized chats only)._";
        }

        const nameLabel = contactName ? ` (${contactName})` : "";
        if (added) {
          return reply(`✅ *Contact Allowed (Whitelisted)!*${modeNote}\n\n👤 *Contact:* \`${dmPhone}\`${nameLabel}\n🆔 *ID:* \`${target}\`\n\n🔒 *Security:* Bot ab SIRF is contact aur specifically allowed chats ko reply karega! Anjaan aur baaqi sab logon ko ignore karega.`);
        } else {
          return reply(`ℹ️ This contact is already in the allowed list.${modeNote}`);
        }
      }
    }

    // 2. Disallow Shortcut (Groups or DMs)
    if (action === "disallow" || action === "remove" || action === "del") {
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;
      const quoted = contextInfo?.participant;
      const mentioned = contextInfo?.mentionedJid?.[0];

      let candidate = null;
      for (const a of args) {
        if (!a) continue;
        const lower = a.toLowerCase();
        if (lower === "disallow" || lower === "remove" || lower === "del" || lower === "dm" || lower === "group") continue;
        candidate = a;
        break;
      }
      let rawTarget = candidate || mentioned || quoted || rawChatId;

      let target = normalizeJid(rawTarget);
      if (!target.includes("@") || target === "@s.whatsapp.net") {
        const digits = String(rawTarget).replace(/\D/g, "");
        if (digits) {
          target = `${digits}@s.whatsapp.net`;
        } else {
          target = normalizeJid(rawChatId);
        }
      }
      const targetIsGroup = target.endsWith("@g.us");

      if (targetIsGroup) {
        const removed = botAccess.removeAllowedGroup(target);
        if (removed) {
          return reply(`🚫 Group removed from allowed list: \`${target}\`\n_Bot ab is group me reply nahi karega._`);
        } else {
          return reply(`ℹ️ This group was not in the allowed list.`);
        }
      } else {
        const removed = botAccess.removeAllowedDm(target);
        if (removed) {
          return reply(`🚫 Contact removed from allowed list: \`${target}\`\n_Bot ab is contact ko reply nahi karega._`);
        } else {
          return reply(`ℹ️ This contact was not in the allowed list.`);
        }
      }
    }

    // 3. Allowed List (Groups & DMs)
    if (action === "list" || action === "groups_list" || action === "whitelist") {
      const allowedGroups = botAccess.getAllowedGroups();
      const allowedDms = botAccess.getAllowedDms();
      const currentMode = botAccess.getAccessMode();
      const currentMeta = botAccess.ACCESS_MODES[currentMode] || botAccess.ACCESS_MODES.public;

      let listText = `🎯 *AUTHORIZED & WHITELISTED CHATS*\n\n`;
      listText += `⚙️ *Active Mode:* ${currentMeta.emoji} *${currentMeta.label}*\n\n`;

      listText += `💬 *Allowed Personal Contacts (${allowedDms.length}):*\n`;
      if (allowedDms.length) {
        listText += allowedDms
          .map((d, idx) => {
            const id = typeof d === "string" ? d : d.id;
            const name = typeof d === "object" && d.name ? `*${d.name}* — ` : "";
            return `${idx + 1}. ${name}\`${id}\``;
          })
          .join("\n");
      } else {
        listText += "_(No contacts allowed yet — use `!allow` to add)_\n";
      }

      listText += `\n\n👥 *Allowed Groups (${allowedGroups.length}):*\n`;
      if (allowedGroups.length) {
        listText += allowedGroups
          .map((g, idx) => {
            const id = typeof g === "string" ? g : g.id;
            const name = typeof g === "object" && g.subject ? `*${g.subject}* — ` : "";
            return `${idx + 1}. ${name}\`${id}\``;
          })
          .join("\n");
      } else {
        listText += "_(No groups allowed yet)_\n";
      }

      listText += `\n\n💡 *Shortcuts:*
• \`${prefix}allow\` — Allow current chat/contact
• \`${prefix}allow <number>\` — Allow by phone number
• \`${prefix}disallow\` — Remove current chat
• \`${prefix}botmode whitelist\` — Strict whitelist mode`;

      return reply(listText);
    }

    // 4. Change Access Mode:
    const targetMode = botAccess.normalizeAccessMode(action);
    if (targetMode) {
      botAccess.setAccessMode(targetMode);
      const meta = botAccess.ACCESS_MODES[targetMode];

      return reply(
        tr(
          `⚙️ *Bot Work Mode Updated!*

Active Scope: ${meta.emoji} *${meta.label}* (\`${meta.id}\`)
ℹ️ _${meta.desc}_`,
          `⚙️ *تم تحديث نطاق عمل البوت!*

الوضع النشط: ${meta.emoji} *${meta.label}* (\`${meta.id}\`)
ℹ️ _${meta.desc}_`,
          `⚙️ *Bot Ka Work Mode Update Ho Gaya!*

Active Scope: ${meta.emoji} *${meta.label}* (\`${meta.id}\`)
ℹ️ _${meta.desc}_`
        )
      );
    }

    // 5. Default: Show Current Status & Help Menu
    const currentMode = botAccess.getAccessMode();
    const currentMeta = botAccess.ACCESS_MODES[currentMode] || botAccess.ACCESS_MODES.public;
    const allowed = botAccess.getAllowedGroups();

    const text = tr(
      `🛡️ *Bot Access & Scope Control* (Owner)

⚙️ *Current Mode:* ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)
📝 _${currentMeta.desc}_
👥 *Authorized Groups:* ${allowed.length} group(s)

*Available Modes:*
• \`${prefix}botmode public\` — 🌍 Public (Responds to everyone everywhere)
• \`${prefix}botmode onlyme\` — 🔒 Only Me (Responds ONLY to Owner, ignores others)
• \`${prefix}botmode specific\` — 👥 Specific Groups (Only whitelisted groups + DMs)
• \`${prefix}botmode dm\` — 💬 DM Only (Responds only in private DMs, ignores groups)

*Group Management:*
• \`${prefix}botmode allow\` — Whitelist the current group
• \`${prefix}botmode disallow\` — Remove the current group
• \`${prefix}botmode list\` — View all authorized groups`,
      `🛡️ *التحكم في نطاق عمل البوت* (للمالك)

⚙️ *الوضع الحالي:* ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)
📝 _${currentMeta.desc}_
👥 *المجموعات المصرح بها:* ${allowed.length} مجموعة

*أوضاع العمل المتاحة:*
• \`${prefix}botmode public\` — 🌍 عام (يعمل في كل المجموعات والخاص)
• \`${prefix}botmode onlyme\` — 🔒 خاص بي فقط (يتجاهل الجميع ما عدا المالك)
• \`${prefix}botmode specific\` — 👥 مجموعات محددة (يعمل فقط في المجموعات المسموح بها)
• \`${prefix}botmode dm\` — 💬 خاص فقط (يعمل فقط في الخاص ويتجاهل المجموعات)

*إدارة المجموعات:*
• \`${prefix}botmode allow\` — تفعيل البوت في المجموعة الحالية
• \`${prefix}botmode disallow\` — إلغاء تفعيل المجموعة الحالية
• \`${prefix}botmode list\` — عرض قائمة المجموعات المفعلة`,
      `🛡️ *Bot Access & Scope Control* (Owner Only) — Daira-e-Kaar

⚙️ *Mojuda Mode:* ${currentMeta.emoji} *${currentMeta.label}* (\`${currentMode}\`)
📝 _${currentMeta.desc}_
👥 *Authorized Groups:* ${allowed.length} group(s)

*Mode Ke Options:*
• \`${prefix}botmode public\` — 🌍 Sab ke liye khula (Har jagah reply karega)
• \`${prefix}botmode onlyme\` — 🔒 Sirf mere liye (Owner ke ilawa sab ignore karega)
• \`${prefix}botmode specific\` — 👥 Makhsoos Groups (Sirf whitelisted groups + DMs)
• \`${prefix}botmode dm\` — 💬 Sirf Private DMs (Groups ko ignore karega)

*Whitelist Management:*
• \`${prefix}botmode allow\` — Is group ya number ko allow/whitelist karein
• \`${prefix}botmode disallow\` — Is group ya number ko remove karein
• \`${prefix}botmode list\` — Whitelisted groups aur DMs ki list dekhein`
    );

    return reply(text);
  },
};
