/**
 * billing.ts — Stripe billing routes for OTB Chess Pro subscriptions.
 *
 * Endpoints:
 *   POST /api/billing/checkout   — create a Stripe Checkout session (requires auth)
 *   POST /api/billing/portal     — create a Stripe Customer Portal session (requires auth)
 *   POST /api/billing/webhook    — handle Stripe webhook events (raw body)
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY            — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET        — Stripe webhook signing secret (whsec_...)
 *   STRIPE_PRICE_MONTHLY         — Stripe Price ID for monthly plan
 *   STRIPE_PRICE_ANNUAL          — Stripe Price ID for annual plan
 */

import { Router } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { users } from "../shared/schema.js";
import { requireFullAuth } from "./auth.js";
import { logger } from "./logger.js";

// ─── Stripe client (lazy — only initialised when keys are present) ─────────────────────────────
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ─── Price ID helpers ─────────────────────────────────────────────────────────
function getPriceId(plan: string): string | null {
  if (plan === "monthly") return process.env.STRIPE_PRICE_MONTHLY ?? null;
  if (plan === "annual")  return process.env.STRIPE_PRICE_ANNUAL  ?? null;
  return null;
}

// ─── Auth request type helper ─────────────────────────────────────────────────
type AuthedRequest = import("express").Request & { userId: string; isGuest: boolean };

type BillingUser = { id: string; email: string | null };

export function buildCheckoutSessionParams(
  plan: "monthly" | "annual",
  priceId: string,
  origin: string,
  user: BillingUser,
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    metadata: { userId: user.id, plan },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id, plan },
    },
  };
}

export function extractStripeUserId(
  value: Pick<Stripe.Checkout.Session, "client_reference_id" | "metadata"> | Pick<Stripe.Subscription, "metadata">,
): string | null {
  if ("client_reference_id" in value && typeof value.client_reference_id === "string" && value.client_reference_id.length > 0) {
    return value.client_reference_id;
  }

  const metadataUserId = value.metadata?.userId;
  return typeof metadataUserId === "string" && metadataUserId.length > 0 ? metadataUserId : null;
}

// ─── Router factory ───────────────────────────────────────────────────────────
export function createBillingRouter(): Router {
  const router = Router();

  // ── POST /checkout — create Stripe Checkout session ────────────────────────
  router.post("/checkout", requireFullAuth, async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Billing is not configured yet. Please add Stripe keys." });
    }

    const { plan } = req.body as { plan?: string };
    if (!plan || !["monthly", "annual"].includes(plan)) {
      return res.status(400).json({ error: "plan must be 'monthly' or 'annual'." });
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return res.status(503).json({ error: `Stripe price for '${plan}' plan is not configured.` });
    }

    try {
      const authedReq = req as AuthedRequest;
      const db = await getDb();
      const [user] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, authedReq.userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      const origin = req.headers.origin ?? `https://${req.headers.host}`;

      const session = await stripe.checkout.sessions.create(
        buildCheckoutSessionParams(plan as "monthly" | "annual", priceId, origin, user),
      );

      return res.json({ url: session.url });
    } catch (err) {
      logger.error("billing_checkout_failed", { error: err });
      return res.status(500).json({ error: "Failed to create checkout session." });
    }
  });

  // ── POST /portal — create Stripe Customer Portal session ───────────────────
  router.post("/portal", requireFullAuth, async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Billing is not configured yet." });
    }

    try {
      const authedReq = req as AuthedRequest;
      const db = await getDb();
      const [user] = await db
        .select({ id: users.id, stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, authedReq.userId))
        .limit(1);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription found." });
      }

      const origin = req.headers.origin ?? `https://${req.headers.host}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/`,
      });

      return res.json({ url: portalSession.url });
    } catch (err) {
      logger.error("billing_portal_failed", { error: err });
      return res.status(500).json({ error: "Failed to create portal session." });
    }
  });

  // ── POST /webhook — handle Stripe webhook events ────────────────────────────
  // NOTE: This route must receive the raw body (Buffer), not parsed JSON.
  // In server/index.ts, register it with express.raw() BEFORE the JSON middleware.
  router.post("/webhook", async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret) {
      // Acknowledge without processing when not configured
      return res.status(200).json({ received: true });
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header." });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err) {
      logger.warn("billing_webhook_signature_rejected", { error: err });
      return res.status(400).json({ error: "Webhook signature verification failed." });
    }

    try {
      const db = await getDb();

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = extractStripeUserId(session);
          const customerId = session.customer as string | null;

          if (userId) {
            await db
              .update(users)
              .set({
                isPro: true,
                ...(customerId ? { stripeCustomerId: customerId } : {}),
              })
              .where(eq(users.id, userId));
            logger.info("billing_pro_activated", { stripeEventId: event.id });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = extractStripeUserId(sub);
          if (userId) {
            await db
              .update(users)
              .set({ isPro: false })
              .where(eq(users.id, userId));
            logger.info("billing_pro_deactivated", { stripeEventId: event.id });
          }
          break;
        }

        case "invoice.payment_failed": {
          logger.warn("billing_payment_failed", { stripeEventId: event.id });
          // Future: send email notification
          break;
        }

        default:
          // Unhandled event type — ignore silently
          break;
      }
    } catch (err) {
      logger.error("billing_webhook_handler_failed", { stripeEventId: event.id, error: err });
      return res.status(500).json({ error: "Webhook processing failed." });
    }

    return res.json({ received: true });
  });

  return router;
}
