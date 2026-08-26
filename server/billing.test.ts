import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCheckoutSessionParams, extractStripeUserId } from "./billing.js";

const projectRoot = resolve(import.meta.dirname ?? __dirname, "..");

describe("Stripe billing lifecycle contracts", () => {
  it("creates subscription checkout with stable user identity in both metadata locations", () => {
    const params = buildCheckoutSessionParams(
      "monthly",
      "price_monthly",
      "https://chessotb.club",
      { id: "user_123", email: "member@example.com" },
    );

    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_monthly", quantity: 1 }],
      customer_email: "member@example.com",
      client_reference_id: "user_123",
      success_url: "https://chessotb.club/pro/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://chessotb.club/",
      metadata: { userId: "user_123", plan: "monthly" },
      subscription_data: { metadata: { userId: "user_123", plan: "monthly" } },
    });
  });

  it("prefers Checkout client reference and safely falls back to subscription metadata", () => {
    expect(extractStripeUserId({ client_reference_id: "checkout_user", metadata: { userId: "metadata_user" } })).toBe("checkout_user");
    expect(extractStripeUserId({ client_reference_id: null, metadata: { userId: "metadata_user" } })).toBe("metadata_user");
    expect(extractStripeUserId({ metadata: {} })).toBeNull();
    expect(extractStripeUserId({ metadata: { userId: "" } })).toBeNull();
  });

  it("registers raw webhook parsing before the billing router and Pro Success polls entitlement state", () => {
    const serverSource = readFileSync(resolve(projectRoot, "server/index.ts"), "utf8");
    const successSource = readFileSync(resolve(projectRoot, "client/src/pages/ProSuccess.tsx"), "utf8");

    expect(serverSource.indexOf('app.use("/api/billing/webhook", express.raw({ type: "application/json" }))'))
      .toBeLessThan(serverSource.indexOf('app.use("/api/billing", createBillingRouter())'));
    expect(successSource).toContain("user?.isPro");
    expect(successSource).toContain("pollCount < 8");
    expect(successSource).toContain("1500");
  });
});
