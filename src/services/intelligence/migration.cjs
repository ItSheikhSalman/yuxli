module.exports = function migrateIntelligence(database) {
  database.exec(`
    CREATE TABLE ai_training_resources (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      body TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, kind, id)
    );
    CREATE TABLE ai_knowledge_chunks (
      workspace_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (workspace_id, document_id, ordinal)
    );
    CREATE TABLE ai_approved_memories (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('user', 'group', 'workspace')),
      subject_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      content TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('proposed', 'approved')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, id),
      UNIQUE (workspace_id, scope, subject_id, fingerprint)
    );
    CREATE INDEX ai_memory_scope ON ai_approved_memories(workspace_id, scope, subject_id, expires_at);
    CREATE TABLE ai_participant_consent (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, chat_id, user_id)
    );
    CREATE TABLE ai_training_usage (
      workspace_id TEXT NOT NULL,
      period TEXT NOT NULL,
      metric TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(workspace_id, period, metric)
    );
    CREATE TABLE ai_training_events (
      workspace_id TEXT NOT NULL,
      id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, id)
    );
    CREATE TABLE ai_conversation_state (
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      body TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, session_id)
    );
    CREATE TABLE ai_reply_receipts (
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, chat_id, message_id)
    );
    CREATE INDEX ai_reply_rate ON ai_reply_receipts(workspace_id, chat_id, created_at);
    CREATE TABLE ai_training_plan_limits (
      plan_id TEXT PRIMARY KEY,
      body TEXT NOT NULL
    );
  `);
};
