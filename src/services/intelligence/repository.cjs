const { randomUUID } = require("node:crypto");
const { db, q, parseJson } = require("../../db/db.cjs");
const entitlements = require("../entitlements.cjs");

const KINDS = new Set([
  "persona",
  "rule",
  "example",
  "document",
  "feedback",
  "evaluation",
  "version",
  "deployment",
  "group",
]);
const DEFAULT_LIMITS = Object.freeze({
  free: {
    personas: 2,
    knowledgeBytes: 262144,
    documents: 10,
    examples: 25,
    playground: 20,
    evaluations: 5,
    retentionDays: 7,
  },
  starter: {
    personas: 10,
    knowledgeBytes: 5242880,
    documents: 100,
    examples: 250,
    playground: 200,
    evaluations: 30,
    retentionDays: 30,
  },
  pro: {
    personas: 50,
    knowledgeBytes: 52428800,
    documents: 1000,
    examples: 2500,
    playground: 2000,
    evaluations: 300,
    retentionDays: 90,
  },
  enterprise: {
    personas: 200,
    knowledgeBytes: 268435456,
    documents: 5000,
    examples: 10000,
    playground: 10000,
    evaluations: 1000,
    retentionDays: 365,
  },
});
const DEPLOYMENT = Object.freeze({
  enabled: false,
  versionId: null,
  defaultPersona: "general",
  assignments: {},
  retentionDays: 7,
  maxContextChars: 14000,
  cooldownSeconds: 10,
  perUserMinute: 6,
  perGroupMinute: 12,
  groupAutoReply: false,
  keywords: [],
  replyToBot: false,
  quietHours: null,
  inputCostPerMillion: null,
  outputCostPerMillion: null,
});

function error(message, statusCode = 400, code = "TRAINING_INVALID") {
  return Object.assign(new Error(message), { statusCode, code });
}

function workspace(workspaceId) {
  if (
    typeof workspaceId !== "string" ||
    !q("SELECT id FROM workspaces WHERE id = ?").get(workspaceId)
  ) {
    throw error("Workspace is missing or unavailable", 403, "WORKSPACE_DENIED");
  }
  return workspaceId;
}

function transaction(operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (cause) {
    db.exec("ROLLBACK");
    throw cause;
  }
}

function limits(workspaceId) {
  workspace(workspaceId);
  const subscription = entitlements.getWorkspaceSubscription(workspaceId);
  const plan = entitlements.normalizePlan(subscription.plan);
  return {
    ...DEFAULT_LIMITS[plan],
    ...parseJson(
      q("SELECT body FROM ai_training_plan_limits WHERE plan_id = ?").get(plan)?.body,
      {},
    ),
  };
}

function planMatrix() {
  return Object.fromEntries(
    Object.keys(DEFAULT_LIMITS).map((plan) => [
      plan,
      {
        ...DEFAULT_LIMITS[plan],
        ...parseJson(
          q("SELECT body FROM ai_training_plan_limits WHERE plan_id = ?").get(plan)?.body,
          {},
        ),
      },
    ]),
  );
}

function savePlanMatrix(matrix) {
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix))
    throw error("Invalid plan matrix");
  for (const [plan, values] of Object.entries(matrix)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, plan)) throw error("Unknown plan");
    for (const [key, value] of Object.entries(values || {})) {
      if (
        !Object.hasOwn(DEFAULT_LIMITS[plan], key) ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > 1073741824
      )
        throw error("Invalid training limit");
    }
  }
  transaction(() => {
    for (const [plan, values] of Object.entries(matrix)) {
      q(
        "INSERT INTO ai_training_plan_limits(plan_id, body) VALUES (?, ?) ON CONFLICT(plan_id) DO UPDATE SET body=excluded.body",
      ).run(plan, JSON.stringify(values));
    }
  });
  return planMatrix();
}

function count(workspaceId, kind) {
  return q(
    "SELECT count(*) AS total FROM ai_training_resources WHERE workspace_id=? AND kind=?",
  ).get(workspaceId, kind).total;
}

function audit(workspaceId, actorId, action, resourceId) {
  q("INSERT INTO ai_training_events VALUES (?, ?, ?, ?, ?, ?)").run(
    workspaceId,
    randomUUID(),
    actorId,
    action,
    resourceId,
    Date.now(),
  );
}

function list(workspaceId, kind) {
  workspace(workspaceId);
  if (!KINDS.has(kind)) throw error("Unknown resource kind");
  return q(
    "SELECT * FROM ai_training_resources WHERE workspace_id=? AND kind=? ORDER BY updated_at DESC, id LIMIT 5000",
  )
    .all(workspaceId, kind)
    .map((row) => ({
      ...parseJson(row.body, {}),
      id: row.id,
      revision: row.revision,
      updatedAt: row.updated_at,
    }));
}

function get(workspaceId, kind, id) {
  workspace(workspaceId);
  const row = q("SELECT * FROM ai_training_resources WHERE workspace_id=? AND kind=? AND id=?").get(
    workspaceId,
    kind,
    id,
  );
  return row
    ? { ...parseJson(row.body, {}), id: row.id, revision: row.revision, updatedAt: row.updated_at }
    : null;
}

