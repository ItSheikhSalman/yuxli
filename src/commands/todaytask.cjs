// Command: !todaytask (Student Today's Tasks & Study Session Tracker)

const logger = require("../utils/logger.cjs");
const normalizeJid = require("../utils/normalizeJid.esm.js").default;
const {
  getTodayString,
  getTodayTasks,
  addTodayTask,
  setTaskDone,
  removeTask,
  clearCompletedTasks,
  logStudySession,
  getTodaySessions,
} = require("../services/studentService.cjs");

module.exports = {
  name: "todaytask",
  aliases: ["today", "aaj", "tasks", "task"],
  description: {
    en: "Manages today's study tasks, sessions, and daily student goals.",
    ar: "إدارة مهام وجلسات الدراسة اليومية للطلاب.",
  },
  usage: {
    en: "!todaytask\n!todaytask add <task>\n!todaytask done <number>\n!todaytask session <topic> [duration]\n!todaytask del <number>\n!todaytask clear",
    ar: "!todaytask add <المهمة>\n!todaytask done <رقم>\n!todaytask session <الموضوع>",
  },
  chat: "all",

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const senderId = normalizeJid(msg.key.participant || msg.key.remoteJid);
    const userTag = `@${senderId.split("@")[0]}`;
    const subCommand = args[0] ? args[0].toLowerCase() : "list";

    try {
      switch (subCommand) {
        case "add": {
          const taskText = args.slice(1).join(" ");
          if (!taskText) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Task likhein jo add karni hai:\n`!todaytask add Physics Chapter 1 revision`",
            });
          }
          addTodayTask(senderId, taskText);
          return await sock.sendMessage(chatId, {
            text: `✅ ${userTag}, aaj ki task add ho gayi:\n📌 *${taskText}*`,
            mentions: [senderId],
          });
        }

        case "done":
        case "complete": {
          const num = parseInt(args[1], 10);
          const tasks = getTodayTasks(senderId);
          if (isNaN(num) || num <= 0 || num > tasks.length) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Sahi task number likhein. Example: `!todaytask done 1`",
            });
          }
          const finished = setTaskDone(senderId, num - 1, true);
          return await sock.sendMessage(chatId, {
            text: `🎉 Shabash ${userTag}! Task complete ho gayi:\n✅ *${finished.text}*`,
            mentions: [senderId],
          });
        }

        case "del":
        case "remove": {
          const num = parseInt(args[1], 10);
          const tasks = getTodayTasks(senderId);
          if (isNaN(num) || num <= 0 || num > tasks.length) {
            return await sock.sendMessage(chatId, {
              text: "⚠️ Sahi task number likhein. Example: `!todaytask del 1`",
            });
          }
          const removed = removeTask(senderId, num - 1);
          return await sock.sendMessage(chatId, {
            text: `🗑️ ${userTag}, task delete kar di gayi:\n*${removed.text}*`,
            mentions: [senderId],
          });
        }

        case "clear": {
          clearCompletedTasks(senderId);
          return await sock.sendMessage(chatId, {
            text: `🧹 ${userTag}, saari completed tasks list sy clear kar di gayin.`,
            mentions: [senderId],
          });
        }

        case "session":
        case "study": {
          const sessionInput = args.slice(1).join(" ");
          if (!sessionInput) {
            return await sock.sendMessage(chatId, {
              text:
                "⏱️ *Study Session Logger*\n\n" +
                "Session record karne ke liye topic likhein:\n" +
                "👉 `!todaytask session Math Integration 45 mins`\n" +
                "👉 `!todaytask session English Essay Writing 1 hour`",
            });
          }

          // Parse duration if given at end (e.g. 45 mins, 1 hr)
          let topic = sessionInput;
          let duration = "45 mins";
          const match = sessionInput.match(/^(.*?)\s+(\d+\s*(?:mins|min|minutes|hr|hrs|hours))$/i);
          if (match) {
            topic = match[1];
            duration = match[2];
          }

          logStudySession(senderId, topic, duration);

          return await sock.sendMessage(chatId, {
            text:
              `🔥 *Study Session Recorded!*\n\n` +
              `👤 *Student:* ${userTag}\n` +
              `📚 *Topic:* *${topic}*\n` +
              `⏱️ *Duration:* ${duration}\n` +
              `📅 *Date:* ${getTodayString()}\n\n` +
              `Great job! Consistency is the key to success. 💪`,
            mentions: [senderId],
          });
        }

        case "list":
        default: {
          const today = getTodayString();
          const tasks = getTodayTasks(senderId);
          const sessions = getTodaySessions(senderId);

          let output = `📅 *TODAY'S STUDY PLAN & TASKS*\n`;
          output += `👤 ${userTag}  •  🗓️ *${today}*\n`;
          output += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

          // Tasks section
          output += `📋 *Today's Tasks:*\n`;
          if (tasks.length === 0) {
            output += `_Koi task set nahi hai. Add karne ke liye: ` + `\`!todaytask add <task>\`_\n`;
          } else {
            tasks.forEach((t, i) => {
              const statusIcon = t.done ? "✅" : "⏳";
              output += `${i + 1}. ${statusIcon} ${t.text}\n`;
            });
          }

          // Sessions section
          output += `\n⏱️ *Today's Study Sessions:*\n`;
          if (sessions.length === 0) {
            output += `_Aaj koi session log nahi hua. Naya session: ` + `\`!todaytask session <topic>\`_\n`;
          } else {
            sessions.forEach((s, i) => {
              output += `• 📖 *${s.topic}* (${s.duration}) at ${s.timestamp}\n`;
            });
          }

          output += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
          output += `💡 *Commands:*\n`;
          output += `• \`!todaytask add <task>\` — Add task\n`;
          output += `• \`!todaytask done <num>\` — Mark complete\n`;
          output += `• \`!todaytask session <topic> [time]\` — Log study\n`;
          output += `• \`!tomorrow\` — Kal ka timetable, quiz aur lectures dekhna`;

          return await sock.sendMessage(chatId, {
            text: output,
            mentions: [senderId],
          });
        }
      }
    } catch (err) {
      logger.error({ err, command: "todaytask" }, "Error in todaytask command");
      await sock.sendMessage(chatId, {
        text: `❌ Error in todaytask: ${err.message}`,
      });
    }
  },
};
