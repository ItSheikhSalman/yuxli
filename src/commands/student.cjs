// Command: !student (Aliases: !timetable, !quiz)
// Complete Student Timetable, Quiz Schedule & Date Tracking System

const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const {
  WEEKDAYS,
  normalizeDay,
  addTimetableEntry,
  removeTimetableEntry,
  getTimetable,
  addQuiz,
  removeQuiz,
  getUpcomingQuizzes,
  getTodayString,
} = require("../services/studentService.cjs");

module.exports = {
  name: "student",
  aliases: ["timetable", "quiz", "schedule", "classes"],
  description: {
    en: "Manage weekly class timetable, quizzes, and exam dates.",
    ar: "إدارة الجدول الأسبوعي، الكويزات، ومواعيد الامتحانات.",
  },
  usage: {
    en: "!timetable add <day> <time> <subject>\n!timetable list [day]\n!timetable del <day> <num>\n!quiz add <date> <subject>\n!quiz list\n!quiz del <num>",
    ar: "!timetable add <اليوم> <الوقت> <المادة>",
  },
  chat: "all",

  async execute(sock, msg, args, body, groupMetadata, meta = {}) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
    const userTag = `@${senderId.split("@")[0]}`;

    const invokedAs = (meta.invokedName || "student").toLowerCase();

    // Route based on alias or first argument
    let mode = "menu";
    if (invokedAs === "timetable" || invokedAs === "classes") {
      mode = "timetable";
    } else if (invokedAs === "quiz") {
      mode = "quiz";
    } else {
      const firstArg = args[0] ? args[0].toLowerCase() : "";
      if (firstArg === "timetable" || firstArg === "tt") {
        mode = "timetable";
        args = args.slice(1);
      } else if (firstArg === "quiz" || firstArg === "quizzes") {
        mode = "quiz";
        args = args.slice(1);
      }
    }

    try {
      // -------------------------------------------------------------
      // Mode: QUIZ MANAGEMENT
      // -------------------------------------------------------------
      if (mode === "quiz") {
        const sub = args[0] ? args[0].toLowerCase() : "list";

        if (sub === "add") {
          const dateInput = args[1];
          const subject = args.slice(2).join(" ");
          if (!dateInput || !subject) {
            return await sock.sendMessage(chatId, {
              text:
                "⚠️ *Format:* `!quiz add <date> <subject> [topic]`\n\n" +
                "Examples:\n" +
                "• `!quiz add 2026-10-20 DBMS Midterm Exam`\n" +
                "• `!quiz add tomorrow Math Integration Quiz`\n" +
                "• `!quiz add today Physics Lab Test`",
            });
          }

          const q = addQuiz(senderId, dateInput, subject);
          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, quiz schedule kar diya gaya:\n📅 *Date:* ${q.date}\n📝 *Subject:* ${q.subject}`,
            mentions: [senderId],
          });
        }

        if (sub === "del" || sub === "remove") {
          const idx = parseInt(args[1], 10);
          const quizzes = getUpcomingQuizzes(senderId);
          if (isNaN(idx) || idx <= 0 || idx > quizzes.length) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Sahi quiz number likhein: `!quiz del 1`",
            });
          }
          const removed = removeQuiz(senderId, idx - 1);
          return await sock.sendMessage(chatId, {
            text: `🗑️ ${userTag}, quiz delete kar diya gaya: *${removed.subject}*`,
            mentions: [senderId],
          });
        }

        // List Quizzes
        const quizzes = getUpcomingQuizzes(senderId);
        let out = `📝 *UPCOMING QUIZZES & EXAM SCHEDULE*\n`;
        out += `👤 ${userTag}  •  Today: ${getTodayString()}\n`;
        out += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (quizzes.length === 0) {
          out += `_Koi upcoming quiz ya test nahi hai._\n\n`;
          out += `Add karne ke liye: \`!quiz add <date> <subject>\``;
        } else {
          quizzes.forEach((q, i) => {
            out += `${i + 1}. 📅 *${q.date}* — 🚨 *${q.subject}* ${q.details ? `(${q.details})` : ""}\n`;
          });
          out += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
          out += `💡 Delete karne ke liye: \`!quiz del <number>\``;
        }

        return await sock.sendMessage(chatId, {
          text: out,
          mentions: [senderId],
        });
      }

      // -------------------------------------------------------------
      // Mode: TIMETABLE MANAGEMENT
      // -------------------------------------------------------------
      if (mode === "timetable") {
        const sub = args[0] ? args[0].toLowerCase() : "list";

        if (sub === "add") {
          const day = args[1];
          const time = args[2];
          const subject = args.slice(3).join(" ");

          if (!day || !time || !subject) {
            return await sock.sendMessage(chatId, {
              text:
                "⚠️ *Format:* `!timetable add <day> <time> <subject>`\n\n" +
                "Examples:\n" +
                "• `!timetable add Monday 09:00AM Object Oriented Programming`\n" +
                "• `!timetable add Tuesday 11:30AM Computer Networks Hall 3`\n" +
                "• `!timetable add Friday 02:00PM Data Science Lab`",
            });
          }

          const res = addTimetableEntry(senderId, day, time, subject);
          if (!res) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Sahi din (day) likhein: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.",
            });
          }

          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, lecture timetable me add ho gaya:\n📅 *${res.day.toUpperCase()}* | ⏰ *${time}* | 🎓 *${subject}*`,
            mentions: [senderId],
          });
        }

        if (sub === "del" || sub === "remove") {
          const day = args[1];
          const idx = parseInt(args[2], 10);
          if (!day || isNaN(idx) || idx <= 0) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Format: `!timetable del <day> <number>`\nExample: `!timetable del Monday 1`",
            });
          }
          const removed = removeTimetableEntry(senderId, day, idx - 1);
          if (!removed) {
            return await sock.sendMessage(chatId, {
              text: "❌ Lecture nahi mila. Day aur number check karein.",
            });
          }
          return await sock.sendMessage(chatId, {
            text: `🗑️ ${userTag}, deleted from ${day}: *${removed.subject}*`,
            mentions: [senderId],
          });
        }

        // List Timetable
        const filterDay = args[0] && args[0] !== "list" ? normalizeDay(args[0]) : null;
        const tt = getTimetable(senderId);

        let out = `🎓 *STUDENT WEEKLY TIMETABLE*\n`;
        out += `👤 ${userTag}\n`;
        out += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        const daysToShow = filterDay ? [filterDay] : WEEKDAYS;
        let hasAny = false;

        for (const day of daysToShow) {
          const classes = tt[day] || [];
          if (classes.length > 0) {
            hasAny = true;
            out += `📌 *${day.toUpperCase()}:*\n`;
            classes.forEach((c, i) => {
              out += `  ${i + 1}. ⏰ *${c.time}* — ${c.subject}\n`;
            });
            out += `\n`;
          }
        }

        if (!hasAny) {
          out += `_Aapka timetable abhi khali hai._\n\n`;
          out += `Lecture add karne ke liye:\n\`!timetable add Monday 10:00AM Math\`\n\n`;
        }

        out += `━━━━━━━━━━━━━━━━━━━━━\n`;
        out += `💡 *Commands:*\n`;
        out += `• \`!timetable add <day> <time> <subject>\`\n`;
        out += `• \`!timetable del <day> <number>\`\n`;
        out += `• \`!tomorrow\` — Kal ki classes aur quizzes dekhna`;

        return await sock.sendMessage(chatId, {
          text: out,
          mentions: [senderId],
        });
      }

      // Default Student Menu
      const helpText =
        `🎓 *STUDENT PRODUCTIVITY SUITE*\n\n` +
        `Yuxli Bot Student Features:\n\n` +
        `📚 *1. Documents & PDFs:*\n` +
        `• \`!doc explain\` — PDF/Text file samjhao aur tafseel nikalo\n` +
        `• \`!doc short\` — Mukhtasar summary & key points\n` +
        `• \`!doc topics\` — Main topics aur definitions\n` +
        `• \`!doc topdf\` — Notes ka clean PDF bana kar download bhejo\n` +
        `• \`!makepdf <text>\` — Kisi bhi text ka PDF banao\n\n` +
        `📋 *2. Daily Tasks & Sessions:*\n` +
        `• \`!todaytask\` — Aaj ki tasks aur study sessions ki list\n` +
        `• \`!todaytask add <task>\` — Aaj ki task add karo\n` +
        `• \`!todaytask session <topic> [time]\` — Study session record karo\n\n` +
        `🌅 *3. Tomorrow Planning:*\n` +
        `• \`!tomorrow\` — Kal ka timetable, lectures, quizzes aur tasks check karo\n\n` +
        `🗓️ *4. Timetable & Quizzes:*\n` +
        `• \`!timetable\` — Poora weekly lecture timetable dekho\n` +
        `• \`!timetable add <day> <time> <subject>\` — Class add karo\n` +
        `• \`!quiz\` — Upcoming quiz aur exam dates ki list\n` +
        `• \`!quiz add <date> <subject>\` — Naya quiz schedule karo`;

      return await sock.sendMessage(chatId, { text: helpText });
    } catch (err) {
      logger.error({ err, command: "student" }, "Error in student command");
      await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` });
    }
  },
};
