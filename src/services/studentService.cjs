// Student Productivity & Schedule Service
// Handles: today's tasks, study sessions, tomorrow's schedule, weekly timetable, quizzes & exams.
// Persistent storage via SQLite bot_settings.

const { getBotSetting, saveBotSetting } = require("../utils/storage.cjs");

function formatDate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatDate(new Date());
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getDayName(dateObj = new Date()) {
  return WEEKDAYS[dateObj.getDay()];
}

function getTomorrowDayName() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return WEEKDAYS[d.getDay()];
}

function normalizeDay(dayInput) {
  if (!dayInput) return "";
  const d = dayInput.toLowerCase().trim();
  if (d.startsWith("mon") || d.includes("peer") || d.includes("somwar")) return "monday";
  if (d.startsWith("tue") || d.includes("mangal")) return "tuesday";
  if (d.startsWith("wed") || d.includes("budh")) return "wednesday";
  if (d.startsWith("thu") || d.includes("jumerat") || d.includes("guruwar")) return "thursday";
  if (d.startsWith("fri") || d.includes("jummah") || d.includes("shukrawar")) return "friday";
  if (d.startsWith("sat") || d.includes("hafta") || d.includes("shanivar")) return "saturday";
  if (d.startsWith("sun") || d.includes("itwar") || d.includes("ravivar")) return "sunday";
  return d;
}

function getStorageKey(userId) {
  return `student_suite:${userId}`;
}

function getStudentData(userId) {
  const key = getStorageKey(userId);
  const data = getBotSetting(key, null);
  if (data && typeof data === "object") {
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      timetable: data.timetable && typeof data.timetable === "object" ? data.timetable : {},
      quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
    };
  }
  return {
    tasks: [],
    sessions: [],
    timetable: {},
    quizzes: [],
  };
}

function saveStudentData(userId, data) {
  const key = getStorageKey(userId);
  saveBotSetting(key, data);
}

// -------------------------------------------------------------
// Tasks & Sessions
// -------------------------------------------------------------

function addTodayTask(userId, text, targetDate = getTodayString()) {
  const data = getStudentData(userId);
  const newTask = {
    id: Date.now().toString(),
    text: text.trim(),
    done: false,
    date: targetDate,
    createdAt: new Date().toISOString(),
  };
  data.tasks.push(newTask);
  saveStudentData(userId, data);
  return newTask;
}

function getTodayTasks(userId, dateStr = getTodayString()) {
  const data = getStudentData(userId);
  return data.tasks.filter((t) => t.date === dateStr || !t.date);
}

function setTaskDone(userId, taskIndex, isDone = true) {
  const data = getStudentData(userId);
  const todayTasks = data.tasks;
  if (taskIndex < 0 || taskIndex >= todayTasks.length) return null;
  todayTasks[taskIndex].done = isDone;
  saveStudentData(userId, data);
  return todayTasks[taskIndex];
}

function removeTask(userId, taskIndex) {
  const data = getStudentData(userId);
  if (taskIndex < 0 || taskIndex >= data.tasks.length) return null;
  const removed = data.tasks.splice(taskIndex, 1);
  saveStudentData(userId, data);
  return removed[0];
}

function clearCompletedTasks(userId) {
  const data = getStudentData(userId);
  data.tasks = data.tasks.filter((t) => !t.done);
  saveStudentData(userId, data);
}

function logStudySession(userId, topic, duration = "45 mins") {
  const data = getStudentData(userId);
  const session = {
    id: Date.now().toString(),
    topic: topic.trim(),
    duration,
    date: getTodayString(),
    timestamp: new Date().toLocaleTimeString(),
  };
  data.sessions.push(session);
  saveStudentData(userId, data);
  return session;
}

function getTodaySessions(userId, dateStr = getTodayString()) {
  const data = getStudentData(userId);
  return data.sessions.filter((s) => s.date === dateStr);
}

// -------------------------------------------------------------
// Timetable
// -------------------------------------------------------------

