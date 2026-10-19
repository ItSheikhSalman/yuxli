// file: src/services/entitlements.cjs
//
// YUXLI Centralized SaaS Entitlement Engine
//
// Authoritative service responsible for:
// - Plan resolution & normalization
// - Four-tier limits & feature gating (Free, Starter Developer, Business Pro, Enterprise SLA)
// - Server-side quota validation (messages, AI requests, AI tokens, schedules, groups, seats)
// - Atomic usage accounting with monthly period rollover
// - Prevention of concurrent race-condition bypasses

const crypto = require("node:crypto");
const db = require("../db/db.cjs");
const logger = require("../utils/logger.cjs");

// ===================================================================
// --- Four Primary Subscription Tiers ---
// ===================================================================

const PLANS = Object.freeze({
  free: {
    id: "free",
    name: "Free Permanent Tier",
    tagline: "Forever free tier for personal test bots and lightweight use",
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    badge: "FREE",
    limits: {
      maxNumbers: 1,
      messagesPerDay: 100,
      maxGroups: 3,
      enabledCommands: 15,
      activeAutomations: 2,
      monthlySchedules: 10,
      monthlyAiQueries: 50,
      aiTokensLimit: 100000,
      analyticsRetentionDays: 7,
      teamSeats: 1,
      allowedAiProviders: ["gemini"],
      antiBanLevel: "standard",
    },
    features: [
      "1 Linked WhatsApp Account",
      "100 Messages / Day Pacing",
      "3 Managed WhatsApp Groups",
      "15 Essential Bot Commands",
      "2 Active Group Automation Rules",
      "10 Scheduled Messages / Month",
      "50 AI Assistant Requests / Month",
      "Standard Anti-Ban Rate Limiting",
      "7-Day Analytics History",
      "Single Seat Access",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter Developer",
    tagline: "For individual builders, hobbyists, and test numbers",
    priceMonthly: 19,
    priceAnnual: 180,
    currency: "USD",
    badge: null,
    limits: {
      maxNumbers: 1,
      messagesPerDay: 2500,
      maxGroups: 20,
      enabledCommands: -1, // Unlimited
      activeAutomations: 10,
      monthlySchedules: 2500,
      monthlyAiQueries: 1000,
      aiTokensLimit: 500000,
      analyticsRetentionDays: 30,
      teamSeats: 2,
      allowedAiProviders: ["gemini", "groq", "pollinations"],
      antiBanLevel: "standard",
    },
    features: [
      "1 Linked WhatsApp Account",
      "2,500 Outbound Messages / Day",
      "20 Managed WhatsApp Groups",
      "All 80+ Commands Enabled",
      "10 Active Group Automations",
      "2,500 Scheduled Messages / Month",
      "1,000 AI Assistant Queries / Month",
      "Multi-Provider AI (Gemini, Groq)",
      "30-Day Analytics & Telemetry Retention",
      "2 Team Workspace Seats",
    ],
  },
  pro: {
    id: "pro",
    name: "Business Pro",
    tagline: "High-growth brands, active communities, and high volume",
    priceMonthly: 49,
    priceAnnual: 468,
    currency: "USD",
    badge: "MOST POPULAR",
    recommended: true,
    limits: {
      maxNumbers: 5,
      messagesPerDay: 50000,
      maxGroups: -1, // Unlimited
      enabledCommands: -1,
      activeAutomations: -1,
      monthlySchedules: 50000,
      monthlyAiQueries: 10000,
      aiTokensLimit: -1, // Unlimited
      analyticsRetentionDays: 90,
      teamSeats: 5,
      allowedAiProviders: ["gemini", "groq", "openai", "anthropic"],
      antiBanLevel: "advanced",
      slaUptime: "99.9%",
    },
    features: [
      "5 Linked WhatsApp Numbers",
      "50,000 Messages / Day High-Volume",
      "Unlimited Managed Groups",
      "Unlimited Group Automations",
      "50,000 Scheduled Messages / Month",
      "10,000 AI Queries / Month (Unlimited Tokens)",
      "All AI Providers (Claude, OpenAI, Gemini)",
      "Conservative Outbound Pacing & Quota Controls",
      "90-Day Analytics & Telemetry",
      "5 Team Workspace Seats",
      "99.9% Uptime SLA",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise SLA",
    tagline: "Corporate scale with dedicated proxy and custom SLA",
    priceMonthly: 149,
    priceAnnual: 1428,
    currency: "USD",
    badge: "ENTERPRISE SLA",
    limits: {
      maxNumbers: -1,
      messagesPerDay: -1,
      maxGroups: -1,
      enabledCommands: -1,
      activeAutomations: -1,
      monthlySchedules: -1,
      monthlyAiQueries: -1,
      aiTokensLimit: -1,
      analyticsRetentionDays: 365,
      teamSeats: -1,
      allowedAiProviders: ["gemini", "groq", "openai", "anthropic", "custom"],
      antiBanLevel: "maximum",
      slaUptime: "99.99%",
    },
    features: [
      "Unlimited WhatsApp Accounts & Instances",
      "Unlimited Messages & Zero Caps",
      "Unlimited Managed Groups & Rules",
      "Unlimited Schedules & Automations",
      "Unlimited AI Queries & Custom Model Endpoints",
      "Maximum Shield Engine + Dedicated IP Proxy Tunneling",
      "365-Day Complete Audit & Telemetry Retention",
      "Unlimited Team Seats & Granular RBAC",
      "99.99% Guaranteed SLA & Dedicated Support",
    ],
  },
});

// Canonical Free 15 Commands
const FREE_TIER_ALLOWED_COMMANDS = new Set([
  "ping",
  "help",
  "status",
  "info",
  "qr",
  "translate",
  "weather",
  "quote",
  "rand",
  "todo",
  "note",
  "notes",
  "sticker",
  "stickers",
  "gemini",
]);

// Normalize any plan string into 'free' | 'starter' | 'pro' | 'enterprise'
function normalizePlan(plan) {
  if (!plan || typeof plan !== "string") return "free";
  const clean = plan.trim().toLowerCase();
  if (clean === "free" || clean === "free tier" || clean === "plan_free") return "free";
  if (clean === "starter" || clean.includes("starter")) return "starter";
  if (clean === "pro" || clean.includes("business") || clean.includes("pro")) return "pro";
  if (clean === "enterprise" || clean.includes("enterprise")) return "enterprise";
  return "free";
}

function getPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDayPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ===================================================================
// --- Entitlement & Usage Queries ---
// ===================================================================

function getWorkspaceSubscription(workspaceId = "ws_default") {
  try {
    const row = db.q(
      "SELECT * FROM subscriptions WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(workspaceId);
    if (row) {
      return {
        ...row,
        plan: normalizePlan(row.plan),
      };
    }
  } catch {}

  // Fallback to active free subscription
  return {
    id: "sub_fallback",
    workspace_id: workspaceId,
    plan: "free",
    status: "active",
    provider: "sandbox",
    current_period_start: Date.now(),
    current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancel_at_period_end: 0,
  };
}

function getWorkspaceUsage(workspaceId = "ws_default", period = getPeriodKey()) {
  try {
    const row = db.q(
      "SELECT * FROM usage_counters WHERE workspace_id = ? AND period = ?"
    ).get(workspaceId, period);
    if (row) return row;
  } catch {}

  return {
    workspace_id: workspaceId,
    period,
    messages_count: 0,
    ai_queries_count: 0,
    ai_tokens_count: 0,
    schedules_count: 0,
  };
}

function recordUsage(workspaceId = "ws_default", metric, amount = 1) {
  const period = getPeriodKey();
  const id = `use_${workspaceId}_${period}`;
  const now = Date.now();

  const colMap = {
    messages: "messages_count",
    ai_queries: "ai_queries_count",
    ai_tokens: "ai_tokens_count",
    schedules: "schedules_count",
  };
  const col = colMap[metric];
  if (!col) return;

  try {
    db.q(`
      INSERT INTO usage_counters (id, workspace_id, period, ${col}, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, period) DO UPDATE SET
        ${col} = ${col} + excluded.${col},
        updated_at = excluded.updated_at
    `).run(id, workspaceId, period, Number(amount) || 1, now);
  } catch (err) {
    logger.error({ err, workspaceId, metric }, "[Entitlements] Failed to record usage");
  }
}

// ===================================================================
// --- Server-Side Enforcements ---
// ===================================================================

function assertCanSendMessage(workspaceId = "ws_default") {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.messagesPerDay === -1) return true;

  const usage = getWorkspaceUsage(workspaceId, getDayPeriodKey());
  if (usage.messages_count >= plan.limits.messagesPerDay) {
    const err = new Error(`Daily outbound message limit reached (${plan.limits.messagesPerDay}/day for ${plan.name}). Upgrade your plan to send more.`);
    err.code = "QUOTA_EXCEEDED";
    err.statusCode = 429;
    throw err;
  }
  return true;
}

function assertCanRunCommand(workspaceId = "ws_default", commandName) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.enabledCommands === -1) return true;

  const cleanCmd = String(commandName || "").toLowerCase().trim();
  if (!FREE_TIER_ALLOWED_COMMANDS.has(cleanCmd)) {
    const err = new Error(`Command '!${cleanCmd}' is reserved for Starter and Pro plans. Upgrade your workspace to unlock all 80+ commands.`);
    err.code = "COMMAND_NOT_ENTITLED";
    err.statusCode = 403;
    throw err;
  }
  return true;
}

