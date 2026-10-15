// Model, Provider & API Key Failover Management Command
// Allows viewing and changing AI models, providers, and multi-key rotation from WhatsApp.

const settings = require("../config/settings.cjs");
const aiFailover = require("../services/aiFailover.cjs");
const { sendBotMessage } = require("../utils/sendBotMessage.cjs");
const { isOwnerJidSync } = require("../utils/permissions.cjs");
const normalizeJid = require("../utils/normalizeJid.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const { tr } = require("../utils/i18n.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "model",
  aliases: ["models", "aimodel", "provider", "aiprovider", "ماڈل"],
  description: {
    en: "View or change AI provider, models, and multi-key failover configuration.",
    ur: "AI ماڈلز، پرووائیڈر (Groq, Gemini, Free) اور آٹو ٹوکن چینجر دیکھیں یا تبدیل کریں۔",
    ar: "عرض أو تغيير نموذج ومزود الذكاء الاصطناعي وإعدادات تدوير المفاتيح التلقائي.",
  },
  usage: {
    en: "model\nmodel list\nmodel <model_name>\nprovider <groq|gemini|auto|flipia|pollinations|openai|anthropic>\nmodel key <provider> <key1,key2,...>",
    ur: "model\nmodel list\nmodel <ماڈل کا نام>\nprovider <groq|gemini|auto|flipia|pollinations>\nmodel key <provider> <کیز کوما کے ساتھ>",
    ar: "model\nmodel list\nmodel <اسم_النموذج>\nprovider <groq|gemini|auto|flipia|pollinations>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, ctx = {}) {
    const rawChatId = msg.key.remoteJid;
    const chatId = normalizeJid(rawChatId);
    const prefix = runtimeConfig.getPrefix();
    const invoked = (ctx?.invokedName || "").toLowerCase();

    const senderId = msg.key.fromMe ? null : chatId.endsWith("@g.us") ? msg.key.participant : rawChatId;
    const isOwner = msg.key.fromMe || isOwnerJidSync(senderId);

    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    const currentProvider = (settings.get("ai_provider") || "gemini").toLowerCase();
    const autoFallback = settings.get("ai_auto_fallback") !== false;

    // Direct invocation via alias `!provider`
    const isProviderCmd = invoked === "provider" || invoked === "aiprovider";
    const subAction = (args[0] || "").toLowerCase().trim();

    // 1. Show Catalog: !model list / !model all
    if (subAction === "list" || subAction === "all" || subAction === "catalog") {
      let catalogText = `🌐 *ALL INTERNET AI MODELS CATALOG*\n\n`;

      catalogText += `⚡ *GROQ LPU (Ultra Fast Inference):*\n`;
      for (const m of aiFailover.INTERNET_MODELS.groq) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }

      catalogText += `\n✨ *GOOGLE GEMINI:*\n`;
      for (const m of aiFailover.INTERNET_MODELS.gemini) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }

      catalogText += `\n🧠 *OPENAI & DEEPSEEK:*\n`;
      for (const m of aiFailover.INTERNET_MODELS.openai) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }

      catalogText += `\n🎭 *ANTHROPIC CLAUDE:*\n`;
      for (const m of aiFailover.INTERNET_MODELS.anthropic) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }

      catalogText += `\n🆓 *100% FREE MODELS (Zero API Key Needed):*\n`;
      catalogText += `*Flip-IA Models:*\n`;
      for (const m of aiFailover.INTERNET_MODELS.flipia) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }
      catalogText += `\n*Pollinations Free Models:*\n`;
      for (const m of aiFailover.INTERNET_MODELS.pollinations) {
        catalogText += `• \`${m.id}\` — ${m.name}\n`;
      }

      catalogText += `\n💡 *How to switch:*
• Use \`${prefix}model <model_id>\` to activate any model.
• Use \`${prefix}provider <groq|gemini|auto|flipia|pollinations>\` to switch provider.`;

      return reply(catalogText);
    }

    // 2. Set API Keys: !model key <provider> <key1,key2,...>
    if (subAction === "key" || subAction === "keys") {
      if (!isOwner) {
        return reply(tr("🚫 Only the bot owner can configure API keys.", "🚫 هذا الأمر مخصص لمالك البوت فقط.", "🚫 صرف بوٹ اونر ہی API keys سیٹ کر سکتا ہے۔"));
      }
      const targetProv = (args[1] || "").toLowerCase().trim();
      const keysInput = args.slice(2).join(" ").trim();

      const validProviders = {
        gemini: "gemini_api_key",
        groq: "groq_api_key",
        openai: "openai_api_key",
        anthropic: "anthropic_api_key",
      };

      const settingKey = validProviders[targetProv];
      if (!settingKey) {
        return reply(`❌ Invalid provider. Choose from: \`groq\`, \`gemini\`, \`openai\`, \`anthropic\`\nExample: \`${prefix}model key groq gsk_key1, gsk_key2\``);
      }

      if (!keysInput) {
        const existingKeys = aiFailover.getAllKeys(targetProv);
        return reply(`🔑 *${targetProv.toUpperCase()} Keys:*\nConfigured: *${existingKeys.length}* key(s).\n\nTo update:\n\`${prefix}model key ${targetProv} key1, key2, key3\``);
      }

      settings.set(settingKey, keysInput);
      aiFailover.resetKeyIndex(targetProv);
      const parsed = aiFailover.parseKeys(keysInput);

      return reply(`✅ Successfully configured *${parsed.length}* API key(s) for *${targetProv.toUpperCase()}*!\n⚡ Auto-rotation is active: if any key hits token/quota limits, it will instantly switch to the next key.`);
    }

    // 3. Set Provider: !provider <name> OR !model provider <name>
    if (isProviderCmd || subAction === "provider") {
      const provArg = (isProviderCmd ? args[0] : args[1] || "").toLowerCase().trim();
      if (!provArg) {
        return reply(`Current Provider: *${currentProvider.toUpperCase()}*\n\nTo switch provider:\n\`${prefix}provider <groq|gemini|auto|flipia|pollinations|openai|anthropic>\``);
      }

      if (!isOwner) {
        return reply(tr("🚫 Only the bot owner can change the AI provider.", "🚫 هذا الأمر مخصص لمالك البوت فقط.", "🚫 صرف بوٹ اونر ہی AI پرووائیڈر تبدیل کر سکتا ہے۔"));
      }

      const validChoices = ["auto", "groq", "gemini", "flipia", "pollinations", "openai", "anthropic"];
      if (!validChoices.includes(provArg)) {
        return reply(`❌ Invalid provider: \`${provArg}\`\nValid choices: ${validChoices.map((c) => `\`${c}\``).join(", ")}`);
      }

      settings.set("ai_provider", provArg);
      const activeModel = getActiveModelForProvider(provArg);

      return reply(`✅ AI Provider switched to: *${provArg.toUpperCase()}*\n🧠 Active Model: \`${activeModel}\`\n⚡ Auto-Failover: *${autoFallback ? "Enabled (Unbreakable 24/7)" : "Disabled"}*`);
    }

    // 4. Set Model: !model <model_name>
    if (subAction && subAction !== "status") {
      if (!isOwner) {
        return reply(tr("🚫 Only the bot owner can change the AI model.", "🚫 هذا الأمر مخصص لمالك البوت فقط.", "🚫 صرف بوٹ اونر ہی AI ماڈل تبدیل کر سکتا ہے۔"));
      }

      const requestedModel = args.join(" ").trim();
      const detected = resolveModel(requestedModel);

      if (!detected) {
        // Fallback: set custom model on current provider
        const modelSetting = getModelSettingKey(currentProvider);
        if (modelSetting) {
          settings.set(modelSetting, requestedModel);
          return reply(`✅ Model for *${currentProvider.toUpperCase()}* set to: \`${requestedModel}\``);
        }
        return reply(`❌ Could not identify model \`${requestedModel}\`.\nUse \`${prefix}model list\` to see all valid models.`);
      }

      // Found matching model and its provider
      const { provider: targetProvider, modelId, modelName } = detected;
      const modelSettingKey = getModelSettingKey(targetProvider);

      if (modelSettingKey) {
        settings.set(modelSettingKey, modelId);
      }

      // If user selected a model belonging to another provider, switch provider as well
      let switchedProviderMsg = "";
      if (currentProvider !== targetProvider && currentProvider !== "auto") {
        settings.set("ai_provider", targetProvider);
        switchedProviderMsg = `\n🔄 Provider switched to *${targetProvider.toUpperCase()}*`;
      }

      return reply(`✅ Model activated: *${modelName}* (\`${modelId}\`)${switchedProviderMsg}\n⚡ Auto-Failover: *Active*`);
    }

    // 5. Default: Show Current AI Status & Summary
    const groqKeys = aiFailover.getAllKeys("groq").length;
    const geminiKeys = aiFailover.getAllKeys("gemini").length;
    const openaiKeys = aiFailover.getAllKeys("openai").length;
    const anthropicKeys = aiFailover.getAllKeys("anthropic").length;

    const activeModel = getActiveModelForProvider(currentProvider);

    const statusMsg = `🤖 *AI ENGINE & MODEL STATUS*

• *Active Provider:* \`${currentProvider.toUpperCase()}\`
• *Active Model:* \`${activeModel}\`
• *Auto Token/Key Rotation:* ✅ *ACTIVE*
• *Auto Failover (Zero Downtime):* ${autoFallback ? "✅ *ACTIVE (Unbreakable 24/7)*" : "❌ *DISABLED*"}

🔑 *Configured Keys:*
• *Groq:* ${groqKeys > 0 ? `✅ ${groqKeys} Key(s) (Auto-Rotating)` : "⚠️ None (Will fallback)"}
• *Gemini:* ${geminiKeys > 0 ? `✅ ${geminiKeys} Key(s) (Auto-Rotating)` : "⚠️ None (Will fallback)"}
• *OpenAI:* ${openaiKeys > 0 ? `✅ ${openaiKeys} Key(s)` : "—"}
• *Anthropic:* ${anthropicKeys > 0 ? `✅ ${anthropicKeys} Key(s)` : "—"}
• *Flip-IA Free:* 🆓 100% Free (No Key Required)
• *Pollinations Free:* 🆓 100% Free (No Key Required)

⚡ *Quick Commands:*
• \`${prefix}model list\` — View all internet models
• \`${prefix}model <model_id>\` — Switch AI model
• \`${prefix}provider <name>\` — Switch AI provider (groq, gemini, auto, flipia, pollinations)
• \`${prefix}model key <provider> <keys>\` — Add multiple keys (comma-separated)`;

    return reply(statusMsg);
  },
};

