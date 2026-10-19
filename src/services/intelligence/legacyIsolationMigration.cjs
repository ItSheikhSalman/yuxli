module.exports = (database) => {
  for (const table of ["group_settings", "group_directory", "warnings", "todos", "notes", "lid_mapping", "user_metadata", "forward_scores"]) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all().filter((column) => column.name !== "workspace_id");
    const primary = columns.filter((column) => column.pk).sort((left, right) => left.pk - right.pk).map((column) => column.name);
    const definitions = columns.map((column) => `${column.name} ${column.type}${column.notnull ? " NOT NULL" : ""}${column.dflt_value == null ? "" : ` DEFAULT ${column.dflt_value}`}`);
    const existingScope = database.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === "workspace_id");
    const names = columns.map((column) => column.name).join(",");
    database.exec(`
      CREATE TABLE ${table}_scoped (workspace_id TEXT NOT NULL DEFAULT 'ws_default', ${definitions.join(",")}, PRIMARY KEY(workspace_id,${primary.join(",")}));
      INSERT INTO ${table}_scoped(workspace_id,${names}) SELECT ${existingScope ? "COALESCE(workspace_id,'ws_default')" : "'ws_default'"},${names} FROM ${table};
      DROP TABLE ${table};
      ALTER TABLE ${table}_scoped RENAME TO ${table};
    `);
  }
  database.exec(`
    CREATE INDEX idx_lid_mapping_pn ON lid_mapping(workspace_id,pn);
    CREATE INDEX idx_users_lid ON user_metadata(workspace_id,user_lid);
    CREATE INDEX idx_users_phone ON user_metadata(workspace_id,phone_number);
    CREATE INDEX idx_users_owner ON user_metadata(workspace_id,is_owner);
    CREATE INDEX idx_users_admin ON user_metadata(workspace_id,is_admin);
    CREATE INDEX idx_forward_group ON forward_scores(workspace_id,group_id);
    CREATE INDEX idx_forward_expires ON forward_scores(expires_at);
  `);
  database.exec(`
    CREATE TABLE ai_history_scoped (
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id, chat_id)
    );
    INSERT INTO ai_history_scoped(workspace_id,chat_id,history,updated_at)
      SELECT COALESCE(workspace_id,'ws_default'),chat_id,history,updated_at FROM ai_history;
    DROP TABLE ai_history;
    ALTER TABLE ai_history_scoped RENAME TO ai_history;
    CREATE TABLE ai_chat_directory (
      workspace_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      name TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('group','direct')),
      observed_at INTEGER NOT NULL,
      PRIMARY KEY(workspace_id,connection_id,chat_id),
      FOREIGN KEY(connection_id) REFERENCES whatsapp_connections(id) ON DELETE CASCADE
    );
    CREATE INDEX ai_chat_directory_workspace ON ai_chat_directory(workspace_id,observed_at);
    INSERT INTO ai_chat_directory(workspace_id,connection_id,chat_id,name,kind,observed_at)
      SELECT directory.workspace_id,'conn_default',directory.group_id,directory.subject,'group',directory.updated_at
      FROM group_directory AS directory JOIN whatsapp_connections AS connection
        ON connection.id='conn_default' AND connection.workspace_id=directory.workspace_id;
  `);
};
