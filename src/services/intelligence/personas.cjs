const repository = require("./repository.cjs");
const { PERSONAS, LANGUAGES, STYLES, LEARNING_MODES } = require("./catalog.cjs");

function text(value, max, fallback = "") {
  if (value == null) return fallback;
  if (typeof value !== "string" || value.length > max)
    throw repository.error(`Expected text no longer than ${max} characters`);
  return value.trim();
}

function enumeration(value, values, fallback) {
  if (value === undefined) return fallback;
  if (!values.includes(value)) throw repository.error("Invalid configuration choice");
  return value;
}

function level(value, fallback = 0) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > 5)
    throw repository.error("Intensity must be between 0 and 5");
  return value;
}

function strings(value, max = 30) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw repository.error("Invalid list");
  return value.map((item) => text(item, 500));
}

function quietHours(value) {
  if (value == null) return null;
  if (
    !Number.isInteger(value.start) ||
    !Number.isInteger(value.end) ||
    value.start < 0 ||
    value.start > 23 ||
    value.end < 0 ||
    value.end > 23 ||
    value.start === value.end
  )
    throw repository.error("Quiet hours require distinct hours from 0 to 23");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone }).format();
  } catch {
    throw repository.error("Invalid quiet-hours timezone");
  }
  if (typeof value.timezone !== "string") throw repository.error("Timezone required");
  return { start: value.start, end: value.end, timezone: value.timezone };
}

function validate(input) {
  if (!input || typeof input !== "object") throw repository.error("Persona required");
  const base = PERSONAS.find((persona) => persona.id === input.template) || PERSONAS[0];
  const name = text(input.name, 100, base.name);
  if (!name) throw repository.error("Persona name required");
  return {
    name,
    template: base.id,
    description: text(input.description, 1000, base.description),
    role: text(input.role, 200, base.role),
    purpose: text(input.purpose, 1000, base.purpose),
    instructions: text(input.instructions, 6000),
    traits: strings(input.traits),
    formality: level(input.formality, base.formality),
    humor: level(input.humor, base.humor),
    sarcasm: level(input.sarcasm),
    empathy: level(input.empathy, 4),
    emoji: level(input.emoji, 1),
    slang: strings(input.slang),
    profanity: enumeration(input.profanity, ["none", "mild", "casual", "strong"], "none"),
    roastMode: input.roastMode === true,
    responseLength: enumeration(
      input.responseLength,
      ["adaptive", "short", "medium", "long"],
      "adaptive",
    ),
    style: enumeration(input.style, STYLES, base.style),
    language: enumeration(input.language, LANGUAGES, base.language),
    culturalContext: text(input.culturalContext, 500),
    knowledgeSources: strings(input.knowledgeSources),
    toolPermissions: strings(input.toolPermissions),
    memoryPolicy: enumeration(input.memoryPolicy, ["off", "explicit"], "explicit"),
    safetyRestrictions: strings(input.safetyRestrictions),
    escalationRules: strings(input.escalationRules),
    triggers: strings(input.triggers),
    quietHours: quietHours(input.quietHours),
    school: text(input.school, 100, "unspecified"),
    learningMode: enumeration(input.learningMode, LEARNING_MODES, "step-by-step"),
    enabled: input.enabled !== false,
  };
}

function available(workspaceId, snapshot = null) {
  return [...PERSONAS, ...(snapshot?.personas || repository.list(workspaceId, "persona"))];
}

function select(workspaceId, { personaId, chatId, intent, snapshot, config } = {}) {
  const settings = config || repository.deployment(workspaceId);
  const id =
    personaId ||
    settings.assignments[chatId] ||
    (intent === "islamic"
      ? "islamic"
      : intent === "business"
        ? "support"
        : intent === "education"
          ? "student"
          : settings.defaultPersona);
  return (
    available(workspaceId, snapshot).find((persona) => persona.id === id && persona.enabled) ||
    PERSONAS[0]
  );
}

function validateDeployment(input, workspaceId) {
  const settings = { ...repository.DEPLOYMENT, ...input };
  const bounded = (name, min, max) => {
    if (!Number.isInteger(settings[name]) || settings[name] < min || settings[name] > max)
      throw repository.error(`Invalid ${name}`);
  };
  bounded("retentionDays", 0, repository.limits(workspaceId).retentionDays);
  bounded("maxContextChars", 8000, 30000);
  bounded("cooldownSeconds", 0, 3600);
  bounded("perUserMinute", 1, 30);
  bounded("perGroupMinute", 1, 60);
  if (
    !settings.assignments ||
    Array.isArray(settings.assignments) ||
    typeof settings.assignments !== "object" ||
    Object.keys(settings.assignments).length > 1000
  )
    throw repository.error("Invalid assignments");
  const ids = new Set(
    available(workspaceId)
      .filter((persona) => persona.enabled)
      .map((persona) => persona.id),
  );
  if (
    !ids.has(settings.defaultPersona) ||
    Object.entries(settings.assignments).some(([chat, id]) => chat.length > 150 || !ids.has(id))
  )
    throw repository.error("Unknown or disabled persona assignment");
  for (const field of ["inputCostPerMillion", "outputCostPerMillion"]) {
    if (
      settings[field] !== null &&
      (typeof settings[field] !== "number" ||
        !Number.isFinite(settings[field]) ||
        settings[field] < 0 ||
        settings[field] > 100000)
    )
      throw repository.error("Invalid estimated price");
  }
  return {
    enabled: settings.enabled === true,
    versionId: text(settings.versionId, 100) || null,
    defaultPersona: settings.defaultPersona,
    assignments: settings.assignments,
    retentionDays: settings.retentionDays,
    maxContextChars: settings.maxContextChars,
    cooldownSeconds: settings.cooldownSeconds,
    perUserMinute: settings.perUserMinute,
    perGroupMinute: settings.perGroupMinute,
    groupAutoReply: settings.groupAutoReply === true,
    keywords: strings(settings.keywords, 20),
    replyToBot: settings.replyToBot === true,
    quietHours: quietHours(settings.quietHours),
    inputCostPerMillion: settings.inputCostPerMillion,
    outputCostPerMillion: settings.outputCostPerMillion,
  };
}

module.exports = { validate, available, select, text, strings, quietHours, validateDeployment };
