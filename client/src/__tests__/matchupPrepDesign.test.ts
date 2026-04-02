/**
 * Tests for the redesigned Matchup Prep design system logic.
 * Covers: design token generation, stat computation helpers,
 * confidence level mapping, and opening data processing.
 */
import { describe, it, expect } from "vitest";

// ── Design token helpers (extracted from component logic) ─────────────────────

function getWinRateColor(winRate: number, isDark: boolean): string {
  if (winRate >= 55) return "text-[#5B9A6A]";
  if (winRate >= 45) return isDark ? "text-white" : "text-gray-900";
  return "text-red-400";
}

function getOpeningWinRateColor(winRate: number): string {
  if (winRate >= 60) return "text-emerald-500";
  if (winRate >= 40) return "text-amber-500";
  return "text-red-400";
}

function getConfidenceConfig(confidence: "high" | "medium" | "low") {
  const map = {
    high:   { label: "High confidence",   dotClass: "bg-emerald-500" },
    medium: { label: "Medium confidence", dotClass: "bg-amber-500"   },
    low:    { label: "Low confidence",    dotClass: "bg-white/30"    },
  };
  return map[confidence];
}

// ── Bar percentage computation ────────────────────────────────────────────────

function computeBarPcts(wins: number, draws: number, losses: number) {
  const total = wins + draws + losses;
  if (total === 0) return { winPct: 0, drawPct: 0, lossPct: 0 };
  return {
    winPct:  (wins   / total) * 100,
    drawPct: (draws  / total) * 100,
    lossPct: (losses / total) * 100,
  };
}

function computeEndgamePct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

// ── Tab logic ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "openings" | "prep";

function getTabBadgeVisible(tabId: Tab, prepLinesCount: number): boolean {
  return tabId === "prep" && prepLinesCount > 0;
}

// ── Opening data helpers ──────────────────────────────────────────────────────

function sliceOpenings<T>(openings: T[], max = 6): T[] {
  return openings.slice(0, max);
}

function sliceFirstMoves<T>(moves: T[], max = 3): T[] {
  return moves.slice(0, max);
}

// ── Summary chip highlight logic ──────────────────────────────────────────────

function shouldHighlightSummaryChip(value: number, threshold: number): boolean {
  return value >= threshold;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Matchup Prep — win rate color coding", () => {
  it("returns accent green for win rate >= 55%", () => {
    expect(getWinRateColor(55, true)).toBe("text-[#5B9A6A]");
    expect(getWinRateColor(70, false)).toBe("text-[#5B9A6A]");
    expect(getWinRateColor(100, true)).toBe("text-[#5B9A6A]");
  });

  it("returns neutral text for win rate 45–54%", () => {
    expect(getWinRateColor(50, true)).toBe("text-white");
    expect(getWinRateColor(50, false)).toBe("text-gray-900");
    expect(getWinRateColor(45, true)).toBe("text-white");
  });

  it("returns red for win rate < 45%", () => {
    expect(getWinRateColor(44, true)).toBe("text-red-400");
    expect(getWinRateColor(0, false)).toBe("text-red-400");
    expect(getWinRateColor(30, true)).toBe("text-red-400");
  });
});

describe("Matchup Prep — opening win rate color coding", () => {
  it("returns emerald for >= 60%", () => {
    expect(getOpeningWinRateColor(60)).toBe("text-emerald-500");
    expect(getOpeningWinRateColor(80)).toBe("text-emerald-500");
  });

  it("returns amber for 40–59%", () => {
    expect(getOpeningWinRateColor(40)).toBe("text-amber-500");
    expect(getOpeningWinRateColor(59)).toBe("text-amber-500");
  });

  it("returns red for < 40%", () => {
    expect(getOpeningWinRateColor(39)).toBe("text-red-400");
    expect(getOpeningWinRateColor(0)).toBe("text-red-400");
  });
});

