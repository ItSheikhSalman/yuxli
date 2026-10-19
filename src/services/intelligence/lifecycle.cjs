const repository = require("./repository.cjs");

function resetAccount(workspaceId, connectionId) {
  repository.workspace(workspaceId);
  repository.transaction(() => {
    repository.q("DELETE FROM ai_chat_directory WHERE workspace_id=? AND connection_id=?").run(workspaceId, connectionId);
    repository
      .q(`UPDATE ai_training_resources SET
      body=json_set(body, '$.enabled', json('false'), '$.learning', json('false'),
        '$.adminConfirmed', json('false'), '$.noticeVersion', null),
      revision=revision+1, updated_at=? WHERE workspace_id=? AND kind='group'`)
      .run(Date.now(), workspaceId);
    for (const table of [
      "ai_style_buckets",
      "ai_conversation_state",
      "ai_participant_consent",
      "ai_adaptive_metrics",
    ])
      repository.q(`DELETE FROM ${table} WHERE workspace_id=?`).run(workspaceId);
    repository
      .q("DELETE FROM ai_approved_memories WHERE workspace_id=? AND scope!='workspace'")
      .run(workspaceId);
    repository.audit(workspaceId, connectionId, "account-learning-reset", connectionId);
  });
}

module.exports = { resetAccount };
