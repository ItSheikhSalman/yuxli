// Real-time Currency Converter & Forex Rates Command (!currency, !forex, !pkr, !rate)
// Uses open.er-api.com live exchange rates (free, zero API key needed)

const { sendBotMessage, sendBotError } = require("../utils/sendBotMessage.cjs");
const runtimeConfig = require("../config/runtime-config.cjs");
const logger = require("../utils/logger.cjs");

let ratesCache = { base: null, rates: null, timestamp: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

async function fetchRates(base = "USD") {
  const now = Date.now();
  if (ratesCache.base === base && ratesCache.rates && now - ratesCache.timestamp < CACHE_TTL_MS) {
    return ratesCache.rates;
  }

  const url = `https://open.er-api.com/v6/latest/${base.toUpperCase()}`;
  const res = await fetch(url, { headers: { "User-Agent": "YuxliBot/1.0" } });
  if (!res.ok) throw new Error(`Currency API error: HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.rates) throw new Error("Invalid currency API response");

  ratesCache = { base, rates: data.rates, timestamp: now };
  return data.rates;
}

const FLAGS = {
  USD: "🇺🇸",
  PKR: "🇵🇰",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  AED: "🇦🇪",
  SAR: "🇸🇦",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  INR: "🇮🇳",
  TRY: "🇹🇷",
  CNY: "🇨🇳",
  JPY: "🇯🇵",
  KWD: "🇰🇼",
  QAR: "🇶🇦",
  OMR: "🇴🇲",
};

module.exports = {
  name: "currency",
  aliases: ["forex", "pkr", "rate", "exchange", "کرنسی"],
  description: {
    en: "Convert currencies with live exchange rates (e.g. !currency 100 USD PKR).",
    ur: "Live exchange rates ke sath currency convert karein (misaal: !currency 100 USD PKR).",
    ar: "تحويل العملات بأسعار الصرف المباشرة.",
  },
  usage: {
    en: "currency\ncurrency <amount> <from> [to]\ncurrency rates",
    ur: "currency (PKR live rates)\ncurrency 100 USD PKR\ncurrency 50 AED",
    ar: "currency 100 USD SAR",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const rawChatId = msg.key.remoteJid;
    const prefix = runtimeConfig.getPrefix();
    const reply = (text) => sendBotMessage(sock, rawChatId, { text }, { replyTo: msg });

    try {
      const cleanArgs = args.filter((a) => a.toLowerCase() !== "to" && a.toLowerCase() !== "in");

      // 1. Overview Dashboard if no arguments or "rates"
      if (!cleanArgs.length || cleanArgs[0].toLowerCase() === "rates" || cleanArgs[0].toLowerCase() === "list") {
        const rates = await fetchRates("USD");
        const pkrPerUsd = rates.PKR || 278;

        const mainList = [
          { code: "USD", name: "US Dollar", flag: FLAGS.USD, val: (1 * pkrPerUsd).toFixed(2) },
          { code: "EUR", name: "Euro", flag: FLAGS.EUR, val: ((1 / rates.EUR) * pkrPerUsd).toFixed(2) },
          { code: "GBP", name: "British Pound", flag: FLAGS.GBP, val: ((1 / rates.GBP) * pkrPerUsd).toFixed(2) },
          { code: "AED", name: "UAE Dirham", flag: FLAGS.AED, val: ((1 / rates.AED) * pkrPerUsd).toFixed(2) },
          { code: "SAR", name: "Saudi Riyal", flag: FLAGS.SAR, val: ((1 / rates.SAR) * pkrPerUsd).toFixed(2) },
          { code: "CAD", name: "Canadian Dollar", flag: FLAGS.CAD, val: ((1 / rates.CAD) * pkrPerUsd).toFixed(2) },
          { code: "AUD", name: "Australian Dollar", flag: FLAGS.AUD, val: ((1 / rates.AUD) * pkrPerUsd).toFixed(2) },
          { code: "KWD", name: "Kuwaiti Dinar", flag: FLAGS.KWD, val: ((1 / rates.KWD) * pkrPerUsd).toFixed(2) },
        ];

        let out = `╭───「 💱 *LIVE CURRENCY RATES (PKR)* 」\n│\n`;
        for (const item of mainList) {
          out += `│  ${item.flag} *1 ${item.code}* = \`Rs ${item.val}\`\n`;
        }
        out += `│\n`;
        out += `├─ 💡 *Calculate Custom Amount:*\n`;
        out += `│  \`${prefix}currency 100 USD PKR\`\n`;
        out += `│  \`${prefix}currency 500 AED PKR\`\n`;
        out += `│  \`${prefix}currency 50 EUR USD\`\n`;
        out += `│\n╰───「 ⚡ Real-Time Forex Data 」`;

        return reply(out);
      }

      // 2. Parse conversion parameters: [amount] [from] [to]
      let amount = 1;
      let fromCurr = "USD";
      let toCurr = "PKR";

      const firstIsNum = !isNaN(parseFloat(cleanArgs[0]));
      if (firstIsNum) {
        amount = parseFloat(cleanArgs[0]);
        fromCurr = (cleanArgs[1] || "USD").toUpperCase();
        toCurr = (cleanArgs[2] || "PKR").toUpperCase();
      } else {
        fromCurr = cleanArgs[0].toUpperCase();
        toCurr = (cleanArgs[1] || "PKR").toUpperCase();
        if (cleanArgs[2] && !isNaN(parseFloat(cleanArgs[2]))) {
          amount = parseFloat(cleanArgs[2]);
        }
      }

      if (isNaN(amount) || amount <= 0) {
        return reply(`❌ Amount sahi format me likhein. Misaal: \`${prefix}currency 100 USD PKR\``);
      }

      const rates = await fetchRates(fromCurr);
      if (!rates || !rates[toCurr]) {
        return reply(`❌ Currency code *${fromCurr}* ya *${toCurr}* invalid hy. Standard 3-letter currency code use karein (USD, PKR, AED, SAR, EUR, etc.).`);
      }

      const converted = (amount * rates[toCurr]).toFixed(2);
      const singleRate = rates[toCurr].toFixed(4);
      const fromFlag = FLAGS[fromCurr] || "🏳️";
      const toFlag = FLAGS[toCurr] || "🏳️";

      const card = [
        `╭───「 💱 *CURRENCY CONVERSION* 」`,
        `│`,
        `│  📥 *Amount:* ${fromFlag} \`${amount.toLocaleString()} ${fromCurr}\``,
        `│  📤 *Converted:* ${toFlag} *${parseFloat(converted).toLocaleString()} ${toCurr}*`,
        `│`,
        `├─ 📊 *Rate Details:*`,
        `│  • 1 ${fromCurr} = \`${singleRate} ${toCurr}\``,
        `│  • 1 ${toCurr} = \`${(1 / rates[toCurr]).toFixed(4)} ${fromCurr}\``,
        `│`,
        `╰───「 ⚡ Live Global Rates 」`,
      ].join("\n");

      return reply(card);
    } catch (err) {
      logger.error({ err }, "[Currency] Conversion failed");
      return sendBotError(sock, rawChatId, err, "Currency rates fetch karne me masla hua");
    }
  },
};
