import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const wizard = readFileSync(resolve(root, "client/src/components/TournamentWizard.tsx"), "utf8");
const registry = readFileSync(resolve(root, "client/src/lib/tournamentRegistry.ts"), "utf8");

describe("tournament payment-link configuration", () => {
  it("includes event-level Venmo, Cash App, and PayPal values in wizard state", () => {
    expect(wizard).toContain("paymentVenmo: string;");
    expect(wizard).toContain("paymentCashapp: string;");
    expect(wizard).toContain("paymentPaypal: string;");
    expect(wizard).toContain('paymentVenmo: "",');
    expect(wizard).toContain('paymentCashapp: "",');
    expect(wizard).toContain('paymentPaypal: "",');
  });

  it("prefills event payment links from a linked club without making them immutable", () => {
    expect(wizard).toContain("paymentVenmo: club?.paymentVenmo ?? \"\"");
    expect(wizard).toContain("paymentCashapp: club?.paymentCashapp ?? \"\"");
    expect(wizard).toContain("paymentPaypal: club?.paymentPaypal ?? \"\"");
    expect(wizard).toContain("these values stay editable for this tournament");
  });

  it("renders the payment configuration directly after the preview in both Quickstart and Schedule flows", () => {
    expect(wizard.match(/Optional entry payment links/g)).toHaveLength(2);
    expect(wizard.match(/Venmo @handle or link/g)).toHaveLength(2);
    expect(wizard.match(/Cash App \$cashtag or link/g)).toHaveLength(2);
    expect(wizard.match(/PayPal link/g)).toHaveLength(2);
  });

  it("persists payment choices in the new tournament configuration", () => {
    expect(wizard).toContain("paymentVenmo: data.paymentVenmo.trim() || null");
    expect(wizard).toContain("paymentCashapp: data.paymentCashapp.trim() || null");
    expect(wizard).toContain("paymentPaypal: data.paymentPaypal.trim() || null");
    expect(registry).toContain("paymentVenmo?: string | null;");
    expect(registry).toContain("paymentCashapp?: string | null;");
    expect(registry).toContain("paymentPaypal?: string | null;");
  });
});
