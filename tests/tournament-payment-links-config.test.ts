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

  it("includes a separate optional QR image state for each payment method", () => {
    expect(wizard).toContain("paymentVenmoQrUrl: string;");
    expect(wizard).toContain("paymentCashappQrUrl: string;");
    expect(wizard).toContain("paymentPaypalQrUrl: string;");
    expect(wizard).toContain('paymentVenmoQrUrl: "",');
    expect(wizard).toContain('paymentCashappQrUrl: "",');
    expect(wizard).toContain('paymentPaypalQrUrl: "",');
  });

  it("uses a reusable QR uploader with safe file validation and accessible image controls", () => {
    expect(wizard).toContain("function PaymentQrUpload");
    expect(wizard).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(wizard).toContain("QR image must be 1.5 MB or smaller.");
    expect(wizard).toContain("payment QR preview");
    expect(wizard).toContain("Remove ${method} QR image");
  });

  it("shows method-specific QR upload controls in both post-preview configuration flows", () => {
    expect(wizard.match(/<PaymentQrUpload method="Venmo"/g)).toHaveLength(2);
    expect(wizard.match(/<PaymentQrUpload method="Cash App"/g)).toHaveLength(2);
    expect(wizard.match(/<PaymentQrUpload method="PayPal"/g)).toHaveLength(2);
  });

  it("persists QR image values with the event-level payment configuration", () => {
    expect(wizard).toContain("paymentVenmoQrUrl: data.paymentVenmoQrUrl || null");
    expect(wizard).toContain("paymentCashappQrUrl: data.paymentCashappQrUrl || null");
    expect(wizard).toContain("paymentPaypalQrUrl: data.paymentPaypalQrUrl || null");
    expect(registry).toContain("paymentVenmoQrUrl?: string | null;");
    expect(registry).toContain("paymentCashappQrUrl?: string | null;");
    expect(registry).toContain("paymentPaypalQrUrl?: string | null;");
  });
});