describe("Matchup Prep — confidence level mapping", () => {
  it("maps high confidence correctly", () => {
    const c = getConfidenceConfig("high");
    expect(c.label).toBe("High confidence");
    expect(c.dotClass).toBe("bg-emerald-500");
  });

  it("maps medium confidence correctly", () => {
    const c = getConfidenceConfig("medium");
    expect(c.label).toBe("Medium confidence");
    expect(c.dotClass).toBe("bg-amber-500");
  });

  it("maps low confidence correctly", () => {
    const c = getConfidenceConfig("low");
    expect(c.label).toBe("Low confidence");
    expect(c.dotClass).toBe("bg-white/30");
  });
});

describe("Matchup Prep — bar percentage computation", () => {
  it("computes correct percentages for a typical record", () => {
    const { winPct, drawPct, lossPct } = computeBarPcts(6, 2, 2);
    expect(winPct).toBe(60);
    expect(drawPct).toBe(20);
    expect(lossPct).toBe(20);
  });

  it("returns 0 for all when total is 0", () => {
    const result = computeBarPcts(0, 0, 0);
    expect(result.winPct).toBe(0);
    expect(result.drawPct).toBe(0);
    expect(result.lossPct).toBe(0);
  });

  it("handles all wins", () => {
    const { winPct, drawPct, lossPct } = computeBarPcts(10, 0, 0);
    expect(winPct).toBe(100);
    expect(drawPct).toBe(0);
    expect(lossPct).toBe(0);
  });

  it("handles all losses", () => {
    const { winPct, drawPct, lossPct } = computeBarPcts(0, 0, 5);
    expect(winPct).toBe(0);
    expect(drawPct).toBe(0);
    expect(lossPct).toBe(100);
  });

  it("sums to 100% for any valid record", () => {
    const { winPct, drawPct, lossPct } = computeBarPcts(3, 4, 3);
    expect(winPct + drawPct + lossPct).toBeCloseTo(100);
  });
});

describe("Matchup Prep — endgame percentage computation", () => {
  it("computes correct endgame percentage", () => {
    expect(computeEndgamePct(5, 20)).toBe(25);
    expect(computeEndgamePct(10, 10)).toBe(100);
    expect(computeEndgamePct(0, 20)).toBe(0);
  });

  it("returns 0 when total is 0", () => {
    expect(computeEndgamePct(5, 0)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    expect(computeEndgamePct(1, 3)).toBe(33); // 33.33...
    expect(computeEndgamePct(2, 3)).toBe(67); // 66.66...
  });
});

describe("Matchup Prep — tab badge visibility", () => {
  it("shows badge on prep tab when there are prep lines", () => {
    expect(getTabBadgeVisible("prep", 3)).toBe(true);
    expect(getTabBadgeVisible("prep", 1)).toBe(true);
  });

  it("hides badge on prep tab when there are no prep lines", () => {
    expect(getTabBadgeVisible("prep", 0)).toBe(false);
  });

  it("never shows badge on non-prep tabs", () => {
    expect(getTabBadgeVisible("overview", 5)).toBe(false);
    expect(getTabBadgeVisible("openings", 5)).toBe(false);
  });
});

describe("Matchup Prep — opening data slicing", () => {
  const openings = Array.from({ length: 10 }, (_, i) => ({ name: `Opening ${i}`, eco: `A${i}` }));

  it("slices openings to max 6 by default", () => {
    expect(sliceOpenings(openings)).toHaveLength(6);
  });

  it("returns all if fewer than max", () => {
    expect(sliceOpenings(openings.slice(0, 3))).toHaveLength(3);
  });

  it("slices first moves to max 3 by default", () => {
    const moves = [{ move: "e4" }, { move: "d4" }, { move: "c4" }, { move: "Nf3" }];
    expect(sliceFirstMoves(moves)).toHaveLength(3);
  });
});

describe("Matchup Prep — summary chip highlight logic", () => {
  it("highlights when value meets or exceeds threshold", () => {
    expect(shouldHighlightSummaryChip(55, 55)).toBe(true);
    expect(shouldHighlightSummaryChip(60, 55)).toBe(true);
  });

  it("does not highlight when value is below threshold", () => {
    expect(shouldHighlightSummaryChip(54, 55)).toBe(false);
    expect(shouldHighlightSummaryChip(0, 55)).toBe(false);
  });
});