function addTimetableEntry(userId, rawDay, time, subject) {
  const day = normalizeDay(rawDay);
  if (!WEEKDAYS.includes(day)) return null;

  const data = getStudentData(userId);
  if (!data.timetable[day]) {
    data.timetable[day] = [];
  }
  const entry = {
    time: time.trim(),
    subject: subject.trim(),
  };
  data.timetable[day].push(entry);
  // Sort by time roughly
  data.timetable[day].sort((a, b) => a.time.localeCompare(b.time));
  saveStudentData(userId, data);
  return { day, entry };
}

function removeTimetableEntry(userId, rawDay, index) {
  const day = normalizeDay(rawDay);
  const data = getStudentData(userId);
  if (!data.timetable[day] || index < 0 || index >= data.timetable[day].length) {
    return null;
  }
  const removed = data.timetable[day].splice(index, 1);
  saveStudentData(userId, data);
  return removed[0];
}

function getTimetable(userId, rawDay = null) {
  const data = getStudentData(userId);
  if (rawDay) {
    const day = normalizeDay(rawDay);
    return data.timetable[day] || [];
  }
  return data.timetable;
}

// -------------------------------------------------------------
// Quizzes, Exams & Lectures
// -------------------------------------------------------------

function addQuiz(userId, dateInput, subject, details = "") {
  const data = getStudentData(userId);
  let formattedDate = dateInput.trim();
  if (formattedDate.toLowerCase() === "today" || formattedDate.toLowerCase() === "aaj") {
    formattedDate = getTodayString();
  } else if (formattedDate.toLowerCase() === "tomorrow" || formattedDate.toLowerCase() === "kal") {
    formattedDate = getTomorrowString();
  }

  const quiz = {
    id: Date.now().toString(),
    date: formattedDate,
    subject: subject.trim(),
    details: details.trim(),
    createdAt: new Date().toISOString(),
  };
  data.quizzes.push(quiz);
  // Sort by date
  data.quizzes.sort((a, b) => a.date.localeCompare(b.date));
  saveStudentData(userId, data);
  return quiz;
}

function removeQuiz(userId, index) {
  const data = getStudentData(userId);
  if (index < 0 || index >= data.quizzes.length) return null;
  const removed = data.quizzes.splice(index, 1);
  saveStudentData(userId, data);
  return removed[0];
}

function getUpcomingQuizzes(userId) {
  const data = getStudentData(userId);
  const today = getTodayString();
  return data.quizzes.filter((q) => q.date >= today);
}

// -------------------------------------------------------------
// Tomorrow's Comprehensive Briefing
// -------------------------------------------------------------

function getTomorrowSchedule(userId) {
  const tomorrowDate = getTomorrowString();
  const tomorrowDay = getTomorrowDayName();
  const data = getStudentData(userId);

  // 1. Classes / Timetable for tomorrow's weekday
  const classes = data.timetable[tomorrowDay] || [];

  // 2. Quizzes scheduled for tomorrow
  const quizzes = data.quizzes.filter((q) => q.date === tomorrowDate);

  // 3. Tasks planned for tomorrow
  const tasks = data.tasks.filter((t) => t.date === tomorrowDate && !t.done);

  return {
    date: tomorrowDate,
    dayName: tomorrowDay.charAt(0).toUpperCase() + tomorrowDay.slice(1),
    classes,
    quizzes,
    tasks,
  };
}

module.exports = {
  formatDate,
  getTodayString,
  getTomorrowString,
  getDayName,
  getTomorrowDayName,
  normalizeDay,
  WEEKDAYS,
  getStudentData,
  // Tasks
  addTodayTask,
  getTodayTasks,
  setTaskDone,
  removeTask,
  clearCompletedTasks,
  // Sessions
  logStudySession,
  getTodaySessions,
  // Timetable
  addTimetableEntry,
  removeTimetableEntry,
  getTimetable,
  // Quizzes
  addQuiz,
  removeQuiz,
  getUpcomingQuizzes,
  // Tomorrow
  getTomorrowSchedule,
};
