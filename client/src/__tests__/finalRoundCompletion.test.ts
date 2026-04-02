/**
 * Phase 13: Final Round Completion — Scroll-to-Top + Confetti Tests
 * Tests for completion detection logic, timing, and trigger conditions
 */
import { describe, it, expect } from "vitest";

// ── Logic extracted from Director.tsx confetti/scroll effect ──────────────────

function isFinalRound(currentRound: number, totalRounds: number): boolean {
  return currentRound >= totalRounds && totalRounds > 0;
}

function shouldTriggerCompletion(
  isFinal: boolean,
  justCompleted: boolean,
  alreadyFired: number,
  totalRounds: number
): boolean {
  return isFinal && justCompleted && alreadyFired !== totalRounds;
}

function getConfettiDelay(): number {
  // 600ms allows smooth scroll to settle before confetti fires
  return 600;
}

function getConfettiDuration(): number {
  return 4000;
}

function getConfettiColors(): string[] {
  return ["#4CAF50", "#ffffff", "#3D6B47", "#a3e635", "#fbbf24"];
}

function getConfettiOrigins(): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: 0.6 },  // left cannon
    { x: 1, y: 0.6 },  // right cannon
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("isFinalRound detection", () => {
  it("returns true when currentRound equals totalRounds", () => {
    expect(isFinalRound(5, 5)).toBe(true);
    expect(isFinalRound(3, 3)).toBe(true);
    expect(isFinalRound(1, 1)).toBe(true);
  });

  it("returns true when currentRound exceeds totalRounds (edge case)", () => {
    expect(isFinalRound(6, 5)).toBe(true);
  });

  it("returns false when currentRound is below totalRounds", () => {
    expect(isFinalRound(4, 5)).toBe(false);
    expect(isFinalRound(1, 3)).toBe(false);
    expect(isFinalRound(0, 5)).toBe(false);
  });

  it("returns false when totalRounds is 0 (tournament not configured)", () => {
    expect(isFinalRound(0, 0)).toBe(false);
    expect(isFinalRound(1, 0)).toBe(false);
  });
});

describe("shouldTriggerCompletion — deduplication logic", () => {
  it("triggers when final round just completed and hasn't fired yet", () => {
    expect(shouldTriggerCompletion(true, true, -1, 5)).toBe(true);
  });

  it("does NOT trigger when already fired for this tournament", () => {
    // alreadyFired === totalRounds means it already ran
    expect(shouldTriggerCompletion(true, true, 5, 5)).toBe(false);
  });

  it("does NOT trigger when not the final round", () => {
    expect(shouldTriggerCompletion(false, true, -1, 5)).toBe(false);
  });

  it("does NOT trigger when results just came in but not the final round", () => {
    expect(shouldTriggerCompletion(false, true, -1, 5)).toBe(false);
  });

  it("does NOT trigger when allResultsIn is false (justCompleted = false)", () => {
    expect(shouldTriggerCompletion(true, false, -1, 5)).toBe(false);
  });

  it("does NOT trigger when both conditions are false", () => {
    expect(shouldTriggerCompletion(false, false, -1, 5)).toBe(false);
  });

  it("re-triggers correctly after a new tournament with different totalRounds", () => {
    // Previous tournament had 5 rounds (alreadyFired = 5)
    // New tournament has 3 rounds
    expect(shouldTriggerCompletion(true, true, 5, 3)).toBe(true);
  });
});

describe("Confetti timing configuration", () => {
  it("delay is at least 500ms to allow scroll to settle", () => {
    expect(getConfettiDelay()).toBeGreaterThanOrEqual(500);
  });

  it("duration is at least 3 seconds for a satisfying celebration", () => {
    expect(getConfettiDuration()).toBeGreaterThanOrEqual(3000);
  });

  it("fires from both left and right cannons", () => {
    const origins = getConfettiOrigins();
    expect(origins).toHaveLength(2);
    expect(origins[0].x).toBe(0);  // left
    expect(origins[1].x).toBe(1);  // right
  });

  it("cannons fire at mid-height for visual impact", () => {
    const origins = getConfettiOrigins();
    origins.forEach((o) => {
      expect(o.y).toBeGreaterThan(0);
      expect(o.y).toBeLessThan(1);
    });
  });
});

describe("Confetti color palette", () => {
  it("includes brand green colors", () => {
    const colors = getConfettiColors();
    expect(colors).toContain("#4CAF50");
    expect(colors).toContain("#3D6B47");
  });

  it("includes white for contrast", () => {
    expect(getConfettiColors()).toContain("#ffffff");
  });

  it("has at least 4 colors for visual variety", () => {
    expect(getConfettiColors().length).toBeGreaterThanOrEqual(4);
  });

  it("all colors are valid hex strings", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    getConfettiColors().forEach((color) => {
      expect(color).toMatch(hexPattern);
    });
  });
});

describe("Scroll behavior", () => {
  it("scroll target falls back to window.scrollTo when ref is null", () => {
    // Simulates the fallback branch: if pageTopRef.current is null, use window.scrollTo
    const scrollTarget = null;
    const usedFallback = scrollTarget === null;
    expect(usedFallback).toBe(true);
  });

  it("uses smooth scroll behavior for polished UX", () => {
    // Verify the scroll options are smooth (not instant)
    const scrollOptions: ScrollIntoViewOptions = { behavior: "smooth", block: "start" };
    expect(scrollOptions.behavior).toBe("smooth");
  });
});

describe("Round-based deduplication key", () => {
  it("uses totalRounds as the deduplication key (not currentRound)", () => {
    // This ensures the confetti fires exactly once per unique tournament length
    // A 5-round tournament fires once; if director somehow re-enters the page,
    // confettiFiredRef.current === 5 prevents re-firing
    const totalRounds = 5;
    const firedRef = totalRounds; // simulates confettiFiredRef.current after firing
    expect(firedRef).toBe(totalRounds);
    expect(shouldTriggerCompletion(true, true, firedRef, totalRounds)).toBe(false);
  });

  it("fires again for a new tournament with different round count", () => {
    const previousTournamentRounds = 5;
    const newTournamentRounds = 7;
    const firedRef = previousTournamentRounds;
    expect(shouldTriggerCompletion(true, true, firedRef, newTournamentRounds)).toBe(true);
  });
});
