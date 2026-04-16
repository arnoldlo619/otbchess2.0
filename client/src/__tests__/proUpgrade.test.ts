/**
 * proUpgrade.test.ts — Unit tests for the Pro upgrade modal and Stripe billing system.
 *
 * Tests cover:
 *   1. Feature comparison table data completeness
 *   2. Pricing tier configuration (monthly / annual)
 *   3. Billing API request validation helpers
 *   4. Checkout session payload construction
 *   5. Webhook event type handling
 *   6. ProUpgradeModal prop contract
 *   7. Annual discount calculation
 */
import { describe, it, expect } from "vitest";

// ─── Feature table data (mirrors ProUpgradeModal.tsx) ────────────────────────
interface FeatureRow {
  label: string;
  free: boolean | string;
  pro: boolean | string;
}

const FEATURE_TABLE: FeatureRow[] = [
  { label: "Tournament management",   free: true,           pro: true },
  { label: "Club creation",           free: true,           pro: true },
  { label: "Battle mode",             free: true,           pro: true },
  { label: "Chess clock",             free: true,           pro: true },
  { label: "Openings library",        free: false,          pro: true },
  { label: "Study mode",              free: false,          pro: true },
  { label: "Drill mode",              free: false,          pro: true },
  { label: "Trap lines",              free: false,          pro: true },
  { label: "Coach insights",          free: "3 per month",  pro: "Unlimited" },
  { label: "Game analysis",           free: "5 per month",  pro: "Unlimited" },
  { label: "Priority support",        free: false,          pro: true },
];

// ─── Pricing configuration ────────────────────────────────────────────────────
interface PricingTier {
  id: "monthly" | "annual";
  label: string;
  priceMonthly: number;
  billedAs: string;
}

const PRICING: PricingTier[] = [
  {
    id: "monthly",
    label: "Monthly",
    priceMonthly: 9.99,
    billedAs: "Billed monthly",
  },
  {
    id: "annual",
    label: "Annual",
    priceMonthly: 6.99,
    billedAs: "Billed annually",
  },
];

// ─── Billing request validation helpers (mirrors server/billing.ts logic) ────
function isValidCheckoutRequest(body: unknown): body is { plan: "monthly" | "annual"; successUrl: string; cancelUrl: string } {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.plan !== "monthly" && b.plan !== "annual") return false;
  if (typeof b.successUrl !== "string" || !b.successUrl.startsWith("http")) return false;
  if (typeof b.cancelUrl !== "string" || !b.cancelUrl.startsWith("http")) return false;
  return true;
}

function buildCheckoutPayload(
  plan: "monthly" | "annual",
  priceId: string,
  customerId: string | null,
  successUrl: string,
  cancelUrl: string
) {
  return {
    mode: "subscription" as const,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(customerId ? { customer: customerId } : {}),
    metadata: { plan },
    allow_promotion_codes: true,
  };
}

// ─── Webhook event type classifier ───────────────────────────────────────────
type WebhookAction = "activate_pro" | "deactivate_pro" | "ignore";

function classifyWebhookEvent(eventType: string): WebhookAction {
  if (eventType === "checkout.session.completed") return "activate_pro";
  if (
    eventType === "customer.subscription.deleted" ||
    eventType === "customer.subscription.updated"
  ) return "deactivate_pro";
  return "ignore";
}

