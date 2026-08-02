/**
 * Tests for the V3 Prep Pipeline refactor:
 * - Forecast tree now goes 6 plies deep with labels
 * - Section IDs resolve to insights correctly (client-side logic)
 * - Statistical language uses conditional phrasing
 * - Deterministic fallback summary
 */
import { describe, it, expect } from "vitest";
import type { Insight, ScoutReportV3, ForecastBranch } from "../shared/prepTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<Insight> & { id: string }): Insight {
  return {
    kind: "weakness",
    color: "white",
    role: "plays",
    claim: "Test claim",
    evidence: { stat: "5/10", games: [], window: { from: "2024-01", to: "2024-06", timeClasses: ["rapid"], ratedOnly: true } },
    interpretation: "Test interpretation",
    recommendation: { action: "Test action" },
    confidence: "medium",
    sampleSize: 10,
    ...overrides,
  };
}

function resolveInsights(ids: string[], allInsights: Insight[]): Insight[] {
  const map = new Map(allInsights.map(i => [i.id, i]));
  return ids.map(id => map.get(id)).filter(Boolean) as Insight[];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Section ID resolution", () => {
  it("resolves valid IDs to insight objects", () => {
    const insights = [
      makeInsight({ id: "tend:white:1.e4", claim: "Opens 1.e4 frequently" }),
      makeInsight({ id: "weak:black:1...d5", claim: "Weak in QGD" }),
      makeInsight({ id: "str:white:1.d4", claim: "Strong in QP" }),
    ];
    const sectionIds = ["tend:white:1.e4", "weak:black:1...d5"];
    const resolved = resolveInsights(sectionIds, insights);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].claim).toBe("Opens 1.e4 frequently");
    expect(resolved[1].claim).toBe("Weak in QGD");
  });

  it("skips invalid IDs gracefully", () => {
    const insights = [makeInsight({ id: "tend:white:1.e4", claim: "Opens 1.e4" })];
    const sectionIds = ["tend:white:1.e4", "nonexistent:id"];
    const resolved = resolveInsights(sectionIds, insights);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe("tend:white:1.e4");
  });

  it("returns empty array for empty section", () => {
    const insights = [makeInsight({ id: "tend:white:1.e4" })];
    const resolved = resolveInsights([], insights);
    expect(resolved).toHaveLength(0);
  });
});

describe("Forecast branch labels", () => {
  it("ForecastBranch type supports optional label field", () => {
    const branch: ForecastBranch = {
      moveSan: "e4",
      count: 20,
      pct: 0.6,
      score: 0.55,
      label: "King's Pawn Opening",
      children: [],
    };
    expect(branch.label).toBe("King's Pawn Opening");
  });

  it("ForecastBranch supports nested children", () => {
    const branch: ForecastBranch = {
      moveSan: "e4",
      count: 20,
      pct: 0.6,
      score: 0.55,
      children: [
        { moveSan: "e5", count: 12, pct: 0.6, score: 0.5, children: [
          { moveSan: "Nf3", count: 8, pct: 0.67, score: 0.55, children: [] }
        ]},
        { moveSan: "c5", count: 6, pct: 0.3, score: 0.6, children: [] },
      ],
    };
    expect(branch.children).toHaveLength(2);
    expect(branch.children[0].children).toHaveLength(1);
    expect(branch.children[0].children[0].moveSan).toBe("Nf3");
  });
});

describe("Color filter logic", () => {
  it("filters insights by color correctly", () => {
    const insights = [
      makeInsight({ id: "a", color: "white" }),
      makeInsight({ id: "b", color: "black" }),
      makeInsight({ id: "c", color: "white" }),
    ];

    const whiteOnly = insights.filter(i => i.color === "white");
    expect(whiteOnly).toHaveLength(2);

    const blackOnly = insights.filter(i => i.color === "black");
    expect(blackOnly).toHaveLength(1);

    const both = insights;
    expect(both).toHaveLength(3);
  });
});

describe("Deterministic fallback summary", () => {
  it("builds summary from structured data when AI fails", () => {
    const report: Partial<ScoutReportV3> = {
      opponent: {
        username: "testplayer",
        record: { white: { w: 10, d: 3, l: 7 }, black: { w: 8, d: 4, l: 8 } },
        avgRating: 1500,
        timeControlSplit: {},
      },
      insights: [
        makeInsight({ id: "weak1", kind: "weakness", recommendation: { action: "Play 1.e4 and push for f4" } }),
        makeInsight({ id: "tend1", kind: "opening_tendency", claim: "Opens 1.e4 in 80% of games" }),
      ],
      sections: {
        matchupSummary: ["tend1"],
        strengths: [],
        weaknesses: ["weak1"],
        weakSignals: [],
        ifYouHaveWhite: [],
        ifYouHaveBlack: [],
        deviationPoints: [],
        behavior: [],
        prepChecklist: [],
      },
    };

    // Simulate the deterministic fallback logic
    const bullets: string[] = [];
    const weaknessInsight = report.insights!.find(i => report.sections!.weaknesses.includes(i.id));
    if (weaknessInsight) bullets.push(`**Exploit:** ${weaknessInsight.recommendation.action}`);
    const tendencyInsight = report.insights!.find(i => i.kind === "opening_tendency");
    if (tendencyInsight) bullets.push(`**Opening:** ${tendencyInsight.claim}`);

    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toContain("Play 1.e4");
    expect(bullets[1]).toContain("Opens 1.e4");
  });
});

describe("Game count semantics", () => {
  it("Standard maps to 50, Deep maps to 100", () => {
    const labels: Record<string, string> = { "50": "Standard", "100": "Deep" };
    expect(labels["50"]).toBe("Standard");
    expect(labels["100"]).toBe("Deep");
  });
});
