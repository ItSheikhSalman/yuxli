import { Router } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repository = require("../services/intelligence/repository.cjs");
const personas = require("../services/intelligence/personas.cjs");
const privacy = require("../services/intelligence/privacy.cjs");
const profiler = require("../services/intelligence/profiler.cjs");
const memory = require("../services/intelligence/memory.cjs");
const knowledge = require("../services/intelligence/knowledge.cjs");
const engine = require("../services/intelligence/engine.cjs");
const evaluations = require("../services/intelligence/evaluations.cjs");
const catalog = require("../services/intelligence/catalog.cjs");
const chatDirectory = require("../services/intelligence/chatDirectory.cjs");
const { isPanelSessionValid } = require("../panel/session-auth.cjs");
const router = Router();

export function resolveTrainingAccess(session) {
  if (!isPanelSessionValid(session)) throw repository.error("Authentication required", 401);
  if (!session.saasUserId || session.installationOperator === true)
    return {
      workspaceId: repository.workspace("ws_default"),
      actorId: "panel-owner",
      admin: true,
      operator: true,
    };
  const memberships = repository
    .q("SELECT workspace_id,role FROM workspace_members WHERE user_id=?")
    .all(session.saasUserId);
  const selected = session.saasUser?.workspaceId;
  const membership = selected
    ? memberships.find((entry) => entry.workspace_id === selected)
    : memberships.length === 1
      ? memberships[0]
      : null;
  if (!membership)
    throw repository.error("Select a workspace with a current membership", 403, "WORKSPACE_DENIED");
  return {
    workspaceId: repository.workspace(membership.workspace_id),
    actorId: session.saasUserId,
    admin: ["owner", "admin"].includes(membership.role),
    operator: false,
  };
}

router.use((req, res, next) => {
  try {
    req.training = resolveTrainingAccess(req.session);
    if (!req.training.admin) throw repository.error("Workspace administrator access required", 403);
    res.setHeader("Cache-Control", "no-store");
    next();
  } catch (cause) {
    next(cause);
  }
});

const route = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, req.training);
  } catch (cause) {
    next(cause);
  }
};

router.get(
  "/overview",
  route((req, res, access) => {
    const { workspaceId } = access;
    const groups = repository.list(workspaceId, "group").map((group) => ({
      ...group,
      profile: profiler.profile(workspaceId, group.chatId),
      metrics: require("../services/intelligence/whatsapp.cjs").stats(workspaceId, group.chatId),
    }));
    res.json({
      workspaceId,
      operator: access.operator,
      groups,
      authorizedChats: chatDirectory.list(workspaceId),
      limits: repository.limits(workspaceId),
      deployment: repository.deployment(workspaceId),
      templates: catalog.PERSONAS,
      notice: privacy.NOTICE,
      noticeVersion: privacy.NOTICE_VERSION,
      formats: knowledge.EXTENSIONS,
      sourceCatalog: catalog.SOURCE_CATALOG,
      capabilities: {
        reactions: "Baileys native",
        modelWeightTraining: false,
        pdf: false,
        docx: false,
        cloudApi: false,
      },
      connections: repository
        .q("SELECT id,name FROM whatsapp_connections WHERE workspace_id=?")
        .all(workspaceId),
    });
  }),
);

router.post(
  "/groups",
  route((req, res, access) => {
    const old = privacy.group(access.workspaceId, req.body.chatId || "");
    if (!old.id || req.body.enabled === true || req.body.learning === true) chatDirectory.assertAvailable(access.workspaceId, req.body.chatId);
    res.json(privacy.saveGroup(access.workspaceId, req.body, access.actorId));
  }),
);

router.post(
  "/groups/reset",
  route((req, res, access) => {
    privacy.clearProfile(access.workspaceId, personas.text(req.body.chatId, 150), access.actorId);
    res.json({ success: true });
  }),
);

router.post(
  "/groups/import",
  route((req, res, access) => {
    chatDirectory.assertAvailable(access.workspaceId, req.body.chatId);
    if (
      req.body.authorized !== true ||
      !Array.isArray(req.body.messages) ||
      req.body.messages.length > 1000
    )
      throw repository.error("Explicitly authorized import of at most 1000 messages required");
    const chatId = personas.text(req.body.chatId, 150);
    let accepted = 0;
    for (const item of req.body.messages) {
      if (
        typeof item.userId !== "string" ||
        typeof item.text !== "string" ||
        typeof item.id !== "string" ||
        item.id.length > 150 ||
        item.text.length > 16000
      )
        throw repository.error("Invalid imported message");
      if (!privacy.mayLearn(access.workspaceId, chatId, item.userId))
        throw repository.error("Every imported participant must explicitly opt into learning", 403);
    }
    for (const item of req.body.messages) {
      const input = {
        workspaceId: access.workspaceId,
        chatId,
        userId: item.userId,
        messageId: `import:${item.id}`,
      };
      if (
        !require("../services/intelligence/whatsapp.cjs").claim(input).duplicate &&
        profiler.observe({ ...input, text: item.text })
      )
        accepted += 1;
    }
    repository.audit(
      access.workspaceId,
      access.actorId,
      "authorized-style-import",
      privacy.groupId(chatId),
    );
    res.json({ accepted, retainedRawMessages: 0 });
  }),
);

router.get(
  "/resources/:kind",
  route((req, res, access) => {
    if (
      !["persona", "rule", "example", "document", "feedback", "evaluation", "version"].includes(
        req.params.kind,
      )
    )
      throw repository.error("Unsupported resource kind");
    res.json(repository.list(access.workspaceId, req.params.kind));
  }),
);

