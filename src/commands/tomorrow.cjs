// Command: !tomorrow (Tomorrow's Schedule, Quizzes, Lectures & Timetable)

const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const {
  getTomorrowString,
  getTomorrowDayName,
  getTomorrowSchedule,
  addQuiz,
  addTodayTask,
  addTimetableEntry,
} = require("../services/studentService.cjs");

module.exports = {
  name: "tomorrow",
  aliases: ["kal", "tom", "tommorrow"],
  description: {
    en: "Checks tomorrow's schedule: lectures, timetable, upcoming quizzes, and tasks.",
    ar: "جدول الغد: المحاضرات، الكويزات، والمهام المقررة.",
  },
  usage: {
    en: "!tomorrow\n!tomorrow add quiz <subject> [details]\n!tomorrow add lecture <time> <subject>\n!tomorrow add task <task>",
    ar: "!tomorrow",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
    const userTag = `@${senderId.split("@")[0]}`;
    const subCommand = args[0] ? args[0].toLowerCase() : "view";

    try {
      if (subCommand === "add") {
        const itemType = args[1] ? args[1].toLowerCase() : "";

        if (itemType === "quiz" || itemType === "test" || itemType === "exam") {
          const subject = args.slice(2).join(" ");
          if (!subject) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Subject likhein: `!tomorrow add quiz Computer Science Chapter 4`",
            });
          }
          addQuiz(senderId, "tomorrow", subject);
          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, kal ke liye quiz schedule ho gaya:\n📝 *${subject}* (Date: ${getTomorrowString()})`,
            mentions: [senderId],
          });
        }

        if (itemType === "lecture" || itemType === "class") {
          const time = args[2] || "TBD";
          const subject = args.slice(3).join(" ") || args.slice(2).join(" ");
          if (!subject) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Subject aur time likhein: `!tomorrow add lecture 10:00AM Physics`",
            });
          }
          const tomorrowDay = getTomorrowDayName();
          addTimetableEntry(senderId, tomorrowDay, time, subject);
          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, kal (${tomorrowDay}) ke timetable me lecture add ho gaya:\n🎓 *${time}* - *${subject}*`,
            mentions: [senderId],
          });
        }

        if (itemType === "task") {
          const taskText = args.slice(2).join(" ");
          if (!taskText) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Task likhein: `!tomorrow add task Prepare Assignment 2`",
            });
          }
          addTodayTask(senderId, taskText, getTomorrowString());
          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, kal ke liye task add ho gaya:\n📌 *${taskText}*`,
            mentions: [senderId],
          });
        }
      }

      // Default view tomorrow's schedule
      const schedule = getTomorrowSchedule(senderId);

      let output = `🌅 *TOMORROW'S STUDENT SCHEDULE*\n`;
      output += `👤 ${userTag}\n`;
      output += `📅 *${schedule.dayName}, ${schedule.date}*\n`;
      output += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // 1. Quizzes
      output += `📝 *Quizzes & Exams (Kal):*\n`;
      if (schedule.quizzes.length === 0) {
        output += `_Koi quiz ya test schedule nahi hai. 👍_\n`;
      } else {
        schedule.quizzes.forEach((q, i) => {
          output += `🚨 *${i + 1}. ${q.subject}* ${q.details ? `(${q.details})` : ""}\n`;
        });
      }

      // 2. Classes / Timetable
      output += `\n🎓 *Classes & Lectures (Timetable):*\n`;
      if (schedule.classes.length === 0) {
        output += `_Kal ka koi regular lecture add nahi hai._\n`;
      } else {
        schedule.classes.forEach((c, i) => {
          output += `• ⏰ *${c.time}* — *${c.subject}*\n`;
        });
      }

      // 3. Tasks for tomorrow
      output += `\n📋 *Planned Tasks for Tomorrow:*\n`;
      if (schedule.tasks.length === 0) {
        output += `_Koi pending task nahi hai._\n`;
      } else {
        schedule.tasks.forEach((t, i) => {
          output += `${i + 1}. ⏳ ${t.text}\n`;
        });
      }

      output += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      output += `💡 *Quick Add Commands:*\n`;
      output += `• \`!tomorrow add quiz <subject>\`\n`;
      output += `• \`!tomorrow add lecture <time> <subject>\`\n`;
      output += `• \`!tomorrow add task <task>\`\n`;
      output += `• \`!timetable\` — Full weekly timetable`;

      return await sock.sendMessage(chatId, {
        text: output,
        mentions: [senderId],
      });
    } catch (err) {
      logger.error({ err, command: "tomorrow" }, "Error in tomorrow command");
      await sock.sendMessage(chatId, {
        text: `❌ Error fetching tomorrow's schedule: ${err.message}`,
      });
    }
  },
};
