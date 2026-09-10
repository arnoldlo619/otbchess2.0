import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_PAYMENT_METHOD_ORDER, hasValidPaymentLinks, normalizePaymentMethodOrder, validatePaymentLink, validatePaymentLinks } from "../client/src/lib/paymentLinks";
import type { TournamentConfig } from "../client/src/lib/tournamentRegistry";

const root = resolve(__dirname, "..");
const wizard = readFileSync(resolve(root, "client/src/components/TournamentWizard.tsx"), "utf8");
const settings = readFileSync(resolve(root, "client/src/components/TournamentSettingsPanel.tsx"), "utf8");
const paymentSettings = readFileSync(resolve(root, "client/src/components/tournament/TournamentPaymentSettings.tsx"), "utf8");
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

  it("keeps creation unblocked and validates configured payment links in Director Settings", () => {
    expect(wizard).not.toContain("hasValidPaymentLinks(data)");
    expect(settings).toContain("if (!hasValidPaymentLinks(form))");
    expect(paymentSettings).toContain("Fix payment links before saving");
    expect(paymentSettings).toContain("PlayerPaymentMethods payments={value} preview");
  });

  it("reuses the player payment surface on registration with safe external-link behavior", () => {
    expect(join).toContain("<PlayerPaymentMethods payments={resolvedConfig ?? {}} isDark={isDark} />");
    expect(playerPayment).toContain("target=\"_blank\"");
    expect(playerPayment).toContain("rel=\"noreferrer\"");
    expect(playerPayment).toContain("Player registration preview");
    expect(playerPayment).toContain("payment QR code");
  });

  it("provides independent accessible toggles and persists enabled states for all payment methods", () => {
    expect(paymentSettings).toContain("role=\"switch\"");
    expect(paymentSettings).toContain("aria-checked={enabled}");
    expect(settings).toContain("paymentVenmoEnabled: form.paymentVenmoEnabled");
    expect(settings).toContain("paymentCashappEnabled: form.paymentCashappEnabled");
    expect(settings).toContain("paymentPaypalEnabled: form.paymentPaypalEnabled");
    expect(playerPayment).toContain("values.paymentVenmoEnabled === false");
    expect(playerPayment).toContain("values.paymentCashappEnabled === false");
    expect(playerPayment).toContain("values.paymentPaypalEnabled === false");
  });

  it("normalizes a persisted payment order and retains a safe default for legacy tournaments", () => {
    expect(normalizePaymentMethodOrder(["paypal", "venmo", "cashapp"])).toEqual(["paypal", "venmo", "cashapp"]);
    expect(normalizePaymentMethodOrder(["paypal", "paypal"] as never)).toEqual(["paypal", "venmo", "cashapp"]);
    expect(normalizePaymentMethodOrder()).toEqual(DEFAULT_PAYMENT_METHOD_ORDER);
  });

  it("persists host payment instructions and a sortable payment method order", () => {
    const config: Pick<TournamentConfig, "paymentInstructions" | "paymentMethodOrder"> = {
      paymentInstructions: "Include your USCF ID in the payment note.",
      paymentMethodOrder: ["cashapp", "paypal", "venmo"],
    };
    expect(config.paymentInstructions).toContain("USCF ID");
    expect(config.paymentMethodOrder?.[0]).toBe("cashapp");
    expect(paymentSettings).toContain("DndContext");
    expect(paymentSettings).toContain("sortableKeyboardCoordinates");
    expect(paymentSettings).toContain("paymentMethodOrder: arrayMove(order, from, to)");
    expect(paymentSettings).toContain("Payment instructions");
    expect(paymentSettings).toContain("Include your USCF ID");
  });

  it("renders the registration payment methods in host order with their instruction note", () => {
    expect(playerPayment).toContain("normalizePaymentMethodOrder(values.paymentMethodOrder)");
    expect(playerPayment).toContain("paymentInstructions?.trim()");
    expect(playerPayment).toContain("Host note:");
  });
});