function assertCanCreateSchedule(workspaceId = "ws_default", currentActiveCount = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.monthlySchedules === -1) return true;

  const usage = getWorkspaceUsage(workspaceId, getPeriodKey());
  if (usage.schedules_count >= plan.limits.monthlySchedules) {
    const err = new Error(`Monthly schedule limit reached (${plan.limits.monthlySchedules}/month for ${plan.name}). Upgrade your plan to create more schedules.`);
    err.code = "SCHEDULE_LIMIT_REACHED";
    err.statusCode = 429;
    throw err;
  }

  // Also prevent storing excessive concurrent active schedules on the Free tier
  if (plan.id === "free" && currentActiveCount >= 10) {
    const err = new Error("Free tier allows up to 10 active scheduled messages at a time. Upgrade for up to 2,500 active schedules.");
    err.code = "SCHEDULE_LIMIT_REACHED";
    err.statusCode = 429;
    throw err;
  }
  return true;
}

function assertCanQueryAi(workspaceId = "ws_default", tokenEstimate = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.monthlyAiQueries === -1 && plan.limits.aiTokensLimit === -1) return true;

  const usage = getWorkspaceUsage(workspaceId, getPeriodKey());
  if (plan.limits.monthlyAiQueries !== -1 && usage.ai_queries_count >= plan.limits.monthlyAiQueries) {
    const err = new Error(`Monthly AI query quota exceeded (${plan.limits.monthlyAiQueries} requests/month for ${plan.name}). Upgrade to Business Pro for 10,000 monthly requests.`);
    err.code = "AI_QUOTA_EXCEEDED";
    err.statusCode = 429;
    throw err;
  }

  if (plan.limits.aiTokensLimit !== -1 && usage.ai_tokens_count + tokenEstimate > plan.limits.aiTokensLimit) {
    const err = new Error(`Monthly AI token cap reached (${plan.limits.aiTokensLimit.toLocaleString()} tokens for ${plan.name}). Upgrade to Business Pro for unlimited tokens.`);
    err.code = "AI_TOKENS_EXCEEDED";
    err.statusCode = 429;
    throw err;
  }
  return true;
}

