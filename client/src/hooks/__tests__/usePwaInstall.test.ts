/**
 * Tests for usePwaInstall hook logic helpers
 * (isDismissed, dismiss, clearDismiss, isInstalled, markInstalled, isIosSafari, isStandalone)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isDismissed,
  dismiss,
  clearDismiss,
  isInstalled,
  markInstalled,
  isIosSafari,
  isStandalone,
  DISMISS_DAYS,
} from "../usePwaInstall";

// ─── isDismissed / dismiss / clearDismiss ─────────────────────────────────────

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
    localStorage.setItem("otb_install_dismissed_until", String(Date.now() - 1));
    expect(isDismissed()).toBe(false);
  });

  it(`stores a timestamp ~${DISMISS_DAYS} days in the future`, () => {
    dismiss();
    const until = parseInt(localStorage.getItem("otb_install_dismissed_until")!, 10);
    const expectedMin = Date.now() + (DISMISS_DAYS - 1) * 24 * 60 * 60 * 1000;
    const expectedMax = Date.now() + (DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(until).toBeGreaterThan(expectedMin);
    expect(until).toBeLessThan(expectedMax);
  });

  it("DISMISS_DAYS is 7 (not 14 — reduced for better re-engagement)", () => {
    expect(DISMISS_DAYS).toBe(7);
  });
});

// ─── isInstalled / markInstalled ─────────────────────────────────────────────

describe("isInstalled / markInstalled", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns false when the app has never been installed", () => {
    expect(isInstalled()).toBe(false);
  });

  it("returns true after markInstalled()", () => {
    markInstalled();
    expect(isInstalled()).toBe(true);
  });

  it("clears any dismissal cooldown when marking as installed", () => {
    dismiss(); // set a cooldown first
    expect(isDismissed()).toBe(true);
    markInstalled();
    // dismissal key should be cleared
    expect(isDismissed()).toBe(false);
  });

  it("persists across simulated page reloads (same localStorage)", () => {
    markInstalled();
    // Simulate reading from a fresh hook call
    expect(isInstalled()).toBe(true);
  });
});

// ─── isIosSafari ─────────────────────────────────────────────────────────────

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

  it("detects iPod Safari", () => {
    const ua =
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
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

  it("returns false for Samsung Internet on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/19.0 Chrome/102.0.5005.125 Mobile Safari/537.36";
    expect(isIosSafari(ua)).toBe(false);
  });
});

// ─── isStandalone ─────────────────────────────────────────────────────────────

describe("isStandalone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false in a normal browser window (matchMedia not standalone)", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    // navigator.standalone is undefined in jsdom
    expect(isStandalone()).toBe(false);
  });

  it("returns true when display-mode is standalone (Android PWA)", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(isStandalone()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS PWA)", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    expect(isStandalone()).toBe(true);
  });
});

// ─── Integration: install flow state machine ──────────────────────────────────

describe("Install flow state machine", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("banner should NOT show when app is already installed", () => {
    markInstalled();
    // isInstalled() returns true → hook would return showBanner: false
    expect(isInstalled()).toBe(true);
    expect(isDismissed()).toBe(false); // install clears dismissal
  });

  it("banner should NOT show when recently dismissed", () => {
    dismiss();
    expect(isDismissed()).toBe(true);
    expect(isInstalled()).toBe(false);
  });

  it("banner CAN show when neither installed nor dismissed", () => {
    expect(isInstalled()).toBe(false);
    expect(isDismissed()).toBe(false);
    // Hook would proceed to check platform and beforeinstallprompt
  });

  it("dismissing after install does not re-enable the banner", () => {
    markInstalled();
    dismiss(); // user somehow dismisses again
    // isInstalled() still true — banner stays hidden
    expect(isInstalled()).toBe(true);
  });

  it("clearing dismissal does not undo an install", () => {
    markInstalled();
    clearDismiss();
    expect(isInstalled()).toBe(true); // still installed
  });
});
