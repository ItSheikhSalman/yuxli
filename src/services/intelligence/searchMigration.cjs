module.exports = function migrateKnowledgeSearch(database) {
  database.exec(`
    CREATE VIRTUAL TABLE ai_knowledge_index USING fts5(
      workspace_id UNINDEXED, document_id UNINDEXED, ordinal UNINDEXED, content,
      tokenize='unicode61'
    );
    INSERT INTO ai_knowledge_index(workspace_id, document_id, ordinal, content)
      SELECT workspace_id, document_id, ordinal, content FROM ai_knowledge_chunks;
  `);
};
