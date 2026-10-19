const repository = require("./repository.cjs");
const privacy = require("./privacy.cjs");
const { analyze } = require("./signals.cjs");

function empty() {
  return {
    messages: 0,
    words: 0,
    chars: 0,
    emoji: 0,
    punctuation: 0,
    abbreviations: 0,
    replies: 0,
    questions: 0,
    reactions: 0,
    languages: {},
    topics: {},
    tones: {},
  };
}

function observe({
  workspaceId,
  chatId,
  userId,
  text = "",
  replyTo = null,
  reaction = false,
  now = Date.now(),
}) {
  if (!privacy.mayLearn(workspaceId, chatId, userId)) return false;
  const signals = analyze(text);
  if (!reaction && (!text.trim() || signals.sensitive || signals.secret || text.length > 16000))
    return false;
  const settings = privacy.group(workspaceId, chatId);
  const period = new Date(now).toISOString().slice(0, 10);
  const row = repository
    .q("SELECT body FROM ai_style_buckets WHERE workspace_id=? AND chat_id=? AND bucket=?")
    .get(workspaceId, chatId, period);
  const stats = { ...empty(), ...repository.parseJson(row?.body, {}) };
  if (stats.messages + stats.reactions >= 5000) return false;
  if (reaction) stats.reactions += 1;
  else {
    stats.messages += 1;
    stats.words += Math.min(signals.words, 500);
    stats.chars += Math.min(signals.chars, 3000);
    stats.emoji += Math.min(signals.emojiCount, 10);
    stats.punctuation += Math.min(signals.punctuation, 30);
    stats.abbreviations += Math.min(signals.abbreviations, 30);
    stats.replies += replyTo ? 1 : 0;
    stats.questions += signals.question ? 1 : 0;
    stats.languages[signals.language] = (stats.languages[signals.language] || 0) + 1;
    stats.topics[signals.intent] = (stats.topics[signals.intent] || 0) + 1;
    stats.tones[signals.tone] = (stats.tones[signals.tone] || 0) + 1;
  }
  repository
    .q(
      "INSERT INTO ai_style_buckets VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, chat_id, bucket) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at",
    )
    .run(
      workspaceId,
      chatId,
      period,
      JSON.stringify(stats),
      now,
      now +
        Math.min(settings.retentionDays, repository.limits(workspaceId).retentionDays) * 86400000,
    );
  return true;
}

function profile(workspaceId, chatId, now = Date.now()) {
  repository.workspace(workspaceId);
  repository
    .q("DELETE FROM ai_style_buckets WHERE workspace_id=? AND expires_at<=?")
    .run(workspaceId, now);
  const rows = repository
    .q(
      "SELECT body, updated_at FROM ai_style_buckets WHERE workspace_id=? AND chat_id=? AND expires_at>? ORDER BY bucket",
    )
    .all(workspaceId, chatId, now);
  const total = empty();
  for (const row of rows) {
    const stats = repository.parseJson(row.body, empty());
    for (const key of Object.keys(total)) {
      if (typeof total[key] === "number") total[key] += stats[key] || 0;
      else
        for (const [label, value] of Object.entries(stats[key] || {}))
          total[key][label] = (total[key][label] || 0) + value;
    }
  }
  const enough = total.messages >= 20;
  const dominant =
    Object.entries(total.languages).sort((first, second) => second[1] - first[1])[0]?.[0] || null;
  return {
    ...total,
    enoughData: enough,
    language: enough ? dominant : null,
    averageWords: total.messages ? Math.round((total.words / total.messages) * 10) / 10 : null,
    preferReactions: enough && total.reactions > total.messages * 0.3,
    updatedAt: rows.length ? Math.max(...rows.map((row) => row.updated_at)) : null,
  };
}

module.exports = { observe, profile };
