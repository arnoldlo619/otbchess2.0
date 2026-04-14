/**
 * Tests for the Key Lines filter logic in MatchupPrep
 * Covers: All / Main Lines / Surprises / Must Know filtering
 */
import { describe, it, expect } from "vitest";

// Mirror the types from MatchupPrep.tsx
type LineFilter = "all" | "main" | "surprise" | "must-know";

interface MockLine {
  name: string;
  confidence: "high" | "medium" | "low";
  lineType?: "main" | "surprise";
  collisionScore: number;
}

// Mirror the filter logic from MatchupPrep.tsx
function applyFilter(lines: MockLine[], filter: LineFilter): MockLine[] {
  if (filter === "all") return lines;
  if (filter === "main") return lines.filter(l => l.lineType === "main" || !l.lineType);
  if (filter === "surprise") return lines.filter(l => l.lineType === "surprise");
  if (filter === "must-know") return lines.filter(l => l.confidence === "high");
  return lines;
}

const SAMPLE_LINES: MockLine[] = [
  { name: "Ruy Lopez Main",       confidence: "high",   lineType: "main",     collisionScore: 80 },
  { name: "Sicilian Najdorf",     confidence: "high",   lineType: "main",     collisionScore: 70 },
  { name: "King's Gambit Trap",   confidence: "medium", lineType: "surprise", collisionScore: 40 },
  { name: "Fried Liver Attack",   confidence: "low",    lineType: "surprise", collisionScore: 20 },
  { name: "Italian Game",         confidence: "medium", lineType: "main",     collisionScore: 60 },
  { name: "Untagged Line",        confidence: "low",    lineType: undefined,  collisionScore: 10 },
];

describe("Key Lines filter — All", () => {
  it("returns all lines", () => {
    expect(applyFilter(SAMPLE_LINES, "all")).toHaveLength(6);
  });

  it("returns the same array reference", () => {
    expect(applyFilter(SAMPLE_LINES, "all")).toBe(SAMPLE_LINES);
  });
});

describe("Key Lines filter — Main Lines", () => {
  it("returns only main-tagged lines plus untagged", () => {
    const result = applyFilter(SAMPLE_LINES, "main");
    expect(result).toHaveLength(4); // Ruy Lopez, Najdorf, Italian, Untagged
  });

  it("excludes surprise lines", () => {
    const result = applyFilter(SAMPLE_LINES, "main");
    expect(result.every(l => l.lineType !== "surprise")).toBe(true);
  });

  it("includes lines with no lineType (untagged defaults to main)", () => {
    const result = applyFilter(SAMPLE_LINES, "main");
    expect(result.some(l => l.lineType === undefined)).toBe(true);
  });
});

describe("Key Lines filter — Surprises", () => {
  it("returns only surprise-tagged lines", () => {
    const result = applyFilter(SAMPLE_LINES, "surprise");
    expect(result).toHaveLength(2);
  });

  it("all returned lines have lineType === 'surprise'", () => {
    const result = applyFilter(SAMPLE_LINES, "surprise");
    expect(result.every(l => l.lineType === "surprise")).toBe(true);
  });

  it("returns empty array when no surprise lines exist", () => {
    const noSurprises = SAMPLE_LINES.filter(l => l.lineType !== "surprise");
    expect(applyFilter(noSurprises, "surprise")).toHaveLength(0);
  });
});

describe("Key Lines filter — Must Know", () => {
  it("returns only high-confidence lines", () => {
    const result = applyFilter(SAMPLE_LINES, "must-know");
    expect(result).toHaveLength(2); // Ruy Lopez + Najdorf
  });

  it("all returned lines have confidence === 'high'", () => {
    const result = applyFilter(SAMPLE_LINES, "must-know");
    expect(result.every(l => l.confidence === "high")).toBe(true);
  });

  it("returns empty array when no high-confidence lines exist", () => {
    const noHigh = SAMPLE_LINES.filter(l => l.confidence !== "high");
    expect(applyFilter(noHigh, "must-know")).toHaveLength(0);
  });
});

describe("Key Lines filter — edge cases", () => {
  it("handles empty lines array for all filters", () => {
    const filters: LineFilter[] = ["all", "main", "surprise", "must-know"];
    filters.forEach(f => {
      expect(applyFilter([], f)).toHaveLength(0);
    });
  });

  it("filter counts sum correctly (main + surprise = all minus untagged)", () => {
    const mainCount = applyFilter(SAMPLE_LINES, "main").length;
    const surpriseCount = applyFilter(SAMPLE_LINES, "surprise").length;
    const allCount = applyFilter(SAMPLE_LINES, "all").length;
    // main includes untagged, so main + surprise >= all
    expect(mainCount + surpriseCount).toBeGreaterThanOrEqual(allCount);
  });

  it("must-know filter is a subset of all", () => {
    const mustKnow = applyFilter(SAMPLE_LINES, "must-know");
    const all = applyFilter(SAMPLE_LINES, "all");
    mustKnow.forEach(line => {
      expect(all).toContain(line);
    });
  });

  it("filter toggle resets to all correctly", () => {
    // Simulate toggling: surprise → all
    const filtered = applyFilter(SAMPLE_LINES, "surprise");
    expect(filtered).toHaveLength(2);
    const reset = applyFilter(SAMPLE_LINES, "all");
    expect(reset).toHaveLength(6);
  });
});

describe("Key Lines filter — count badges", () => {
  it("computes correct count for each filter option", () => {
    const counts = {
      all:        applyFilter(SAMPLE_LINES, "all").length,
      main:       applyFilter(SAMPLE_LINES, "main").length,
      surprise:   applyFilter(SAMPLE_LINES, "surprise").length,
      "must-know": applyFilter(SAMPLE_LINES, "must-know").length,
    };
    expect(counts.all).toBe(6);
    expect(counts.main).toBe(4);
    expect(counts.surprise).toBe(2);
    expect(counts["must-know"]).toBe(2);
  });
});
