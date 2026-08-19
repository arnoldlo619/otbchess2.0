import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasValidPaymentLinks, validatePaymentLink, validatePaymentLinks } from "../client/src/lib/paymentLinks";

const root = resolve(__dirname, "..");
const wizard = readFileSync(resolve(root, "client/src/components/TournamentWizard.tsx"), "utf8");
const join = readFileSync(resolve(root, "client/src/pages/Join.tsx"), "utf8");
const playerPayment = readFileSync(resolve(root, "client/src/components/tournament/PlayerPaymentMethods.tsx"), "utf8");

describe("tournament payment validation and registration preview", () => {
  it("accepts supported secure payment URLs", () => {
    expect(validatePaymentLink("venmo", "https://venmo.com/chessotb")).toBeUndefined();
    expect(validatePaymentLink("cashapp", "https://cash.app/$chessotb")).toBeUndefined();
    expect(validatePaymentLink("paypal", "https://paypal.me/chessotb")).toBeUndefined();
  });

  it("rejects handles, insecure protocols, unsupported hosts, and incomplete Cash App paths", () => {
    expect(validatePaymentLink("venmo", "@chessotb")).toContain("complete secure URL");
    expect(validatePaymentLink("paypal", "http://paypal.me/chessotb")).toContain("not supported");
    expect(validatePaymentLink("venmo", "https://example.com/pay")).toContain("not supported");
    expect(validatePaymentLink("cashapp", "https://cash.app/chessotb")).toContain("cashtag");
  });

  it("keeps empty optional payment fields valid but blocks continuation for invalid configured methods", () => {
    expect(hasValidPaymentLinks({})).toBe(true);
    expect(validatePaymentLinks({ paymentPaypal: "paypal.me/chessotb" }).paypal).toBeTruthy();
    expect(hasValidPaymentLinks({ paymentPaypal: "paypal.me/chessotb" })).toBe(false);
  });

  it("allows disabled methods to retain their values without blocking configuration", () => {
    const disabledVenmo = { paymentVenmo: "@legacy-handle", paymentVenmoEnabled: false };
    expect(validatePaymentLinks(disabledVenmo).venmo).toBeUndefined();
    expect(hasValidPaymentLinks(disabledVenmo)).toBe(true);
  });

  it("gates the configuration flow and renders validation feedback in both payment sections", () => {
    expect(wizard).toContain("hasValidPaymentLinks(data)");
    expect(wizard.match(/PaymentLinkValidationNotice data=\{data\}/g)).toHaveLength(2);
    expect(wizard.match(/PlayerPaymentMethods payments=\{data\} preview/g)).toHaveLength(2);
    expect(wizard).toContain("Fix payment links before continuing");
  });

  it("reuses the player payment surface on registration with safe external-link behavior", () => {
    expect(join).toContain("<PlayerPaymentMethods payments={resolvedConfig ?? {}} isDark={isDark} />");
    expect(playerPayment).toContain("target=\"_blank\"");
    expect(playerPayment).toContain("rel=\"noreferrer\"");
    expect(playerPayment).toContain("Player registration preview");
    expect(playerPayment).toContain("payment QR code");
  });

  it("provides independent accessible toggles and persists enabled states for all payment methods", () => {
    expect(wizard.match(/<PaymentMethodToggle method=/g)).toHaveLength(6);
    expect(wizard).toContain("role=\"switch\"");
    expect(wizard).toContain("aria-checked={enabled}");
    expect(wizard).toContain("paymentVenmoEnabled: data.paymentVenmoEnabled");
    expect(wizard).toContain("paymentCashappEnabled: data.paymentCashappEnabled");
    expect(wizard).toContain("paymentPaypalEnabled: data.paymentPaypalEnabled");
    expect(playerPayment).toContain("values.paymentVenmoEnabled === false");
    expect(playerPayment).toContain("values.paymentCashappEnabled === false");
    expect(playerPayment).toContain("values.paymentPaypalEnabled === false");
  });
});