function put(
  workspaceId,
  kind,
  body,
  actorId,
  { id = randomUUID(), revision, approved = false } = {},
) {
  workspace(workspaceId);
  if (!KINDS.has(kind) || !body || typeof body !== "object" || Array.isArray(body))
    throw error("Invalid resource");
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw error("Invalid resource id");
  const encoded = JSON.stringify(body);
  if (Buffer.byteLength(encoded) > 2097152) throw error("Resource too large", 413);
  const cap = limits(workspaceId);
  return transaction(() => {
    const old = get(workspaceId, kind, id);
    if (old && revision !== old.revision)
      throw error("Resource changed; reload before saving", 409, "REVISION_CONFLICT");
    const metric = { persona: "personas", document: "documents", example: "examples" }[kind];
    if (!old && metric && count(workspaceId, kind) >= cap[metric])
      throw error(`Training ${metric} quota exceeded`, 429, "TRAINING_QUOTA");
    if (!old && !metric && count(workspaceId, kind) >= 1000)
      throw error("Resource retention limit reached; delete old records", 429);
    const clean = { ...body, approved: Boolean(approved) };
    delete clean.id;
    delete clean.revision;
    delete clean.updatedAt;
    q(`INSERT INTO ai_training_resources(workspace_id, kind, id, body, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(workspace_id, kind, id) DO UPDATE SET body=excluded.body, revision=ai_training_resources.revision+1, updated_at=excluded.updated_at`).run(
      workspaceId,
      kind,
      id,
      JSON.stringify(clean),
      Date.now(),
    );
    audit(workspaceId, actorId, old ? "update" : "create", `${kind}:${id}`);
    return get(workspaceId, kind, id);
  });
}

function remove(workspaceId, kind, id, actorId) {
  workspace(workspaceId);
  return transaction(() => {
    const changes = q(
      "DELETE FROM ai_training_resources WHERE workspace_id=? AND kind=? AND id=?",
    ).run(workspaceId, kind, id).changes;
    if (kind === "document")
      q("DELETE FROM ai_knowledge_chunks WHERE workspace_id=? AND document_id=?").run(
        workspaceId,
        id,
      );
    if (kind === "document")
      q("DELETE FROM ai_knowledge_index WHERE workspace_id=? AND document_id=?").run(
        workspaceId,
        id,
      );
    if (changes) audit(workspaceId, actorId, "delete", `${kind}:${id}`);
    return Boolean(changes);
  });
}

function deployment(workspaceId) {
  return { ...DEPLOYMENT, ...get(workspaceId, "deployment", "current") };
}

function consume(workspaceId, metric) {
  if (!["playground", "evaluations"].includes(metric)) throw error("Unknown usage metric");
  const maximum = limits(workspaceId)[metric];
  const period = new Date().toISOString().slice(0, 7);
  return transaction(() => {
    const used =
      q("SELECT count FROM ai_training_usage WHERE workspace_id=? AND period=? AND metric=?").get(
        workspaceId,
        period,
        metric,
      )?.count || 0;
    if (used >= maximum) throw error(`${metric} quota exceeded`, 429, "TRAINING_QUOTA");
    q(
      "INSERT INTO ai_training_usage VALUES (?, ?, ?, 1) ON CONFLICT(workspace_id,period,metric) DO UPDATE SET count=count+1",
    ).run(workspaceId, period, metric);
  });
}

function sweep(workspaceId, now = Date.now()) {
  workspace(workspaceId);
  q("DELETE FROM ai_approved_memories WHERE workspace_id=? AND expires_at<=?").run(
    workspaceId,
    now,
  );
  q("DELETE FROM ai_conversation_state WHERE workspace_id=? AND expires_at<=?").run(
    workspaceId,
    now,
  );
  q("DELETE FROM ai_reply_receipts WHERE workspace_id=? AND created_at<?").run(
    workspaceId,
    now - 86400000,
  );
  q("DELETE FROM ai_training_events WHERE workspace_id=? AND created_at<?").run(
    workspaceId,
    now - 90 * 86400000,
  );
  q("DELETE FROM ai_style_buckets WHERE workspace_id=? AND expires_at<=?").run(workspaceId, now);
  q("DELETE FROM ai_adaptive_metrics WHERE workspace_id=? AND day<?").run(
    workspaceId,
    new Date(now - 30 * 86400000).toISOString().slice(0, 10),
  );
  q("DELETE FROM ai_training_usage WHERE workspace_id=? AND period<?").run(
    workspaceId,
    new Date(now - 366 * 86400000).toISOString().slice(0, 7),
  );
  for (const document of list(workspaceId, "document")) {
    if (document.expiresAt <= now) remove(workspaceId, "document", document.id, "retention");
  }
  q(
    "DELETE FROM ai_training_resources WHERE workspace_id=? AND kind IN ('feedback','evaluation') AND updated_at<?",
  ).run(workspaceId, now - 30 * 86400000);
}

module.exports = {
  db,
  q,
  parseJson,
  error,
  workspace,
  transaction,
  limits,
  planMatrix,
  savePlanMatrix,
  list,
  get,
  put,
  remove,
  deployment,
  consume,
  audit,
  sweep,
  DEPLOYMENT,
};
