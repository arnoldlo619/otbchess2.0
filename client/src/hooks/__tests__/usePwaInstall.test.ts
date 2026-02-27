/**
 * Tests for usePwaInstall hook logic helpers
 * (isDismissed, dismiss, clearDismiss, isIosSafari)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Helpers extracted for testability ────────────────────────────────────────
const DISMISS_KEY = "otb_install_dismissed_until";
const DISMISS_DAYS = 14;

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

function dismiss(): void {
  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(DISMISS_KEY, String(until));
}

function clearDismiss(): void {
  localStorage.removeItem(DISMISS_KEY);
}

function isIosSafari(ua: string): boolean {
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return isIos && isSafari;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("isDismissed / dismiss / clearDismiss", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns false when no key is set", () => {
    expect(isDismissed()).toBe(false);
  });

  it("returns true immediately after dismiss()", () => {
    dismiss();
    expect(isDismissed()).toBe(true);
  });

  it("returns false after clearDismiss()", () => {
    dismiss();
    clearDismiss();
    expect(isDismissed()).toBe(false);
  });

  it("returns false when the stored timestamp is in the past", () => {
    // Simulate an expired dismissal (1 ms in the past)
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 1));
    expect(isDismissed()).toBe(false);
  });

  it("stores a timestamp ~14 days in the future", () => {
    dismiss();
    const until = parseInt(localStorage.getItem(DISMISS_KEY)!, 10);
    const expectedMin = Date.now() + (DISMISS_DAYS - 1) * 24 * 60 * 60 * 1000;
    const expectedMax = Date.now() + (DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(until).toBeGreaterThan(expectedMin);
    expect(until).toBeLessThan(expectedMax);
  });
});

describe("isIosSafari", () => {
  it("detects iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(ua)).toBe(true);
  });

  it("detects iPad Safari", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(ua)).toBe(true);
  });

  it("returns false for Chrome on iOS (CriOS)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/116.0.5845.103 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(ua)).toBe(false);
  });

  it("returns false for Firefox on iOS (FxiOS)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/116.0 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(ua)).toBe(false);
  });

  it("returns false for Android Chrome", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
    expect(isIosSafari(ua)).toBe(false);
  });

  it("returns false for desktop Chrome", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";
    expect(isIosSafari(ua)).toBe(false);
  });

  it("returns false for desktop Safari", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15";
    expect(isIosSafari(ua)).toBe(false);
  });
});