function assertCanManageGroup(workspaceId = "ws_default", currentGroupCount = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.maxGroups === -1) return true;

  if (currentGroupCount >= plan.limits.maxGroups) {
    const err = new Error(`Group management limit reached (${plan.limits.maxGroups} groups for ${plan.name}). Upgrade to manage up to 20 or unlimited groups.`);
    err.code = "GROUP_LIMIT_REACHED";
    err.statusCode = 403;
    throw err;
  }
  return true;
}

function assertCanAddAutomation(workspaceId = "ws_default", currentAutomationCount = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.activeAutomations === -1) return true;

  if (currentAutomationCount >= plan.limits.activeAutomations) {
    const err = new Error(`Active automations limit reached (${plan.limits.activeAutomations} for ${plan.name}). Upgrade to create more automations.`);
    err.code = "AUTOMATION_LIMIT_REACHED";
    err.statusCode = 403;
    throw err;
  }
  return true;
}

function assertCanAddSeat(workspaceId = "ws_default", currentMemberCount = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.teamSeats === -1) return true;

  if (currentMemberCount >= plan.limits.teamSeats) {
    const err = new Error(`Workspace seat limit reached (${plan.limits.teamSeats} seat(s) for ${plan.name}). Upgrade to add more team members.`);
    err.code = "SEAT_LIMIT_REACHED";
    err.statusCode = 403;
    throw err;
  }
  return true;
}

