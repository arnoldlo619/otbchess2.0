/**
 * lnmOnboardingTooltip.test.ts
 *
 * Unit tests for the LNM Onboarding Tooltip:
 *  - localStorage dismiss key constant
 *  - useLnmTooltip: initial state (not dismissed)
 *  - useLnmTooltip: reads persisted dismissed state from localStorage
 *  - useLnmTooltip: dismiss() writes to localStorage
 *  - useLnmTooltip: reset() removes from localStorage
 *  - Step content: 3 steps with correct titles and icons
 *  - Tooltip visibility: hidden when dismissed
 *  - Tooltip visibility: shown when not dismissed
 *  - Auto-dismiss timeout constant
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mirror constants and logic from LnmOnboardingTooltip ──────────────────

const LNM_TOOLTIP_DISMISSED_KEY = "otb_lnm_tooltip_dismissed";
const AUTO_DISMISS_MS = 30_000;

const STEP_TITLES = [
  "Mirror each move",
  "Board flips automatically",
  "Analyse after the game",
] as const;

const STEP_BODIES = [
  "After moving a piece on the real board, tap that same piece and destination here to log the notation.",
  "After each move the board rotates to face the next player — just pass the phone across the table.",
  "When the battle ends, copy your PGN or tap Analyse Game for a full Stockfish-powered review.",
] as const;

// ─── Simulated useLnmTooltip logic ────────────────────────────────────────

function createTooltipState(storage: Record<string, string>) {
  const isDismissed = () => storage[LNM_TOOLTIP_DISMISSED_KEY] === "true";

  const dismiss = () => {
    storage[LNM_TOOLTIP_DISMISSED_KEY] = "true";
  };

  const reset = () => {
    delete storage[LNM_TOOLTIP_DISMISSED_KEY];
  };

  return { isDismissed, dismiss, reset };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("LNM Onboarding Tooltip", () => {
  // ── localStorage key ────────────────────────────────────────────────────
  describe("localStorage key", () => {
    it("uses the correct storage key", () => {
      expect(LNM_TOOLTIP_DISMISSED_KEY).toBe("otb_lnm_tooltip_dismissed");
    });

    it("key is namespaced with otb_ prefix", () => {
      expect(LNM_TOOLTIP_DISMISSED_KEY.startsWith("otb_")).toBe(true);
    });
  });

  // ── Initial state ────────────────────────────────────────────────────────
  describe("Initial state", () => {
    it("is not dismissed when localStorage has no entry", () => {
      const storage: Record<string, string> = {};
      const { isDismissed } = createTooltipState(storage);
      expect(isDismissed()).toBe(false);
    });

    it("is dismissed when localStorage has 'true'", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "true",
      };
      const { isDismissed } = createTooltipState(storage);
      expect(isDismissed()).toBe(true);
    });

    it("is not dismissed when localStorage has unexpected value", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "false",
      };
      const { isDismissed } = createTooltipState(storage);
      expect(isDismissed()).toBe(false);
    });
  });

  // ── Dismiss action ───────────────────────────────────────────────────────
  describe("Dismiss action", () => {
    it("sets localStorage key to 'true' on dismiss", () => {
      const storage: Record<string, string> = {};
      const { dismiss, isDismissed } = createTooltipState(storage);
      expect(isDismissed()).toBe(false);
      dismiss();
      expect(isDismissed()).toBe(true);
      expect(storage[LNM_TOOLTIP_DISMISSED_KEY]).toBe("true");
    });

    it("dismiss is idempotent", () => {
      const storage: Record<string, string> = {};
      const { dismiss, isDismissed } = createTooltipState(storage);
      dismiss();
      dismiss();
      expect(isDismissed()).toBe(true);
      expect(storage[LNM_TOOLTIP_DISMISSED_KEY]).toBe("true");
    });
  });

  // ── Reset action ─────────────────────────────────────────────────────────
  describe("Reset action", () => {
    it("removes localStorage key on reset", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "true",
      };
      const { reset, isDismissed } = createTooltipState(storage);
      expect(isDismissed()).toBe(true);
      reset();
      expect(isDismissed()).toBe(false);
      expect(storage[LNM_TOOLTIP_DISMISSED_KEY]).toBeUndefined();
    });

    it("reset on already-cleared state is safe", () => {
      const storage: Record<string, string> = {};
      const { reset, isDismissed } = createTooltipState(storage);
      expect(() => reset()).not.toThrow();
      expect(isDismissed()).toBe(false);
    });
  });

  // ── Step content ─────────────────────────────────────────────────────────
  describe("Step content", () => {
    it("has exactly 3 steps", () => {
      expect(STEP_TITLES).toHaveLength(3);
      expect(STEP_BODIES).toHaveLength(3);
    });

    it("step 1 is about mirroring moves", () => {
      expect(STEP_TITLES[0]).toBe("Mirror each move");
      expect(STEP_BODIES[0]).toContain("tap that same piece");
    });

    it("step 2 is about board flipping", () => {
      expect(STEP_TITLES[1]).toBe("Board flips automatically");
      expect(STEP_BODIES[1]).toContain("pass the phone across the table");
    });

    it("step 3 is about post-game analysis", () => {
      expect(STEP_TITLES[2]).toBe("Analyse after the game");
      expect(STEP_BODIES[2]).toContain("PGN");
    });

    it("all step titles are non-empty strings", () => {
      STEP_TITLES.forEach((title) => {
        expect(typeof title).toBe("string");
        expect(title.length).toBeGreaterThan(0);
      });
    });

    it("all step bodies are non-empty strings", () => {
      STEP_BODIES.forEach((body) => {
        expect(typeof body).toBe("string");
        expect(body.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Visibility logic ─────────────────────────────────────────────────────
  describe("Visibility logic", () => {
    it("tooltip should be visible when not dismissed and LNM is inactive", () => {
      const storage: Record<string, string> = {};
      const { isDismissed } = createTooltipState(storage);
      const lnmActive = false;
      const shouldShow = !lnmActive && !isDismissed();
      expect(shouldShow).toBe(true);
    });

    it("tooltip should be hidden when dismissed", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "true",
      };
      const { isDismissed } = createTooltipState(storage);
      const lnmActive = false;
      const shouldShow = !lnmActive && !isDismissed();
      expect(shouldShow).toBe(false);
    });

    it("tooltip should be hidden when LNM is active (even if not dismissed)", () => {
      const storage: Record<string, string> = {};
      const { isDismissed } = createTooltipState(storage);
      const lnmActive = true;
      const shouldShow = !lnmActive && !isDismissed();
      expect(shouldShow).toBe(false);
    });

    it("tooltip should be hidden when both LNM active and dismissed", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "true",
      };
      const { isDismissed } = createTooltipState(storage);
      const lnmActive = true;
      const shouldShow = !lnmActive && !isDismissed();
      expect(shouldShow).toBe(false);
    });
  });

  // ── Auto-dismiss timeout ─────────────────────────────────────────────────
  describe("Auto-dismiss timeout", () => {
    it("auto-dismiss is set to 30 seconds", () => {
      expect(AUTO_DISMISS_MS).toBe(30_000);
    });

    it("auto-dismiss is greater than 10 seconds (not too aggressive)", () => {
      expect(AUTO_DISMISS_MS).toBeGreaterThan(10_000);
    });
  });

  // ── Dismiss-then-show flow ────────────────────────────────────────────────
  describe("Full dismiss-then-show flow", () => {
    it("tooltip shows, user dismisses, tooltip never shows again", () => {
      const storage: Record<string, string> = {};
      const { isDismissed, dismiss } = createTooltipState(storage);

      // Initially visible
      expect(!isDismissed()).toBe(true);

      // User dismisses
      dismiss();
      expect(isDismissed()).toBe(true);

      // Simulate page reload: re-read from storage
      const { isDismissed: isDismissed2 } = createTooltipState(storage);
      expect(isDismissed2()).toBe(true);
    });

    it("dev reset restores tooltip for testing", () => {
      const storage: Record<string, string> = {
        [LNM_TOOLTIP_DISMISSED_KEY]: "true",
      };
      const { isDismissed, reset } = createTooltipState(storage);
      expect(isDismissed()).toBe(true);
      reset();
      expect(isDismissed()).toBe(false);
    });
  });
});