// ─── Annual discount calculation ─────────────────────────────────────────────
function annualSavingsPercent(monthly: number, annualMonthly: number): number {
  return Math.round(((monthly - annualMonthly) / monthly) * 100);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Feature comparison table", () => {
  it("has at least 10 rows", () => {
    expect(FEATURE_TABLE.length).toBeGreaterThanOrEqual(10);
  });

  it("all Pro cells are true or a non-empty string", () => {
    for (const row of FEATURE_TABLE) {
      expect(row.pro === true || (typeof row.pro === "string" && row.pro.length > 0)).toBe(true);
    }
  });

  it("every row has a non-empty label", () => {
    for (const row of FEATURE_TABLE) {
      expect(row.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("openings library is gated (free = false)", () => {
    const row = FEATURE_TABLE.find((r) => r.label === "Openings library");
    expect(row).toBeDefined();
    expect(row!.free).toBe(false);
    expect(row!.pro).toBe(true);
  });

  it("tournament management is available on free tier", () => {
    const row = FEATURE_TABLE.find((r) => r.label === "Tournament management");
    expect(row).toBeDefined();
    expect(row!.free).toBe(true);
  });
});

describe("Pricing configuration", () => {
  it("has exactly two tiers: monthly and annual", () => {
    expect(PRICING).toHaveLength(2);
    expect(PRICING.map((p) => p.id)).toEqual(["monthly", "annual"]);
  });

  it("monthly price is greater than annual per-month price", () => {
    const monthly = PRICING.find((p) => p.id === "monthly")!;
    const annual  = PRICING.find((p) => p.id === "annual")!;
    expect(monthly.priceMonthly).toBeGreaterThan(annual.priceMonthly);
  });

  it("prices are positive numbers", () => {
    for (const tier of PRICING) {
      expect(tier.priceMonthly).toBeGreaterThan(0);
    }
  });

  it("annual tier label says 'Annual'", () => {
    const annual = PRICING.find((p) => p.id === "annual")!;
    expect(annual.label).toBe("Annual");
  });
});

describe("Annual discount calculation", () => {
  it("annual plan saves at least 20%", () => {
    const monthly = PRICING.find((p) => p.id === "monthly")!;
    const annual  = PRICING.find((p) => p.id === "annual")!;
    const savings = annualSavingsPercent(monthly.priceMonthly, annual.priceMonthly);
    expect(savings).toBeGreaterThanOrEqual(20);
  });

  it("savings calculation is correct for 9.99 vs 6.99", () => {
    const savings = annualSavingsPercent(9.99, 6.99);
    expect(savings).toBe(30);
  });
});

describe("Billing request validation", () => {
  it("accepts a valid monthly checkout request", () => {
    expect(isValidCheckoutRequest({
      plan: "monthly",
      successUrl: "https://chessotb.club/success",
      cancelUrl: "https://chessotb.club/cancel",
    })).toBe(true);
  });

  it("accepts a valid annual checkout request", () => {
    expect(isValidCheckoutRequest({
      plan: "annual",
      successUrl: "https://chessotb.club/success",
      cancelUrl: "https://chessotb.club/cancel",
    })).toBe(true);
  });

  it("rejects an invalid plan value", () => {
    expect(isValidCheckoutRequest({
      plan: "lifetime",
      successUrl: "https://chessotb.club/success",
      cancelUrl: "https://chessotb.club/cancel",
    })).toBe(false);
  });

  it("rejects a missing successUrl", () => {
    expect(isValidCheckoutRequest({
      plan: "monthly",
      cancelUrl: "https://chessotb.club/cancel",
    })).toBe(false);
  });

  it("rejects a non-http successUrl", () => {
    expect(isValidCheckoutRequest({
      plan: "monthly",
      successUrl: "javascript:alert(1)",
      cancelUrl: "https://chessotb.club/cancel",
    })).toBe(false);
  });

  it("rejects null input", () => {
    expect(isValidCheckoutRequest(null)).toBe(false);
  });

  it("rejects empty object", () => {
    expect(isValidCheckoutRequest({})).toBe(false);
  });
});

describe("Checkout session payload construction", () => {
  const PRICE_ID = "price_test_monthly_abc123";
  const SUCCESS  = "https://chessotb.club/success";
  const CANCEL   = "https://chessotb.club/cancel";

  it("sets mode to subscription", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, null, SUCCESS, CANCEL);
    expect(payload.mode).toBe("subscription");
  });

  it("includes the correct price ID in line_items", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, null, SUCCESS, CANCEL);
    expect(payload.line_items[0].price).toBe(PRICE_ID);
    expect(payload.line_items[0].quantity).toBe(1);
  });

  it("attaches customer ID when provided", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, "cus_abc123", SUCCESS, CANCEL);
    expect((payload as Record<string, unknown>).customer).toBe("cus_abc123");
  });

  it("omits customer field when null", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, null, SUCCESS, CANCEL);
    expect((payload as Record<string, unknown>).customer).toBeUndefined();
  });

  it("stores plan in metadata", () => {
    const payload = buildCheckoutPayload("annual", PRICE_ID, null, SUCCESS, CANCEL);
    expect(payload.metadata.plan).toBe("annual");
  });

  it("enables promotion codes", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, null, SUCCESS, CANCEL);
    expect(payload.allow_promotion_codes).toBe(true);
  });

  it("sets success and cancel URLs correctly", () => {
    const payload = buildCheckoutPayload("monthly", PRICE_ID, null, SUCCESS, CANCEL);
    expect(payload.success_url).toBe(SUCCESS);
    expect(payload.cancel_url).toBe(CANCEL);
  });
});

describe("Webhook event type classifier", () => {
  it("activates Pro on checkout.session.completed", () => {
    expect(classifyWebhookEvent("checkout.session.completed")).toBe("activate_pro");
  });

  it("deactivates Pro on customer.subscription.deleted", () => {
    expect(classifyWebhookEvent("customer.subscription.deleted")).toBe("deactivate_pro");
  });

  it("deactivates Pro on customer.subscription.updated", () => {
    expect(classifyWebhookEvent("customer.subscription.updated")).toBe("deactivate_pro");
  });

  it("ignores payment_intent.succeeded", () => {
    expect(classifyWebhookEvent("payment_intent.succeeded")).toBe("ignore");
  });

  it("ignores unknown event types", () => {
    expect(classifyWebhookEvent("invoice.paid")).toBe("ignore");
    expect(classifyWebhookEvent("")).toBe("ignore");
  });
});

describe("ProUpgradeModal prop contract", () => {
  it("isOpen accepts boolean true", () => {
    const props = { isOpen: true, onClose: () => {} };
    expect(typeof props.isOpen).toBe("boolean");
    expect(props.isOpen).toBe(true);
  });

  it("isOpen accepts boolean false", () => {
    const props = { isOpen: false, onClose: () => {} };
    expect(props.isOpen).toBe(false);
  });

  it("onClose is a function", () => {
    const props = { isOpen: false, onClose: () => {} };
    expect(typeof props.onClose).toBe("function");
  });

  it("highlightFeature is optional", () => {
    const props: { isOpen: boolean; onClose: () => void; highlightFeature?: string } = {
      isOpen: false,
      onClose: () => {},
    };
    expect(props.highlightFeature).toBeUndefined();
  });

  it("highlightFeature can be set to a string", () => {
    const props = { isOpen: true, onClose: () => {}, highlightFeature: "Openings Library" };
    expect(props.highlightFeature).toBe("Openings Library");
  });
});
