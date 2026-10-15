// Gemini conversation history.
//
// It lives in the same SQLite file as everything else, so these are ordinary
// synchronous queries. The functions stay `async` because every caller already
// awaits them (they date from when this was a separate database), and changing
// forty call sites to save a microtask buys nothing.

import store from "../db/store.esm.js";

export async function getChatHistoryAsync(chatId) {
  return store.getChatHistory(chatId);
}

export async function saveChatHistoryAsync(chatId, historyArray) {
  store.saveChatHistory(chatId, historyArray);
}

export async function deleteChatHistoryAsync(chatId) {
  return store.deleteChatHistory(chatId);
}

export async function recordOutgoingTurnAsync(chatId, text) {
  if (!chatId || !text || typeof text !== "string") return;
  const clean = text.trim();
  if (!clean) return;

  try {
    const history = (await getChatHistoryAsync(chatId)) || [];
    if (history.length === 0) {
      history.push(
        { role: "user", parts: [{ text: "[Conversation context]" }] },
        { role: "model", parts: [{ text: clean }] },
      );
    } else {
      const last = history[history.length - 1];
      if (last && last.role === "model") {
        last.parts.push({ text: `\n${clean}` });
      } else {
        history.push({ role: "model", parts: [{ text: clean }] });
      }
    }
    await saveChatHistoryAsync(chatId, history);
  } catch {}
}

