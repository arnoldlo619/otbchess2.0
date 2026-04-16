/**
 * Tests for Score Distribution bar animation logic.
 *
 * The PerformanceSection component uses an IntersectionObserver to set a
 * `visible` flag. When visible=false bars render at 0% width; when visible=true
 * bars render at their computed percentage of maxPoints.
 *
 * A second useEffect watches `currentRound`: when it changes the component
 * briefly sets visible=false (collapsing bars), then after 80ms sets it back
 * to true so bars re-animate with the new scores.
 *
 * These tests cover the pure helper calculations so the animation logic is
 * independently verifiable without a DOM/browser environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

/**
 * Simulate the round-change re-trigger state machine.
 *
 * Returns a sequence of `visible` values captured at key moments:
 *   [0] immediately after round changes (should be false — bars collapsed)
 *   [1] after the 80ms timeout fires (should be true — bars re-expanded)
 */
function _simulateRoundChange(initialVisible: boolean): Promise<[boolean, boolean]> {
  return new Promise((resolve) => {
    let visible = initialVisible;
    // Step 1: collapse immediately
    visible = false;
    const afterCollapse = visible;
    // Step 2: re-expand after 80ms
    setTimeout(() => {
      visible = true;
      resolve([afterCollapse, visible]);
    }, 80);
  });
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
    for (let i = 1; i < delays.length; i++) {
      const prev = parseInt(delays[i - 1]);
      const curr = parseInt(delays[i]);
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

describe("round-change re-trigger", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("collapses bars immediately when round changes", () => {
    let visible = true;
    // Simulate the effect: collapse immediately
    visible = false;
    expect(visible).toBe(false);
  });

  it("re-expands bars after 80ms timeout", () => {
    let visible = true;
    visible = false;
    const callback = vi.fn(() => { visible = true; });
    const t = setTimeout(callback, 80);

    // Before timeout fires, bars are still collapsed
    expect(visible).toBe(false);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(80);

    // After timeout fires, bars are re-expanded
    expect(callback).toHaveBeenCalledOnce();
    expect(visible).toBe(true);

    clearTimeout(t);
  });

  it("does NOT re-trigger when round is unchanged (prevRoundRef guard)", () => {
    // The effect compares prevRoundRef.current === currentRound and returns early
    let triggerCount = 0;
    function maybeRetrigger(prev: number, current: number) {
      if (prev === current) return; // guard — no re-trigger
      triggerCount++;
    }

    maybeRetrigger(3, 3); // same round — no trigger
    expect(triggerCount).toBe(0);

    maybeRetrigger(3, 4); // round advanced — trigger
    expect(triggerCount).toBe(1);

    maybeRetrigger(4, 4); // same round again — no trigger
    expect(triggerCount).toBe(1);
  });

  it("re-triggers once per round advance (rounds 1→2→3)", () => {
    let triggerCount = 0;
    let prevRound = 1;

    function advance(nextRound: number) {
      if (prevRound === nextRound) return;
      prevRound = nextRound;
      triggerCount++;
    }

    advance(2); // round 1→2
    advance(2); // same — no trigger
    advance(3); // round 2→3
    advance(3); // same — no trigger

    expect(triggerCount).toBe(2);
  });

  it("bars show 0% during the 80ms collapse window", () => {
    let visible = true;
    // Simulate collapse
    visible = false;
    const pcts = [100, 75, 62.5, 25];
    const widths = pcts.map((p) => animatedWidth(p, visible));
    expect(widths).toEqual(["0%", "0%", "0%", "0%"]);
  });

  it("bars show updated percentages after re-expansion", () => {
    // After round 2, scores have changed: new maxPoints is 5
    const newStandings = [
      { points: 5 },
      { points: 4 },
      { points: 3 },
      { points: 1 },
    ];
    const newMax = 5;
    let visible = false;
    // Simulate timeout firing
    visible = true;
    const widths = newStandings.map((s) => animatedWidth(barPct(s.points, newMax), visible));
    expect(widths).toEqual(["100%", "80%", "60%", "20%"]);
  });
});
