/**
 * Tests for Score Distribution bar animation logic.
 *
 * The PerformanceSection component uses an IntersectionObserver to set a
 * `visible` flag. When visible=false bars render at 0% width; when visible=true
 * bars render at their computed percentage of maxPoints.
 *
 * These tests cover the pure helper calculations so the animation logic is
 * independently verifiable without a DOM/browser environment.
 */

import { describe, it, expect } from "vitest";

// ── Helpers extracted from PerformanceSection ──────────────────────────────

/** Compute bar width percentage for a player given their points and the max. */
function barPct(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return (points / maxPoints) * 100;
}

/** Compute the CSS transition delay string for a given row index. */
function rowDelay(idx: number): string {
  return `${idx * 60}ms`;
}

/** Compute the animated width: 0% when not visible, pct% when visible. */
function animatedWidth(pct: number, visible: boolean): string {
  return visible ? `${pct}%` : "0%";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("barPct", () => {
  it("returns 100% for the leader (points === maxPoints)", () => {
    expect(barPct(4, 4)).toBe(100);
  });

  it("returns 50% for a player with half the max points", () => {
    expect(barPct(2, 4)).toBe(50);
  });

  it("returns 75% for 3 out of 4 points", () => {
    expect(barPct(3, 4)).toBe(75);
  });

  it("handles half-point scores correctly", () => {
    expect(barPct(2.5, 4)).toBe(62.5);
  });

  it("returns 0 when maxPoints is 0 (guard against division by zero)", () => {
    expect(barPct(0, 0)).toBe(0);
  });

  it("returns 0 when player has 0 points", () => {
    expect(barPct(0, 4)).toBe(0);
  });
});

describe("rowDelay", () => {
  it("first row (idx=0) has no delay", () => {
    expect(rowDelay(0)).toBe("0ms");
  });

  it("second row (idx=1) is delayed by 60ms", () => {
    expect(rowDelay(1)).toBe("60ms");
  });

  it("tenth row (idx=9) is delayed by 540ms", () => {
    expect(rowDelay(9)).toBe("540ms");
  });

  it("stagger increases linearly", () => {
    const delays = [0, 1, 2, 3, 4].map(rowDelay);
    expect(delays).toEqual(["0ms", "60ms", "120ms", "180ms", "240ms"]);
  });
});

describe("animatedWidth", () => {
  it("returns '0%' before section is visible", () => {
    expect(animatedWidth(75, false)).toBe("0%");
  });

  it("returns the real percentage once visible", () => {
    expect(animatedWidth(75, true)).toBe("75%");
  });

  it("returns '100%' for the leader once visible", () => {
    expect(animatedWidth(100, true)).toBe("100%");
  });

  it("returns '0%' for a 0-point player even when visible", () => {
    expect(animatedWidth(0, true)).toBe("0%");
  });

  it("handles fractional percentages", () => {
    expect(animatedWidth(62.5, true)).toBe("62.5%");
  });
});

describe("full animation scenario", () => {
  const standings = [
    { name: "Alice", points: 4 },
    { name: "Bob",   points: 3 },
    { name: "Carol", points: 2.5 },
    { name: "Dave",  points: 1 },
  ];
  const maxPoints = Math.max(...standings.map((s) => s.points));

  it("computes correct percentages for all players", () => {
    const pcts = standings.map((s) => barPct(s.points, maxPoints));
    expect(pcts).toEqual([100, 75, 62.5, 25]);
  });

  it("all bars start at 0% before intersection fires", () => {
    const widths = standings.map((s) => animatedWidth(barPct(s.points, maxPoints), false));
    expect(widths).toEqual(["0%", "0%", "0%", "0%"]);
  });

  it("all bars reach their target width after intersection fires", () => {
    const widths = standings.map((s) => animatedWidth(barPct(s.points, maxPoints), true));
    expect(widths).toEqual(["100%", "75%", "62.5%", "25%"]);
  });

  it("stagger delays are unique and increasing per row", () => {
    const delays = standings.map((_, idx) => rowDelay(idx));
    expect(delays).toEqual(["0ms", "60ms", "120ms", "180ms"]);
    // Verify they are strictly increasing
    for (let i = 1; i < delays.length; i++) {
      const prev = parseInt(delays[i - 1]);
      const curr = parseInt(delays[i]);
      expect(curr).toBeGreaterThan(prev);
    }
  });
});
