// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentPaymentSettings, type TournamentPaymentSettingsValue } from "../client/src/components/tournament/TournamentPaymentSettings";

const paymentValues: TournamentPaymentSettingsValue = {
  paymentVenmo: "https://venmo.com/chessotb",
  paymentCashapp: "https://cash.app/$chessotb",
  paymentPaypal: "https://paypal.me/chessotb",
  paymentVenmoEnabled: true,
  paymentCashappEnabled: true,
  paymentPaypalEnabled: false,
  paymentVenmoQrUrl: "",
  paymentCashappQrUrl: "",
  paymentPaypalQrUrl: "",
  paymentInstructions: "Include your USCF ID.",
  paymentMethodOrder: ["venmo", "cashapp", "paypal"],
};

describe("TournamentPaymentSettings", () => {
  it("renders editable payment controls, validation feedback, preview, and accessible QR inputs in Director Settings", () => {
    const onChange = vi.fn();
    render(<TournamentPaymentSettings value={{ ...paymentValues, paymentPaypal: "paypal.me/chessotb", paymentPaypalEnabled: true }} onChange={onChange} isDark />);

    expect(screen.getByRole("heading", { name: "Player payments" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Venmo" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Fix payment links before saving");
    expect(screen.getByLabelText("Upload Venmo QR code image")).toBeTruthy();
    expect(screen.getAllByText("Player registration preview").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("switch", { name: "Venmo" }));
    expect(onChange).toHaveBeenCalledWith({ paymentVenmoEnabled: false });
  });
});
