// tests/atomic-ai-quota.test.mjs
//
// Verification of Atomic AI Quota Enforcement:
// - Atomic pre-request reservation using SQLite transactions
// - Prevention of race conditions under high concurrent load
// - Exact limit enforcement without over-consumption
// - Request idempotency (replaying same requestId does not double charge)
// - Provider failure refund and reservation release
// - Token reconciliation on successful completion
// - Multi-tenant workspace isolation

import { equal, finish, ok, require, section, useTempDataDir } from "./harness.mjs";

useTempDataDir("levix-atomic-ai-quota");

const db = require("./src/db/db.cjs");
const store = require("./src/db/store.cjs");
const entitlements = require("./src/services/entitlements.cjs");
const billing = require("./src/services/billing/index.cjs");

section("pre-request atomic reservation at limit boundary");
// Free plan allows 50 AI queries per month
const sub = entitlements.getWorkspaceSubscription("ws_default");
equal("default plan is free", sub.plan, "free");

const period = entitlements.getPeriodKey();

// Set initial counter to 45 (5 remaining queries)
const counterId = `use_ws_default_${period}`;
db.q(`
  INSERT INTO usage_counters (id, workspace_id, period, messages_count, ai_queries_count, ai_tokens_count, schedules_count, updated_at)
  VALUES (?, 'ws_default', ?, 0, 45, 1000, 0, ?)
  ON CONFLICT(id) DO UPDATE SET ai_queries_count = 45, ai_tokens_count = 1000
`).run(counterId, period, Date.now());

const beforeUsage = entitlements.getWorkspaceUsage("ws_default", period);
equal("initial queries count is 45", beforeUsage.ai_queries_count, 45);

section("parallel concurrency race test (20 concurrent requests for 5 remaining slots)");
// Dispatch 20 concurrent reservation attempts
const concurrentAttempts = Array.from({ length: 20 }, (_, idx) => {
  return new Promise((resolve) => {
    try {
      const res = entitlements.reserveAiQuota("ws_default", {
        requestId: `req_concurrency_${idx}`,
        tokenEstimate: 50,
      });
      resolve({ success: true, res });
    } catch (err) {
      resolve({ success: false, err });
    }
  });
});

const outcomes = await Promise.all(concurrentAttempts);
const succeeded = outcomes.filter((o) => o.success);
const rejected = outcomes.filter((o) => !o.success);

equal("exactly 5 requests succeeded", succeeded.length, 5);
equal("exactly 15 requests rejected", rejected.length, 15);

// Check that every rejected request received 429 AI_QUOTA_EXCEEDED
const allExceededCodes = rejected.every((r) => r.err.code === "AI_QUOTA_EXCEEDED" && r.err.statusCode === 429);
ok("all rejections have AI_QUOTA_EXCEEDED code", allExceededCodes);

// Verify counter did not leak past the 50 limit
const afterConcurrencyUsage = entitlements.getWorkspaceUsage("ws_default", period);
equal("usage is exactly capped at 50", afterConcurrencyUsage.ai_queries_count, 50);

section("request idempotency");
// Replaying an already-reserved requestId must return the existing reservation without incrementing
const existingRequestId = succeeded[0].res.reservationId;
const replayOutcome = entitlements.reserveAiQuota("ws_default", {
  requestId: existingRequestId,
  tokenEstimate: 50,
});
equal("idempotent replay succeeded", replayOutcome.reserved, true);
equal("reservation ID preserved", replayOutcome.reservationId, existingRequestId);

const usageAfterReplay = entitlements.getWorkspaceUsage("ws_default", period);
equal("usage counter was not incremented on replay", usageAfterReplay.ai_queries_count, 50);

section("provider failure refund & release");
// Release one of the successful reservations (simulating LLM network timeout or provider 500)
const reservationToRefund = succeeded[0].res.reservationId;
entitlements.releaseAiQuotaReservation(reservationToRefund);

// Verify query was refunded back to 49
const usageAfterRefund = entitlements.getWorkspaceUsage("ws_default", period);
equal("query was refunded back to 49", usageAfterRefund.ai_queries_count, 49);

const reservationRow = db.q("SELECT status FROM ai_reservations WHERE id = ?").get(reservationToRefund);
equal("reservation record marked as released", reservationRow.status, "released");

// Now another request can be made since 1 slot is freed
const freedSlotRes = entitlements.reserveAiQuota("ws_default", {
  requestId: "req_after_refund",
  tokenEstimate: 50,
});
equal("slot reused after refund", freedSlotRes.reserved, true);
const usageAfterReusing = entitlements.getWorkspaceUsage("ws_default", period);
equal("usage back to 50 cap", usageAfterReusing.ai_queries_count, 50);

section("token reconciliation on commit");
// Commit reservation with actual tokens different from estimate (estimated 50, actual 120)
const reservationToCommit = succeeded[1].res.reservationId;
const tokensBefore = usageAfterReusing.ai_tokens_count;
entitlements.commitAiQuotaReservation(reservationToCommit, { actualTokens: 120 });

const usageAfterCommit = entitlements.getWorkspaceUsage("ws_default", period);
// Difference was 120 - 50 = +70 tokens
equal("token difference reconciled", usageAfterCommit.ai_tokens_count, tokensBefore + 70);

const committedRow = db.q("SELECT status, tokens_reserved FROM ai_reservations WHERE id = ?").get(reservationToCommit);
equal("status committed", committedRow.status, "committed");
equal("actual tokens saved", committedRow.tokens_reserved, 120);

section("multi-tenant workspace isolation");
// Create Tenant B on Starter plan
store.insertWorkspace({ id: "ws_tenant_b", name: "Tenant B", slug: "tenant-b" });
billing.syncWorkspacePlan("ws_tenant_b", "starter", "active");

// Tenant B should start with clean usage
const tenantBUsage = entitlements.getWorkspaceUsage("ws_tenant_b", period);
equal("tenant B has 0 queries", tenantBUsage.ai_queries_count, 0);

// Tenant B reserves AI query
const tenantBRes = entitlements.reserveAiQuota("ws_tenant_b", {
  requestId: "req_tenant_b_1",
  tokenEstimate: 75,
});
equal("tenant B reservation succeeds", tenantBRes.reserved, true);

const tenantBAfter = entitlements.getWorkspaceUsage("ws_tenant_b", period);
equal("tenant B usage is 1", tenantBAfter.ai_queries_count, 1);

// ws_default usage is untouched
const wsDefaultCheck = entitlements.getWorkspaceUsage("ws_default", period);
equal("ws_default usage untouched", wsDefaultCheck.ai_queries_count, 50);

finish();