function assertCanAddConnection(workspaceId = "ws_default", currentCount = 0) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  if (plan.limits.maxNumbers === -1 || plan.limits.maxNumbers === Infinity) return true;

  if (currentCount >= plan.limits.maxNumbers) {
    const err = new Error(`WhatsApp connection limit reached (${plan.limits.maxNumbers} account(s) for ${plan.name}). Upgrade your plan to link more WhatsApp numbers.`);
    err.code = "CONNECTION_LIMIT_REACHED";
    err.statusCode = 403;
    throw err;
  }
  return true;
}

/**
 * Atomically reserves AI quota before initiating an LLM provider request.
 * Enforces monthly request and token limits inside a serial SQLite transaction.
 */
function reserveAiQuota(workspaceId = "ws_default", { requestId = null, tokenEstimate = 0 } = {}) {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  const period = getPeriodKey();
  const reservationId = requestId || `res_${crypto.randomBytes(8).toString("hex")}`;
  const now = Date.now();

  // If both limits are unlimited, no reservation tracking is required
  if (plan.limits.monthlyAiQueries === -1 && plan.limits.aiTokensLimit === -1) {
    return {
      reserved: true,
      unlimited: true,
      reservationId,
      workspaceId,
      tokensReserved: 0,
    };
  }

  // Ensure usage_counters row exists
  const counterId = `use_${workspaceId}_${period}`;
  db.q(`
    INSERT OR IGNORE INTO usage_counters (id, workspace_id, period, messages_count, ai_queries_count, ai_tokens_count, schedules_count, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, 0, ?)
  `).run(counterId, workspaceId, period, now);

  // Check if idempotency key was already reserved
  if (requestId) {
    const existingRes = db.q("SELECT * FROM ai_reservations WHERE id = ?").get(requestId);
    if (existingRes && existingRes.status === "reserved") {
      return {
        reserved: true,
        unlimited: false,
        reservationId,
        workspaceId,
        tokensReserved: existingRes.tokens_reserved,
      };
    }
  }

  // Atomic reservation using SQLite transaction with BEGIN IMMEDIATE
  const database = db.db;
  database.exec("BEGIN IMMEDIATE");
  try {
    const usage = database.prepare("SELECT ai_queries_count, ai_tokens_count FROM usage_counters WHERE workspace_id = ? AND period = ?").get(workspaceId, period) || { ai_queries_count: 0, ai_tokens_count: 0 };

    if (plan.limits.monthlyAiQueries !== -1 && usage.ai_queries_count >= plan.limits.monthlyAiQueries) {
      const err = new Error(`Monthly AI query quota exceeded (${plan.limits.monthlyAiQueries} requests/month for ${plan.name}). Upgrade to Business Pro for 10,000 monthly requests.`);
      err.code = "AI_QUOTA_EXCEEDED";
      err.statusCode = 429;
      throw err;
    }

    if (plan.limits.aiTokensLimit !== -1 && (usage.ai_tokens_count + tokenEstimate) > plan.limits.aiTokensLimit) {
      const err = new Error(`Monthly AI token cap reached (${plan.limits.aiTokensLimit.toLocaleString()} tokens for ${plan.name}). Upgrade to Business Pro for unlimited tokens.`);
      err.code = "AI_TOKENS_EXCEEDED";
      err.statusCode = 429;
      throw err;
    }

    // Atomically increment reserved counts
    database.prepare(`
      UPDATE usage_counters
      SET ai_queries_count = ai_queries_count + 1,
          ai_tokens_count = ai_tokens_count + ?,
          updated_at = ?
      WHERE workspace_id = ? AND period = ?
    `).run(Number(tokenEstimate) || 0, now, workspaceId, period);

    // Record reservation
    database.prepare(`
      INSERT INTO ai_reservations (id, workspace_id, period, tokens_reserved, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'reserved', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tokens_reserved = excluded.tokens_reserved,
        status = 'reserved',
        updated_at = excluded.updated_at
    `).run(reservationId, workspaceId, period, Number(tokenEstimate) || 0, now, now);

    database.exec("COMMIT");
  } catch (err) {
    try { database.exec("ROLLBACK"); } catch {}
    throw err;
  }

  return {
    reserved: true,
    unlimited: false,
    reservationId,
    workspaceId,
    tokensReserved: tokenEstimate,
  };
}

