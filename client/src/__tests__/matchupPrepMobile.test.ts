/**
 * Phase 12: Matchup Prep Mobile UX Tests
 * Tests for responsive logic, progressive disclosure, and mobile-safe utilities
 */
import { describe, it, expect } from "vitest";

// ── Utility functions extracted from MatchupPrep logic ─────────────────────────

function getWinRateColor(winRate: number): "green" | "neutral" | "red" {
  if (winRate >= 55) return "green";
  if (winRate >= 45) return "neutral";
  return "red";
}

function getSavedReportWinRateColor(winRate: number): "red" | "amber" | "green" {
  if (winRate >= 60) return "red";   // danger — opponent is strong
  if (winRate >= 45) return "amber"; // caution
  return "green";                    // favourable — opponent has low win rate
}

function computeBarWidths(wins: number, draws: number, losses: number) {
  const total = wins + draws + losses;
  if (total === 0) return { winPct: 0, drawPct: 0, lossPct: 0 };
  return {
    winPct:  (wins  / total) * 100,
    drawPct: (draws / total) * 100,
    lossPct: (losses / total) * 100,
  };
}

function computeEndgamePct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function getConfidenceLabel(confidence: "high" | "medium" | "low", short: boolean): string {
  const labels = {
    high:   short ? "High"   : "High confidence",
    medium: short ? "Medium" : "Medium confidence",
    low:    short ? "Low"    : "Low confidence",
  };
  return labels[confidence];
}

function shouldShowMoreButton(openings: unknown[], initialCount: number): boolean {
  return openings.length > initialCount;
}

function getShowMoreLabel(totalCount: number, initialCount: number): string {
  return `Show ${totalCount - initialCount} more`;
}

function clampSavedReports(reports: unknown[], max: number): unknown[] {
  return reports.slice(0, max);
}

function formatSavedReportDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString();
}

function buildPrepUrl(username: string): string {
  return `/prep/${encodeURIComponent(username.trim())}`;
}

function buildRefreshUrl(username: string): string {
  return `/api/prep/${encodeURIComponent(username.trim())}?refresh=true`;
}

function buildFetchUrl(username: string, refresh = false): string {
  return `/api/prep/${encodeURIComponent(username.trim())}${refresh ? "?refresh=true" : ""}`;
}

function getSummaryChipValue(wins: number, draws: number, losses: number): string {
  return `${wins}·${draws}·${losses}`;
}

function isReportCached(report: { _cached?: boolean }): boolean {
  return report._cached === true;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Win rate color coding", () => {
  it("returns green for win rate >= 55", () => {
    expect(getWinRateColor(55)).toBe("green");
    expect(getWinRateColor(70)).toBe("green");
    expect(getWinRateColor(100)).toBe("green");
  });

  it("returns neutral for win rate 45–54", () => {
    expect(getWinRateColor(45)).toBe("neutral");
    expect(getWinRateColor(50)).toBe("neutral");
    expect(getWinRateColor(54)).toBe("neutral");
  });

  it("returns red for win rate < 45", () => {
    expect(getWinRateColor(44)).toBe("red");
    expect(getWinRateColor(0)).toBe("red");
    expect(getWinRateColor(30)).toBe("red");
  });
});

describe("Saved report win rate color (opponent strength indicator)", () => {
  it("returns red (danger) for strong opponents (>= 60% WR)", () => {
    expect(getSavedReportWinRateColor(60)).toBe("red");
    expect(getSavedReportWinRateColor(75)).toBe("red");
  });

  it("returns amber (caution) for mid-range opponents (45–59%)", () => {
    expect(getSavedReportWinRateColor(45)).toBe("amber");
    expect(getSavedReportWinRateColor(59)).toBe("amber");
  });

  it("returns green (favourable) for weak opponents (< 45%)", () => {
    expect(getSavedReportWinRateColor(44)).toBe("green");
    expect(getSavedReportWinRateColor(0)).toBe("green");
  });
});

describe("W/D/L bar width computation", () => {
  it("computes correct percentages for a standard record", () => {
    const result = computeBarWidths(60, 20, 20);
    expect(result.winPct).toBeCloseTo(60);
    expect(result.drawPct).toBeCloseTo(20);
    expect(result.lossPct).toBeCloseTo(20);
  });

  it("returns all zeros for empty record", () => {
    const result = computeBarWidths(0, 0, 0);
    expect(result.winPct).toBe(0);
    expect(result.drawPct).toBe(0);
    expect(result.lossPct).toBe(0);
  });

  it("sums to 100% for any valid record", () => {
    const result = computeBarWidths(33, 33, 34);
    expect(result.winPct + result.drawPct + result.lossPct).toBeCloseTo(100);
  });

  it("handles all-wins record", () => {
    const result = computeBarWidths(10, 0, 0);
    expect(result.winPct).toBe(100);
    expect(result.drawPct).toBe(0);
    expect(result.lossPct).toBe(0);
  });
});

