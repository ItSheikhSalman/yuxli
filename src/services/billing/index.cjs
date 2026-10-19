// file: src/services/billing/index.cjs
//
// YUXLI Provider-Independent SaaS Billing Integration
//
// Supports:
// 1. Stripe Checkout & Signed Webhook Processing (live when STRIPE_SECRET_KEY is present)
// 2. Sandbox / Mock Billing Gateway (for local development, CI test suites, and offline mode)
// 3. Replay attack protection & idempotent event ledger (billing_events table)
// 4. Server-side plan pricing verification

const crypto = require("node:crypto");
const db = require("../../db/db.cjs");
const logger = require("../../utils/logger.cjs");
const entitlements = require("../entitlements.cjs");

// Approved fixed prices from audit & product specifications
const PRICING = Object.freeze({
  free: { monthly: 0, annual: 0 },
  starter: { monthly: 19, annual: 180 },
  pro: { monthly: 49, annual: 468 },
  enterprise: { monthly: 149, annual: 1428 },
});

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Creates a checkout session for upgrading or changing plans.
 */
async function createCheckoutSession({
  workspaceId = "ws_default",
  userEmail,
  planId,
  interval = "monthly", // 'monthly' | 'annual'
  successUrl,
  cancelUrl,
}) {
  const targetPlan = entitlements.normalizePlan(planId);
  const planInfo = entitlements.PLANS[targetPlan];
  if (!planInfo) {
    throw new Error(`Invalid plan identifier: ${planId}`);
  }

  // Free plan requires no payment gateway session
  if (targetPlan === "free") {
    syncWorkspacePlan(workspaceId, "free", "active", "system");
    return {
      success: true,
      mode: "free",
      url: successUrl || "/dashboard",
      message: "Switched to Free plan successfully.",
    };
  }

  const price = interval === "annual" ? PRICING[targetPlan].annual : PRICING[targetPlan].monthly;

  // If live Stripe credentials exist, we would use stripe sdk:
  if (isStripeConfigured()) {
    try {
      // Lazy load Stripe only if configured
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: userEmail,
        client_reference_id: workspaceId,
        metadata: {
          workspaceId,
          planId: targetPlan,
          interval,
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Yuxli ${planInfo.name}`,
                description: planInfo.tagline,
              },
              unit_amount: price * 100,
              recurring: {
                interval: interval === "annual" ? "year" : "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl || "http://127.0.0.1:3000/?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: cancelUrl || "http://127.0.0.1:3000/",
      });

      return {
        success: true,
        provider: "stripe",
        sessionId: session.id,
        url: session.url,
      };
    } catch (err) {
      logger.error({ err }, "[Billing] Stripe checkout initiation failed");
      throw new Error(`Failed to initiate Stripe checkout: ${err.message}`);
    }
  }

  // Sandbox / Mock Provider Gateway
  const mockSessionId = `cs_sandbox_${crypto.randomBytes(12).toString("hex")}`;
  const mockRedirectUrl = `${successUrl || "/"}?session_id=${mockSessionId}&mock_plan=${targetPlan}&mock_status=success`;

  logger.info(
    { workspaceId, targetPlan, price, interval },
    "[Billing] Sandbox checkout initiated (Stripe credentials not configured)"
  );

  return {
    success: true,
    provider: "sandbox",
    sessionId: mockSessionId,
    url: mockRedirectUrl,
    amount: price,
    currency: "USD",
    plan: targetPlan,
    message: "Sandbox payment gateway ready. Complete simulation in test mode.",
  };
}

/**
 * Validates Stripe raw-body webhook signature using HMAC-SHA256.
 */
function verifyStripeSignature(rawBody, signatureHeader, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.trim().split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  // Protect against replay attacks (5 minute threshold)
  const toleranceSeconds = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSeconds) {
    logger.warn({ timestamp, now }, "[Billing] Webhook signature expired (replay protection)");
    return false;
  }

  const payload = `${timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const bufHmac = Buffer.from(hmac);
  const bufExpected = Buffer.from(expectedSig);
  if (bufHmac.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufHmac, bufExpected);
}

/**
 * Handles incoming Stripe webhook requests with full signature validation,
 * timestamp tolerance, idempotency check, and lifecycle state persistence.
 */
async function handleIncomingWebhook(rawBody, signatureHeader) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return {
      status: 503,
      body: { error: "Stripe webhook secret is not configured" },
    };
  }

  const isValid = verifyStripeSignature(rawBody, signatureHeader);
  if (!isValid) {
    logger.warn("[Billing] Rejecting webhook with invalid signature");
    return {
      status: 400,
      body: { error: "Invalid Stripe webhook signature" },
    };
  }

  let event;
  try {
    const text = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    event = JSON.parse(text);
  } catch (err) {
    return {
      status: 400,
      body: { error: "Malformed JSON payload" },
    };
  }

  const eventId = event.id;
  const eventType = event.type;
  if (!eventId || !eventType) {
    return {
      status: 400,
      body: { error: "Missing event id or type" },
    };
  }

  // Idempotent processing check
  const existing = db.q("SELECT id FROM billing_events WHERE event_id = ?").get(eventId);
  if (existing) {
    logger.info({ eventId }, "[Billing] Webhook event already processed (idempotent skip)");
    return {
      status: 200,
      body: { received: true, duplicate: true },
    };
  }

  let result = { handled: true };

  switch (eventType) {
    case "checkout.session.completed": {
      const session = event.data?.object || {};
      const workspaceId = session.metadata?.workspaceId || session.client_reference_id || "ws_default";
      const targetPlan = session.metadata?.planId || "starter";
      const interval = session.metadata?.interval || "monthly";
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      syncWorkspacePlan(workspaceId, targetPlan, "active", "stripe", {
        customerId,
        subscriptionId,
        interval,
      });
      result = { workspaceId, plan: targetPlan, status: "active" };
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data?.object || {};
      const workspaceId = subscription.metadata?.workspaceId ||
        db.q("SELECT workspace_id FROM subscriptions WHERE provider_subscription_id = ?").get(subscription.id)?.workspace_id ||
        "ws_default";
      const status = subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : "incomplete";
      const targetPlan = subscription.metadata?.planId;

      if (targetPlan) {
        syncWorkspacePlan(workspaceId, targetPlan, status, "stripe", {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
        });
      } else {
        db.q("UPDATE subscriptions SET status = ?, updated_at = ? WHERE provider_subscription_id = ?")
          .run(status, Date.now(), subscription.id);
      }
      result = { workspaceId, status };
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data?.object || {};
      const workspaceId = subscription.metadata?.workspaceId ||
        db.q("SELECT workspace_id FROM subscriptions WHERE provider_subscription_id = ?").get(subscription.id)?.workspace_id ||
        "ws_default";

      // Downgrade to permanent Free plan upon cancellation
      syncWorkspacePlan(workspaceId, "free", "canceled", "stripe", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });
      result = { workspaceId, plan: "free", status: "canceled" };
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data?.object || {};
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        db.q("UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE provider_subscription_id = ?")
          .run(Date.now(), subscriptionId);
      }
      result = { invoice: invoice.id, status: "past_due" };
      break;
    }

    default:
      logger.info({ eventType }, "[Billing] Unhandled Stripe event type ignored");
      result = { ignored: true };
      break;
  }

  // Record in billing_events ledger
  try {
    db.q(`
      INSERT INTO billing_events (id, provider, event_id, event_type, payload, processed_at)
      VALUES (?, 'stripe', ?, ?, ?, ?)
    `).run(
      `evt_${crypto.randomBytes(8).toString("hex")}`,
      eventId,
      eventType,
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"),
      Date.now()
    );
  } catch (err) {
    logger.error({ err, eventId }, "[Billing] Failed to record billing event");
  }

  return {
    status: 200,
    body: { received: true, eventId, result },
  };
}

