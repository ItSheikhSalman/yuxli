module.exports = function migrateAdaptive(database) {
  database.exec(`
    ALTER TABLE ai_reply_receipts ADD COLUMN action TEXT NOT NULL DEFAULT 'observed';
    CREATE TABLE ai_style_buckets (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, chat_id, bucket)
    );
    CREATE TABLE ai_adaptive_metrics (
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      day TEXT NOT NULL,
      action TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, chat_id, day, action)
    );
  `);
};