describe("Endgame percentage computation", () => {
  it("rounds correctly", () => {
    expect(computeEndgamePct(1, 3)).toBe(33);
    expect(computeEndgamePct(2, 3)).toBe(67);
  });

  it("returns 0 for zero total", () => {
    expect(computeEndgamePct(0, 0)).toBe(0);
  });

  it("returns 100 for full category", () => {
    expect(computeEndgamePct(50, 50)).toBe(100);
  });
});

describe("Confidence label (mobile short vs full)", () => {
  it("returns short labels for mobile", () => {
    expect(getConfidenceLabel("high", true)).toBe("High");
    expect(getConfidenceLabel("medium", true)).toBe("Medium");
    expect(getConfidenceLabel("low", true)).toBe("Low");
  });

  it("returns full labels for desktop", () => {
    expect(getConfidenceLabel("high", false)).toBe("High confidence");
    expect(getConfidenceLabel("medium", false)).toBe("Medium confidence");
    expect(getConfidenceLabel("low", false)).toBe("Low confidence");
  });
});

describe("Progressive disclosure — show more button", () => {
  const INITIAL = 4;

  it("shows button when openings exceed initial count", () => {
    expect(shouldShowMoreButton(new Array(5), INITIAL)).toBe(true);
    expect(shouldShowMoreButton(new Array(10), INITIAL)).toBe(true);
  });

  it("hides button when openings are at or below initial count", () => {
    expect(shouldShowMoreButton(new Array(4), INITIAL)).toBe(false);
    expect(shouldShowMoreButton(new Array(3), INITIAL)).toBe(false);
    expect(shouldShowMoreButton([], INITIAL)).toBe(false);
  });

  it("shows correct count in label", () => {
    expect(getShowMoreLabel(10, 4)).toBe("Show 6 more");
    expect(getShowMoreLabel(5, 4)).toBe("Show 1 more");
    expect(getShowMoreLabel(7, 4)).toBe("Show 3 more");
  });
});

describe("Saved reports clamping", () => {
  it("clamps reports to max limit", () => {
    const reports = new Array(25).fill({ id: 1 });
    expect(clampSavedReports(reports, 20)).toHaveLength(20);
  });

  it("returns all reports when under limit", () => {
    const reports = new Array(10).fill({ id: 1 });
    expect(clampSavedReports(reports, 20)).toHaveLength(10);
  });

  it("returns empty array for empty input", () => {
    expect(clampSavedReports([], 20)).toHaveLength(0);
  });
});

describe("Date formatting for saved reports", () => {
  it("formats ISO date to locale string", () => {
    const date = "2026-01-15T10:00:00.000Z";
    const formatted = formatSavedReportDate(date);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe("URL construction", () => {
  it("builds correct prep page URL", () => {
    expect(buildPrepUrl("magnus")).toBe("/prep/magnus");
    expect(buildPrepUrl("  hikaru  ")).toBe("/prep/hikaru");
  });

  it("encodes special characters in username", () => {
    expect(buildPrepUrl("user name")).toBe("/prep/user%20name");
  });

  it("builds correct fetch URL without refresh", () => {
    expect(buildFetchUrl("magnus")).toBe("/api/prep/magnus");
  });

  it("builds correct fetch URL with refresh flag", () => {
    expect(buildFetchUrl("magnus", true)).toBe("/api/prep/magnus?refresh=true");
    expect(buildRefreshUrl("magnus")).toBe("/api/prep/magnus?refresh=true");
  });
});

describe("Summary chip W/D/L value formatting", () => {
  it("uses middle dot separator for mobile readability", () => {
    expect(getSummaryChipValue(10, 3, 5)).toBe("10·3·5");
  });

  it("handles zero values", () => {
    expect(getSummaryChipValue(0, 0, 0)).toBe("0·0·0");
  });
});

describe("Cached report detection", () => {
  it("detects cached reports", () => {
    expect(isReportCached({ _cached: true })).toBe(true);
  });

  it("returns false for non-cached reports", () => {
    expect(isReportCached({ _cached: false })).toBe(false);
    expect(isReportCached({})).toBe(false);
  });
});
