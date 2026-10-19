module.exports = function migrateIntelligenceLifecycle(database) {
  database.exec(`
    CREATE INDEX ai_reply_user_rate ON ai_reply_receipts(workspace_id, user_id, created_at);
    CREATE TRIGGER ai_workspace_cleanup AFTER DELETE ON workspaces BEGIN
      DELETE FROM ai_knowledge_chunks WHERE workspace_id=old.id;
      DELETE FROM ai_knowledge_index WHERE workspace_id=old.id;
      DELETE FROM ai_training_usage WHERE workspace_id=old.id;
      DELETE FROM ai_training_events WHERE workspace_id=old.id;
      DELETE FROM ai_conversation_state WHERE workspace_id=old.id;
      DELETE FROM ai_reply_receipts WHERE workspace_id=old.id;
      DELETE FROM ai_adaptive_metrics WHERE workspace_id=old.id;
    END;
  `);
};
