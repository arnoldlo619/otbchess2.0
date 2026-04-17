/**
 * test-billing.mjs — End-to-end billing integration test
 *
 * Tests:
 *  1. Stripe SDK initialises with STRIPE_SECRET_KEY
 *  2. STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL price IDs exist in Stripe
 *  3. A Stripe Checkout session can be created (simulates what /api/billing/checkout does)
 *  4. Webhook signature verification works with STRIPE_WEBHOOK_SECRET
 *  5. DB isPro flag can be set/cleared (simulates webhook handler logic)
 *
 * Run: node scripts/test-billing.mjs
 */

import Stripe from "stripe";
import mysql from "mysql2/promise";
import crypto from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────
const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[34mℹ\x1b[0m";

let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ── 1. Environment ────────────────────────────────────────────────────────────
section("1. Environment variables");

const stripeKey     = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const priceMonthly  = process.env.STRIPE_PRICE_MONTHLY;
const priceAnnual   = process.env.STRIPE_PRICE_ANNUAL;
const dbUrl         = process.env.DATABASE_URL;

assert(!!stripeKey,     "STRIPE_SECRET_KEY is set",     stripeKey ? "" : "missing");
assert(!!webhookSecret, "STRIPE_WEBHOOK_SECRET is set",  webhookSecret ? "" : "missing");
assert(!!priceMonthly,  "STRIPE_PRICE_MONTHLY is set",   priceMonthly ? "" : "missing");
assert(!!priceAnnual,   "STRIPE_PRICE_ANNUAL is set",    priceAnnual ? "" : "missing");
assert(!!dbUrl,         "DATABASE_URL is set",           dbUrl ? "" : "missing");

if (!stripeKey) {
  console.log(`\n${FAIL} Cannot continue without STRIPE_SECRET_KEY. Aborting.`);
  process.exit(1);
}

// ── 2. Stripe SDK + Price IDs ─────────────────────────────────────────────────
section("2. Stripe SDK & Price IDs");

const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

let monthlyPrice, annualPrice;

try {
  monthlyPrice = await stripe.prices.retrieve(priceMonthly);
  assert(monthlyPrice.id === priceMonthly, `Monthly price exists (${priceMonthly})`);
  assert(monthlyPrice.active, "Monthly price is active");
  assert(monthlyPrice.recurring?.interval === "month", "Monthly price interval is 'month'");
  console.log(`  ${INFO} Monthly: ${monthlyPrice.currency.toUpperCase()} ${(monthlyPrice.unit_amount / 100).toFixed(2)}/${monthlyPrice.recurring?.interval}`);
} catch (err) {
  assert(false, `Monthly price retrieval failed`, err.message);
}

try {
  annualPrice = await stripe.prices.retrieve(priceAnnual);
  assert(annualPrice.id === priceAnnual, `Annual price exists (${priceAnnual})`);
  assert(annualPrice.active, "Annual price is active");
  assert(annualPrice.recurring?.interval === "year", "Annual price interval is 'year'");
  console.log(`  ${INFO} Annual: ${annualPrice.currency.toUpperCase()} ${(annualPrice.unit_amount / 100).toFixed(2)}/${annualPrice.recurring?.interval}`);
} catch (err) {
  assert(false, `Annual price retrieval failed`, err.message);
}

// ── 3. Checkout session creation ──────────────────────────────────────────────
section("3. Checkout session creation");

let checkoutSession;
try {
  checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceMonthly, quantity: 1 }],
    client_reference_id: "test-user-id-001",
    success_url: "https://chessotb.club/pro/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://chessotb.club/pricing",
    metadata: { userId: "test-user-id-001" },
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: "test-user-id-001" } },
  });

  assert(!!checkoutSession.id,  "Checkout session created successfully");
  assert(checkoutSession.url?.startsWith("https://checkout.stripe.com"), "Session URL is a valid Stripe Checkout URL");
  assert(checkoutSession.status === "open", "Session status is 'open'");
  assert(checkoutSession.client_reference_id === "test-user-id-001", "client_reference_id preserved");
  console.log(`  ${INFO} Session ID: ${checkoutSession.id}`);
  console.log(`  ${INFO} URL: ${checkoutSession.url?.substring(0, 60)}…`);
} catch (err) {
  assert(false, "Checkout session creation failed", err.message);
}