router.post(
  "/resources/:kind",
  route((req, res, access) => {
    const kind = req.params.kind;
    let body;
    if (kind === "persona") body = personas.validate(req.body);
    else if (kind === "rule")
      body = {
        name: personas.text(req.body.name, 100),
        instructions: personas.text(req.body.instructions, 3000),
      };
    else if (kind === "example")
      body = {
        name: personas.text(req.body.name, 100),
        prompt: personas.text(req.body.prompt, 2000),
        response: personas.text(req.body.response, 4000),
        personaId: personas.text(req.body.personaId, 100),
      };
    else if (kind === "feedback") {
      if (!catalog.FEEDBACK.includes(req.body.category))
        throw repository.error("Invalid feedback category");
      body = {
        category: req.body.category,
        correction: personas.text(req.body.correction, 4000),
        responseId: personas.text(req.body.responseId, 100),
        reviewed: false,
      };
    } else throw repository.error("This resource cannot be written directly", 403);
    if (require("../services/intelligence/signals.cjs").SECRET.test(JSON.stringify(body)))
      throw repository.error("Remove secrets from training material");
    res.json(
      repository.put(access.workspaceId, kind, body, access.actorId, {
        id: req.body.id,
        revision: req.body.revision,
      }),
    );
  }),
);

router.post(
  "/resources/:kind/:id/approve",
  route((req, res, access) => {
    const { kind, id } = req.params;
    if (kind === "document")
      return res.json(knowledge.approve(access.workspaceId, id, access.actorId, req.body.revision));
    if (!["example", "rule", "feedback"].includes(kind))
      throw repository.error("Unsupported approval");
    const value = repository.get(access.workspaceId, kind, id);
    if (!value) throw repository.error("Resource not found", 404);
    res.json(
      repository.put(
        access.workspaceId,
        kind,
        { ...value, reviewed: true, reviewedBy: access.actorId },
        access.actorId,
        { id, revision: req.body.revision, approved: true },
      ),
    );
  }),
);

router.delete(
  "/resources/:kind/:id",
  route((req, res, access) => {
    if (
      !["persona", "rule", "example", "document", "feedback", "evaluation", "version"].includes(
        req.params.kind,
      )
    )
      throw repository.error("Unsupported deletion");
    if (
      req.params.kind === "version" &&
      repository.deployment(access.workspaceId).versionId === req.params.id
    )
      throw repository.error("Deactivate the version before deleting", 409);
    res.json({
      deleted: repository.remove(
        access.workspaceId,
        req.params.kind,
        req.params.id,
        access.actorId,
      ),
    });
  }),
);

router.post(
  "/knowledge",
  route((req, res, access) =>
    res.json(knowledge.ingest(access.workspaceId, req.body, access.actorId)),
  ),
);
router.get(
  "/memory",
  route((req, res, access) =>
    res.json(memory.list(access.workspaceId, access.actorId, { shared: true })),
  ),
);
router.post(
  "/memory",
  route((req, res, access) => {
    if (!req.body.confirmed) throw repository.error("Explicit memory confirmation required");
    res.json(memory.save(access.workspaceId, access.actorId, req.body, { moderator: true }));
  }),
);
router.delete(
  "/memory/:id",
  route((req, res, access) =>
    res.json({
      deleted: memory.remove(access.workspaceId, req.params.id, access.actorId, {
        moderator: true,
      }),
    }),
  ),
);
router.post(
  "/playground",
  route(async (req, res, access) =>
    res.json(await engine.playground(access.workspaceId, access.actorId, req.body)),
  ),
);
router.post(
  "/evaluations",
  route((req, res, access) => res.json(evaluations.run(access.workspaceId, access.actorId))),
);

router.post(
  "/versions",
  route((req, res, access) => {
    const snapshot = {
      personas: repository.list(access.workspaceId, "persona"),
      rules: repository.list(access.workspaceId, "rule").filter((item) => item.approved),
      examples: repository.list(access.workspaceId, "example").filter((item) => item.approved),
    };
    res.json(
      repository.put(
        access.workspaceId,
        "version",
        { name: personas.text(req.body.name, 100), snapshot },
        access.actorId,
      ),
    );
  }),
);
router.put(
  "/deployment",
  route((req, res, access) => {
    const body = personas.validateDeployment(req.body, access.workspaceId);
    if (body.versionId && !repository.get(access.workspaceId, "version", body.versionId))
      throw repository.error("Unknown version");
    res.json(
      repository.put(access.workspaceId, "deployment", body, access.actorId, {
        id: "current",
        revision: req.body.revision,
      }),
    );
  }),
);
router.post(
  "/handoff/:id/resume",
  route((req, res, access) => {
    const value = repository.get(access.workspaceId, "feedback", req.params.id);
    if (!value || value.category !== "handoff") throw repository.error("Handoff not found", 404);
    res.json(
      repository.put(access.workspaceId, "feedback", { ...value, active: false }, access.actorId, {
        id: value.id,
        revision: req.body.revision,
      }),
    );
  }),
);
router.get(
  "/plans",
  route((req, res) => res.json(repository.planMatrix())),
);
router.put(
  "/plans",
  route((req, res, access) => {
    if (!access.operator)
      throw repository.error("Only the installation operator can change plan limits", 403);
    const result = repository.savePlanMatrix(req.body);
    repository.audit(access.workspaceId, access.actorId, "training-plan-matrix", "plans");
    res.json(result);
  }),
);

router.use((cause, req, res, next) => {
  if (res.headersSent) return next(cause);
  res.status(cause.statusCode || 500).json({
    error: cause.statusCode ? cause.message : "Training request failed",
    code: cause.code || "TRAINING_ERROR",
  });
});

export default router;