/**
 * Idempotently processes signed billing events.
 */
function processBillingEvent(eventId, eventType, provider, payload, handler) {
  // Check if event was already processed
  const existing = db.q("SELECT id FROM billing_events WHERE event_id = ?").get(eventId);
  if (existing) {
    logger.info({ eventId }, "[Billing] Webhook event already processed (idempotent skip)");
    return { duplicate: true };
  }

  // Run handler
  const result = handler();

  // Record in billing ledger
  try {
    db.q(`
      INSERT INTO billing_events (id, provider, event_id, event_type, payload, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `evt_${crypto.randomBytes(8).toString("hex")}`,
      provider,
      eventId,
      eventType,
      typeof payload === "string" ? payload : JSON.stringify(payload),
      Date.now()
    );
  } catch (err) {
    logger.error({ err, eventId }, "[Billing] Failed to record billing event");
  }

  return { success: true, result };
}

/**
 * Synchronizes subscription and workspace plan in SQLite.
 */
function syncWorkspacePlan(workspaceId, planId, status = "active", provider = "sandbox", metadata = {}) {
  const targetPlan = entitlements.normalizePlan(planId);
  const now = Date.now();
  const periodEnd = now + (metadata.interval === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000;

  db.q(`
    INSERT INTO subscriptions (
      id, workspace_id, plan, status, provider,
      provider_customer_id, provider_subscription_id,
      current_period_start, current_period_end, cancel_at_period_end,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      provider = excluded.provider,
      provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id),
      provider_subscription_id = coalesce(excluded.provider_subscription_id, subscriptions.provider_subscription_id),
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).run(
    `sub_${crypto.randomBytes(8).toString("hex")}`,
    workspaceId,
    targetPlan,
    status,
    provider,
    metadata.customerId || null,
    metadata.subscriptionId || null,
    now,
    periodEnd,
    now,
    now
  );

  logger.info({ workspaceId, targetPlan, status, provider }, "[Billing] Workspace plan synchronized");
  return { workspaceId, plan: targetPlan, status };
}

module.exports = {
  PRICING,
  isStripeConfigured,
  createCheckoutSession,
  verifyStripeSignature,
  handleIncomingWebhook,
  processBillingEvent,
  syncWorkspacePlan,
};
