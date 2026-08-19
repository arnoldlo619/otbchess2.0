/**
 * club-payment-links.test.ts — Regression coverage for the personal payment-link feature.
 *
 * Validates:
 * 1. Payment-link schema columns exist in the clubs table definition
 * 2. Club PATCH API allowlist includes all payment-link fields
 * 3. dbRowToClub mapper returns payment-link fields
 * 4. Club interface exposes payment-link fields
 * 5. MeetupEventPage renders the payment prompt when club has links configured
 * 6. ClubDashboard payments sub-tab has editable payment-link inputs
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");

describe("Club Payment Links — Schema", () => {
  const schema = readFileSync(resolve(root, "shared/schema.ts"), "utf-8");

  it("defines payment_venmo, payment_cashapp, payment_paypal, payment_qr_url, payment_note columns", () => {
    expect(schema).toContain("paymentVenmo");
    expect(schema).toContain("paymentCashapp");
    expect(schema).toContain("paymentPaypal");
    expect(schema).toContain("paymentQrUrl");
    expect(schema).toContain("paymentNote");
  });
});

describe("Club Payment Links — Server API", () => {
  const clubs = readFileSync(resolve(root, "server/clubs.ts"), "utf-8");

  it("PATCH allowlist includes all payment-link fields", () => {
    expect(clubs).toContain('"paymentVenmo"');
    expect(clubs).toContain('"paymentCashapp"');
    expect(clubs).toContain('"paymentPaypal"');
    expect(clubs).toContain('"paymentQrUrl"');
    expect(clubs).toContain('"paymentNote"');
  });

  it("dbRowToClub mapper returns payment-link fields", () => {
    expect(clubs).toContain("paymentVenmo: row.paymentVenmo");
    expect(clubs).toContain("paymentCashapp: row.paymentCashapp");
    expect(clubs).toContain("paymentPaypal: row.paymentPaypal");
    expect(clubs).toContain("paymentQrUrl: row.paymentQrUrl");
    expect(clubs).toContain("paymentNote: row.paymentNote");
  });
});

describe("Club Payment Links — Client Interface", () => {
  const registry = readFileSync(resolve(root, "client/src/lib/clubRegistry.ts"), "utf-8");

  it("Club interface exposes all payment-link fields", () => {
    expect(registry).toContain("paymentVenmo?: string");
    expect(registry).toContain("paymentCashapp?: string");
    expect(registry).toContain("paymentPaypal?: string");
    expect(registry).toContain("paymentQrUrl?: string");
    expect(registry).toContain("paymentNote?: string");
  });
});

describe("Club Payment Links — Event Page Player Prompt", () => {
  const eventPage = readFileSync(resolve(root, "client/src/pages/MeetupEventPage.tsx"), "utf-8");

  it("renders the Pay Entry Fee section when club has payment links", () => {
    expect(eventPage).toContain("Pay Entry Fee");
    expect(eventPage).toContain("club.paymentVenmo");
    expect(eventPage).toContain("club.paymentCashapp");
    expect(eventPage).toContain("club.paymentPaypal");
    expect(eventPage).toContain("club.paymentQrUrl");
  });

  it("shows the payment note to players", () => {
    expect(eventPage).toContain("club.paymentNote");
  });

  it("links open in new tab with noopener noreferrer", () => {
    const venmoLink = eventPage.includes('target="_blank"') && eventPage.includes('rel="noopener noreferrer"');
    expect(venmoLink).toBe(true);
    // Each payment link (Venmo, Cash App, PayPal) uses target="_blank" + rel="noopener noreferrer"
    const occurrences = (eventPage.match(/rel="noopener noreferrer"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });
});

describe("Club Payment Links — Owner Configuration", () => {
  const dashboard = readFileSync(resolve(root, "client/src/pages/ClubDashboard.tsx"), "utf-8");

  it("payments sub-tab has editable inputs for Venmo, Cash App, PayPal, QR, and note", () => {
    expect(dashboard).toContain("@your-venmo-handle");
    expect(dashboard).toContain("$your-cashtag");
    expect(dashboard).toContain("paypal.me/yourname");
    expect(dashboard).toContain("Payment QR Code");
    expect(dashboard).toContain("Payment Instructions");
  });

  it("persists changes via updateClub on blur", () => {
    const venmoUpdate = dashboard.includes("updateClub(club.id, { paymentVenmo:");
    const cashappUpdate = dashboard.includes("updateClub(club.id, { paymentCashapp:");
    const paypalUpdate = dashboard.includes("updateClub(club.id, { paymentPaypal:");
    expect(venmoUpdate).toBe(true);
    expect(cashappUpdate).toBe(true);
    expect(paypalUpdate).toBe(true);
  });
});