/**
 * Commits a reservation upon successful LLM generation, adjusting actual tokens.
 */
function commitAiQuotaReservation(reservationId, { actualTokens = 0 } = {}) {
  if (!reservationId) return;
  const now = Date.now();
  const res = db.q("SELECT * FROM ai_reservations WHERE id = ?").get(reservationId);
  if (!res || res.status !== "reserved") return;

  const diff = Number(actualTokens || 0) - Number(res.tokens_reserved || 0);
  if (diff !== 0) {
    db.q(`
      UPDATE usage_counters
      SET ai_tokens_count = max(0, ai_tokens_count + ?),
          updated_at = ?
      WHERE workspace_id = ? AND period = ?
    `).run(diff, now, res.workspace_id, res.period);
  }

  db.q("UPDATE ai_reservations SET status = 'committed', tokens_reserved = ?, updated_at = ? WHERE id = ?")
    .run(Number(actualTokens || 0), now, reservationId);
}

/**
 * Releases and refunds a reservation when an LLM provider request fails or times out.
 */
function releaseAiQuotaReservation(reservationId) {
  if (!reservationId) return;
  const now = Date.now();
  const res = db.q("SELECT * FROM ai_reservations WHERE id = ?").get(reservationId);
  if (!res || res.status !== "reserved") return;

  // Refund the 1 query and the reserved tokens
  db.q(`
    UPDATE usage_counters
    SET ai_queries_count = max(0, ai_queries_count - 1),
        ai_tokens_count = max(0, ai_tokens_count - ?),
        updated_at = ?
    WHERE workspace_id = ? AND period = ?
  `).run(Number(res.tokens_reserved || 0), now, res.workspace_id, res.period);

  db.q("UPDATE ai_reservations SET status = 'released', updated_at = ? WHERE id = ?")
    .run(now, reservationId);

  logger.info({ reservationId, workspaceId: res.workspace_id }, "[Entitlements] Released and refunded AI quota reservation");
}

function getEntitlementSummary(workspaceId = "ws_default") {
  const sub = getWorkspaceSubscription(workspaceId);
  const plan = PLANS[sub.plan] || PLANS.free;
  const usage = getWorkspaceUsage(workspaceId, getPeriodKey());

  return {
    workspaceId,
    subscription: sub,
    plan,
    usage: {
      period: usage.period,
      messagesSent: usage.messages_count,
      messagesLimit: plan.limits.messagesPerDay,
      aiQueriesCount: usage.ai_queries_count,
      aiQueriesLimit: plan.limits.monthlyAiQueries,
      aiTokensCount: usage.ai_tokens_count,
      aiTokensLimit: plan.limits.aiTokensLimit,
      schedulesCount: usage.schedules_count,
      schedulesLimit: plan.limits.monthlySchedules,
    },
    capabilities: {
      unlimitedCommands: plan.limits.enabledCommands === -1,
      allowedAiProviders: plan.limits.allowedAiProviders,
      antiBanLevel: plan.limits.antiBanLevel,
      retentionDays: plan.limits.analyticsRetentionDays,
      teamSeats: plan.limits.teamSeats,
    },
  };
}

module.exports = {
  PLANS,
  FREE_TIER_ALLOWED_COMMANDS,
  normalizePlan,
  getPeriodKey,
  getDayPeriodKey,
  getWorkspaceSubscription,
  getWorkspaceUsage,
  recordUsage,
  assertCanSendMessage,
  assertCanRunCommand,
  assertCanCreateSchedule,
  assertCanQueryAi,
  assertCanManageGroup,
  assertCanAddAutomation,
  assertCanAddSeat,
  assertCanAddConnection,
  reserveAiQuota,
  commitAiQuotaReservation,
  releaseAiQuotaReservation,
  getEntitlementSummary,
};
