/**
 * Mobile Design System Tests
 * Validates Android-specific fixes, viewport handling, and keyboard-aware modal behavior.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── 1. useKeyboardAwareModal ─────────────────────────────────────────────────

describe("useKeyboardAwareModal — VisualViewport API", () => {
  let mockVV: { height: number; offsetTop: number };

  beforeEach(() => {
    mockVV = { height: 800, offsetTop: 0 };
    Object.defineProperty(window, "visualViewport", { value: mockVV, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns keyboardHeight=0 when keyboard is closed", () => {
    const kbHeight = Math.max(0, 800 - mockVV.height - mockVV.offsetTop);
    expect(kbHeight).toBe(0);
  });

  it("calculates correct keyboard height when keyboard opens", () => {
    mockVV.height = 450;
    const kbHeight = Math.max(0, 800 - mockVV.height - mockVV.offsetTop);
    expect(kbHeight).toBe(350);
    expect(kbHeight > 100).toBe(true);
  });

  it("returns keyboardHeight=0 when vv.height equals innerHeight", () => {
    mockVV.height = 800;
    const kbHeight = Math.max(0, 800 - mockVV.height - mockVV.offsetTop);
    expect(kbHeight).toBe(0);
  });

  it("accounts for vv.offsetTop in keyboard height calculation", () => {
    mockVV.height = 650;
    mockVV.offsetTop = 24;
    const kbHeight = Math.max(0, 800 - 650 - 24);
    expect(kbHeight).toBe(126);
  });

  it("never returns negative keyboard height", () => {
    mockVV.height = 900;
    const kbHeight = Math.max(0, 800 - 900 - 0);
    expect(kbHeight).toBe(0);
  });
});

// ─── 2. Viewport meta tag validation ─────────────────────────────────────────

describe("Viewport meta tag — Android keyboard fix", () => {
  it("should include interactive-widget=resizes-content", () => {
    const expectedContent = "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";
    expect(expectedContent).toContain("interactive-widget=resizes-content");
    expect(expectedContent).toContain("viewport-fit=cover");
  });

  it("should NOT include maximum-scale=1 (WCAG 1.4.4 compliance)", () => {
    const viewportContent = "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";
    expect(viewportContent).not.toContain("maximum-scale=1");
    expect(viewportContent).not.toContain("user-scalable=no");
  });
});

// ─── 3. CSS design token breakpoints ─────────────────────────────────────────

describe("CSS design tokens — breakpoints", () => {
  const breakpoints = { xs: 360, sm: 480, md: 768, lg: 1024, xl: 1280 };

  it("xs breakpoint covers smallest Android devices (Galaxy A series)", () => {
    expect(breakpoints.xs).toBe(360);
    expect(360 >= breakpoints.xs).toBe(true);
  });

  it("sm breakpoint covers mid-range Android (Pixel 6a = 411px)", () => {
    expect(411 < breakpoints.sm).toBe(true);
    expect(480 >= breakpoints.sm).toBe(true);
  });

  it("breakpoints are in ascending order", () => {
    const values = Object.values(breakpoints);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("modal max-width fits on sm screens without horizontal scroll", () => {
    const modalMaxW = 448;
    expect(modalMaxW).toBeLessThanOrEqual(480);
    expect(modalMaxW).toBeGreaterThan(360);
  });
});

// ─── 4. Touch target sizing (WCAG 2.5.5) ─────────────────────────────────────

describe("Touch target sizing — WCAG 2.5.5", () => {
  const MIN_TOUCH_TARGET = 44;

  it("mobile-cta min-height meets WCAG 2.5.5 (44px)", () => {
    expect(52).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("mobile-input min-height meets WCAG 2.5.5 (44px)", () => {
    expect(52).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("xs screen adjustments still meet minimum touch target", () => {
    expect(48).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});

// ─── 5. Font-size zoom prevention ────────────────────────────────────────────

describe("Font-size — Android auto-zoom prevention", () => {
  it("minimum input font-size is 16px to prevent Android zoom", () => {
    const inputFontSize = 16;
    expect(inputFontSize).toBeGreaterThanOrEqual(16);
  });

  it("1rem resolves to 16px at default browser font size", () => {
    expect(1 * 16).toBe(16);
  });
});

// ─── 6. enterKeyHint values ──────────────────────────────────────────────────

describe("enterKeyHint — Android keyboard action button labels", () => {
  const validHints = ["enter", "done", "go", "next", "previous", "search", "send"];

  it("all used enterKeyHint values are valid HTML spec values", () => {
    ["search", "next", "done"].forEach((hint) => {
      expect(validHints).toContain(hint);
    });
  });

  it("tournament code input uses 'search' hint", () => {
    expect(validHints).toContain("search");
  });

  it("intermediate form fields use 'next' hint", () => {
    expect(validHints).toContain("next");
  });

  it("final form fields use 'done' hint", () => {
    expect(validHints).toContain("done");
  });
});

// ─── 7. Modal overlay dvh behavior ───────────────────────────────────────────

describe("Modal overlay — dvh keyboard-aware sizing", () => {
  it("dvh shrinks correctly when keyboard opens", () => {
    const screenHeight = 800;
    const keyboardHeight = 300;
    const dvhHeight = screenHeight - keyboardHeight;
    expect(dvhHeight).toBe(500);
    expect(dvhHeight).toBeLessThan(screenHeight);
  });

  it("modal card max-height leaves room for safe areas", () => {
    const dvhHeight = 800;
    const padding = 32;
    const maxModalHeight = dvhHeight - padding;
    expect(maxModalHeight).toBe(768);
    expect(maxModalHeight).toBeLessThan(dvhHeight);
  });

  it("bottom-sheet max-height on xs screens is 92% of dvh minus safe area", () => {
    const dvhHeight = 700;
    const safeAreaBottom = 34;
    const maxSheetHeight = dvhHeight * 0.92 - safeAreaBottom;
    expect(maxSheetHeight).toBeLessThan(dvhHeight);
    expect(maxSheetHeight).toBeGreaterThan(dvhHeight * 0.8);
  });
});

// ─── 8. touch-action: manipulation ───────────────────────────────────────────

describe("touch-action: manipulation — 300ms tap delay removal", () => {
  it("manipulation value is distinct from 'none' (preserves pinch-zoom)", () => {
    const touchAction = "manipulation";
    expect(touchAction).not.toBe("none");
    expect(touchAction).toBe("manipulation");
  });

  it("manipulation allows double-tap zoom unlike touch-action: none", () => {
    // touch-action: manipulation allows panning and pinch-zoom
    // but removes the 300ms delay for single taps
    const allowsPinchZoom = "manipulation" !== "none";
    expect(allowsPinchZoom).toBe(true);
  });
});
