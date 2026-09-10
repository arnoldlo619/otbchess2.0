import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const wizard = readFileSync(resolve(root, "client/src/components/TournamentWizard.tsx"), "utf8");
const registry = readFileSync(resolve(root, "client/src/lib/tournamentRegistry.ts"), "utf8");
const settings = readFileSync(resolve(root, "client/src/components/TournamentSettingsPanel.tsx"), "utf8");
const paymentSettings = readFileSync(resolve(root, "client/src/components/tournament/TournamentPaymentSettings.tsx"), "utf8");

describe("tournament payment-link configuration", () => {
  it("keeps event-level payment fields in persisted tournament configuration", () => {
    expect(registry).toContain("paymentVenmo?: string | null;");
    expect(registry).toContain("paymentCashapp?: string | null;");
    expect(registry).toContain("paymentPaypal?: string | null;");
  });

  it("removes payment editing and payment validation from the creation wizard", () => {
    expect(wizard).not.toContain("Optional entry payment links");
    expect(wizard).not.toContain("Player payment order and instructions");
    expect(wizard).not.toContain("PaymentConfiguration");
    expect(wizard).not.toContain("hasValidPaymentLinks(data)");
  });

  it("renders payment configuration in Director Settings with a player preview", () => {
    expect(settings).toContain("<TournamentPaymentSettings value={form} onChange={patch}");
    expect(paymentSettings).toContain("Player payments");
    expect(paymentSettings).toContain("Player registration preview");
    expect(paymentSettings).toContain("PlayerPaymentMethods payments={value} preview");
  });

  it("persists payment choices through the Director Settings save path", () => {
    expect(settings).toContain("paymentVenmo: form.paymentVenmo.trim() || null");
    expect(settings).toContain("paymentCashapp: form.paymentCashapp.trim() || null");
    expect(settings).toContain("paymentPaypal: form.paymentPaypal.trim() || null");
    expect(settings).toContain("paymentMethodOrder: normalizePaymentMethodOrder(form.paymentMethodOrder)");
  });

  it("retains individual QR image fields and safe reusable upload controls", () => {
    expect(paymentSettings).toContain("paymentVenmoQrUrl: string;");
    expect(paymentSettings).toContain("paymentCashappQrUrl: string;");
    expect(paymentSettings).toContain("paymentPaypalQrUrl: string;");
    expect(paymentSettings).toContain("function PaymentQrUpload");
    expect(paymentSettings).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(paymentSettings).toContain("QR image must be 1.5 MB or smaller.");
    expect(paymentSettings).toContain("payment QR preview");
    expect(paymentSettings).toContain("Remove ${method} QR image");
  });

  it("persists QR image values through Director Settings", () => {
    expect(settings).toContain("paymentVenmoQrUrl: form.paymentVenmoQrUrl || null");
    expect(settings).toContain("paymentCashappQrUrl: form.paymentCashappQrUrl || null");
    expect(settings).toContain("paymentPaypalQrUrl: form.paymentPaypalQrUrl || null");
    expect(registry).toContain("paymentVenmoQrUrl?: string | null;");
    expect(registry).toContain("paymentCashappQrUrl?: string | null;");
    expect(registry).toContain("paymentPaypalQrUrl?: string | null;");
  });
});