function getModelSettingKey(provider) {
  const map = {
    gemini: "gemini_model",
    groq: "groq_model",
    openai: "openai_model",
    anthropic: "anthropic_model",
    flipia: "flipia_model",
    pollinations: "pollinations_model",
  };
  return map[provider] || null;
}

function getActiveModelForProvider(provider) {
  const p = (provider || "").toLowerCase();
  if (p === "groq") return settings.get("groq_model") || "llama-3.3-70b-versatile";
  if (p === "gemini") return settings.get("gemini_model") || "gemini-3.7-flash";
  if (p === "openai") return settings.get("openai_model") || "gpt-4o";
  if (p === "anthropic") return settings.get("anthropic_model") || "claude-3-7-sonnet";
  if (p === "flipia") return settings.get("flipia_model") || "Olmo-3.1-32B-Instruct";
  if (p === "pollinations") return settings.get("pollinations_model") || "openai";
  if (p === "auto") return `Auto (best configured, e.g. ${settings.get("groq_model") || settings.get("gemini_model") || "Olmo-3.1-32B-Instruct"})`;
  return settings.get("gemini_model") || "unknown";
}

function resolveModel(query) {
  const clean = (query || "").toLowerCase().trim();
  if (!clean) return null;

  for (const [provider, list] of Object.entries(aiFailover.INTERNET_MODELS)) {
    for (const item of list) {
      if (item.id.toLowerCase() === clean) {
        return { provider, modelId: item.id, modelName: item.name };
      }
    }
  }

  // Substring or prefix match
  for (const [provider, list] of Object.entries(aiFailover.INTERNET_MODELS)) {
    for (const item of list) {
      if (item.id.toLowerCase().includes(clean) || clean.includes(item.id.toLowerCase())) {
        return { provider, modelId: item.id, modelName: item.name };
      }
    }
  }

  return null;
}
