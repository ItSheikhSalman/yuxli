// file: src/commands/medicine.cjs
//
// MEDSTER: Pharmaceutical Drug & Clinical Reference Command
// Powered by AHM7 MEDSTER with Mandatory Medical Compliance Disclaimer

const { requestAhm7 } = require("../services/integrations/ahm7/client.cjs");
const { isServiceEnabled } = require("../services/integrations/ahm7/registry.cjs");
const { assertCanRunCommand } = require("../services/entitlements.cjs");
const config = require("../services/integrations/ahm7/config.cjs");
const logger = require("../utils/logger.cjs");

module.exports = {
  name: "medicine",
  aliases: ["med", "drug", "dawa", "pharma"],
  description: {
    en: "Searches pharmaceutical database for medication information, active ingredients, dosage forms, and clinical uses.",
    ur: "ادویات کے فارمولے، خوراک کی اقسام اور استعمالات کی بنیادی معلومات تلاش کریں.",
    ar: "البحث في قاعدة بيانات الأدوية للتعرف على التركيبات الدوائية ودواعي الاستعمال.",
  },
  usage: {
    en: "!medicine <drug or brand name>",
    ur: "!medicine <دوا کا نام>",
    ar: "!medicine <اسم الدواء>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const workspaceId = meta.workspaceId || "ws_default";

    try {
      assertCanRunCommand(workspaceId, "medicine");
    } catch (tierErr) {
      return await sock.sendMessage(chatId, { text: `🔒 ${tierErr.message}` }, { quoted: msg });
    }

    if (!isServiceEnabled("medicineSearch")) {
      return await sock.sendMessage(chatId, { text: "⚠️ MEDSTER medical database service is currently disabled by administrator." }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    if (!query) {
      return await sock.sendMessage(chatId, {
        text: "💊 *MEDSTER Pharmaceutical Reference*\n\n" +
              "Search clinical information, dosage forms, and indications.\n\n" +
              "Usage: `!medicine <drug name>`\n" +
              "Examples:\n" +
              "• `!medicine Panadol`\n" +
              "• `!medicine Paracetamol`\n" +
              "• `!medicine Amoxicillin`\n\n" +
              config.medicalDisclaimer,
      }, { quoted: msg });
    }

    try {
      const searchRes = await requestAhm7("medicineSearch", {
        params: { q: query },
        timeout: 20_000,
      });

      const list = Array.isArray(searchRes) ? searchRes : (searchRes.results || searchRes.data || []);
      if (list.length === 0) {
        return await sock.sendMessage(chatId, {
          text: `💊 No matching pharmaceutical products found for "${query}".\n\n${config.medicalDisclaimer}`,
        }, { quoted: msg });
      }

      const topItem = list[0];
      let details = topItem;

      // If an ID exists, fetch full clinical monograph details
      const itemId = topItem.id || topItem._id;
      if (itemId && isServiceEnabled("medicineDetails")) {
        try {
          const detailRes = await requestAhm7("medicineDetails", {
            params: { id: itemId },
            timeout: 15_000,
          });
          if (detailRes && typeof detailRes === "object") {
            details = { ...topItem, ...detailRes };
          }
        } catch (detailErr) {
          logger.debug({ err: detailErr.message }, "[MEDSTER] Could not fetch detailed monograph, using search result");
        }
      }

      const brand = details.brand || details.name || details.title || query;
      const generic = details.generic || details.formula || details.activeIngredient || "N/A";
      const form = details.form || details.dosageForm || details.type || "N/A";
      const strength = details.strength || details.dosage || "N/A";
      const manufacturer = details.manufacturer || details.company || "N/A";
      const indications = details.indications || details.uses || details.description || "Refer to prescribing information.";

      let reply = `💊 *Pharmaceutical Reference: ${brand}*\n\n` +
                  `🧪 *Generic Name / Formula:* ${generic}\n` +
                  `📦 *Dosage Form:* ${form}\n` +
                  `⚖️ *Strength:* ${strength}\n` +
                  `🏭 *Manufacturer:* ${manufacturer}\n\n` +
                  `📋 *Primary Indications:*\n${String(indications).slice(0, 400)}\n\n` +
                  config.medicalDisclaimer;

      await sock.sendMessage(chatId, { text: reply.trim() }, { quoted: msg });
    } catch (err) {
      logger.error({ err: err.message, query }, "[MEDSTER] Search failed");
      await sock.sendMessage(chatId, { text: `❌ MEDSTER search error: ${err.message}\n\n${config.medicalDisclaimer}` }, { quoted: msg });
    }
  },
};
