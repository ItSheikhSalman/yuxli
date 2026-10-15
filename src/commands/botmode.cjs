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
  aliases: ["workmode", "scope", "allowgroup", "disallowgroup", "groupscope", "onlyme"],
  description: {
    en: "Controls bot work mode: public, onlyme (self), specific groups, or dm_only. Manage whitelisted groups.",
    ur: "بوٹ کے کام کرنے کا دائرہ کار: پبلک، صرف میں (Only Me)، مخصوص گروپس، یا صرف DM۔",
    ar: "التحكم في نطاق عمل البوت: عام، خاص بالمالك فقط (Only Me)، مجموعات محددة، أو محادثات خاصة فقط.",
  },
  usage: {
    en: "botmode\nbotmode public\nbotmode onlyme\nbotmode specific\nbotmode dm\nbotmode allow\nbotmode disallow\nbotmode list",
    ur: "botmode (سٹیٹس دیکھیں)\nbotmode public (سب کے لیے کھلا)\nbotmode onlyme (صرف میرے لیے)\nbotmode specific (صرف منظور شدہ گروپس)\nbotmode dm (صرف پرائیویٹ چیٹس)\nbotmode allow (اس گروپ کو منظور کریں)\nbotmode disallow (اس گروپ کو ہٹائیں)\nbotmode list (منظور شدہ گروپس کی لسٹ)",
    ar: "botmode\nbotmode public\nbotmode onlyme\nbotmode specific\nbotmode dm\nbotmode allow\nbotmode disallow\nbotmode list",
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
    } else if (invoked === "allowgroup") {
      action = "allow";
    } else if (invoked === "disallowgroup") {
      action = "disallow";
    }

    // 1. Allow Shortcut (Groups or DMs)
    if (action === "allow" || action === "add") {
      let target = args[1] ? normalizeJid(args[1]) : normalizeJid(rawChatId);
      if (!target.includes("@")) {
        target = `${target.replace(/\D/g, "")}@s.whatsapp.net`;
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
          return reply(`✅ Group added to allowed list!${modeNote}\n🏷️ *Name:* ${subject || "Group"}\n🆔 *ID:* \`${target}\``);
        } else {
          return reply(`ℹ️ This group is already in the allowed list.${modeNote}`);
        }
      } else {
        // Personal DM whitelist
        const dmPhone = target.split("@")[0];
        const added = botAccess.addAllowedDm(target, dmPhone);

        const currentMode = botAccess.getAccessMode();
        let modeNote = "";
        if (currentMode !== "whitelist" && currentMode !== "groups") {
          botAccess.setAccessMode("whitelist");
          modeNote = "\n🔄 _Switched Bot Mode to **Whitelist** (authorized chats only)._";
        }

        if (added) {
          return reply(`✅ Personal DM added to allowed list!${modeNote}\n👤 *Contact:* \`${dmPhone}\`\n🆔 *ID:* \`${target}\``);
        } else {
          return reply(`ℹ️ This user/DM is already in the allowed list.${modeNote}`);
        }
      }
    }

    // 2. Disallow Shortcut (Groups or DMs)
    if (action === "disallow" || action === "remove" || action === "del") {
      let target = args[1] ? normalizeJid(args[1]) : normalizeJid(rawChatId);
      if (!target.includes("@")) {
        target = `${target.replace(/\D/g, "")}@s.whatsapp.net`;
      }
      const targetIsGroup = target.endsWith("@g.us");

      if (targetIsGroup) {
        const removed = botAccess.removeAllowedGroup(target);
        if (removed) {
          return reply(`🚫 Group removed from allowed list: \`${target}\``);
        } else {
          return reply(`ℹ️ This group was not in the allowed list.`);
        }
      } else {
        const removed = botAccess.removeAllowedDm(target);
        if (removed) {
          return reply(`🚫 Personal DM removed from allowed list: \`${target}\``);
        } else {
          return reply(`ℹ️ This user/DM was not in the allowed list.`);
        }
      }
    }

    // 3. Allowed List (Groups & DMs)
    if (action === "list" || action === "groups_list" || action === "whitelist") {
      const allowedGroups = botAccess.getAllowedGroups();
      const allowedDms = botAccess.getAllowedDms();

      if (!allowedGroups.length && !allowedDms.length) {
        return reply("📋 *No groups or personal DMs whitelisted yet.*\nUse `!botmode allow` inside any chat to authorize it.");
      }

      let listText = "🎯 *AUTHORIZED WHITELISTED CHATS*\n\n";

      listText += `👥 *Groups (${allowedGroups.length}):*\n`;
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

      listText += `\n\n💬 *Personal DMs (${allowedDms.length}):*\n`;
      if (allowedDms.length) {
        listText += allowedDms
          .map((d, idx) => {
            const id = typeof d === "string" ? d : d.id;
            const name = typeof d === "object" && d.name ? `*${d.name}* — ` : "";
            return `${idx + 1}. ${name}\`${id}\``;
          })
          .join("\n");
      } else {
        listText += "_(No personal DMs allowed yet)_\n";
      }

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