// ── 4. Webhook signature verification ────────────────────────────────────────
section("4. Webhook signature verification");

try {
  // Build a minimal checkout.session.completed event payload
  const eventPayload = JSON.stringify({
    id: "evt_test_" + crypto.randomBytes(8).toString("hex"),
    type: "checkout.session.completed",
    data: {
      object: {
        id: checkoutSession?.id ?? "cs_test_fake",
        object: "checkout.session",
        client_reference_id: "test-user-id-001",
        customer: "cus_test_fake",
        metadata: { userId: "test-user-id-001" },
        payment_status: "paid",
        status: "complete",
      },
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${eventPayload}`;
  const sig = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");
  const stripeSignature = `t=${timestamp},v1=${sig}`;

  // Verify using the Stripe SDK (same as billing.ts does)
  const event = stripe.webhooks.constructEvent(
    Buffer.from(eventPayload),
    stripeSignature,
    webhookSecret
  );

  assert(event.type === "checkout.session.completed", "Webhook signature verified successfully");
  assert(event.data.object.client_reference_id === "test-user-id-001", "Event payload intact after verification");
} catch (err) {
  assert(false, "Webhook signature verification failed", err.message);
}

// ── 5. Database isPro flag update ─────────────────────────────────────────────
section("5. Database isPro flag (webhook handler simulation)");

let conn;
try {
  conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Find a real user to test with (pick the first non-guest user)
  const [rows] = await conn.execute(
    "SELECT id, email, is_pro FROM users WHERE is_guest = 0 ORDER BY created_at ASC LIMIT 1"
  );
  const testUser = rows[0];

  if (!testUser) {
    console.log(`  ${INFO} No non-guest users found — skipping DB flag test`);
  } else {
    const originalIsPro = testUser.is_pro;
    console.log(`  ${INFO} Testing with user: ${testUser.email} (current isPro: ${originalIsPro})`);

    // Simulate checkout.session.completed → set isPro = true
    await conn.execute("UPDATE users SET is_pro = 1 WHERE id = ?", [testUser.id]);
    const [rows2] = await conn.execute("SELECT is_pro FROM users WHERE id = ?", [testUser.id]);
    assert(rows2[0].is_pro === 1, "isPro set to true (checkout.session.completed simulation)");

    // Simulate customer.subscription.deleted → set isPro = false
    await conn.execute("UPDATE users SET is_pro = 0 WHERE id = ?", [testUser.id]);
    const [rows3] = await conn.execute("SELECT is_pro FROM users WHERE id = ?", [testUser.id]);
    assert(rows3[0].is_pro === 0, "isPro set to false (customer.subscription.deleted simulation)");

    // Restore original state
    await conn.execute("UPDATE users SET is_pro = ? WHERE id = ?", [originalIsPro, testUser.id]);
    console.log(`  ${INFO} Restored original isPro = ${originalIsPro}`);
  }
} catch (err) {
  assert(false, "Database isPro update failed", err.message);
} finally {
  if (conn) await conn.end();
}

// ── 6. Live webhook endpoint reachability ─────────────────────────────────────
section("6. Webhook endpoint reachability");

try {
  const res = await fetch("https://chessotb.club/api/billing/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "invalid" },
    body: JSON.stringify({}),
  });
  // Expect 400 (bad signature) — proves the endpoint is live and responding
  assert(res.status === 400, `Webhook endpoint is reachable (returned ${res.status} for invalid sig)`);
} catch (err) {
  assert(false, "Webhook endpoint unreachable", err.message);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${PASS} ${passed} passed  ${failed > 0 ? FAIL : ""} ${failed > 0 ? failed + " failed" : ""}`);
console.log(`${"─".repeat(50)}\n`);

if (failed > 0) process.exit(1);
