import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { projectScoutReport } from "../shared/scoutReportProjection.js";
import type { ScoutReportV3 } from "../shared/prepTypes.js";

function snapshotReport(): ScoutReportV3 {
  return {
    version: 3,
    engineVersion: "4.0.0-launch.1",
    provider: "lichess",
    opponent: {
      username: "sameplayer",
      record: { white: { w: 4, d: 2, l: 4 }, black: { w: 2, d: 1, l: 1 } },
      avgRating: 1824,
      timeControlSplit: { rapid: { games: 9, score: 0.5 }, blitz: { games: 3, score: 0.33 } },
    },
    dataQuality: {
      requested: 30,
      fetched: 30,
      parsed: 12,
      quarantined: 0,
      excluded: {},
      ratedShare: 1,
      window: { from: "2026-07-01", to: "2026-08-20" },
      grade: "B",
      freshness: "usable",
      notes: [],
    },
    openingForecast: { white: [], black: [] },
    insights: [],
    scoutBrief: [{
      id: "resp:black:1.e4:c5",
      sourceInsightId: "resp:black:1.e4:c5",
      kind: "response_pattern",
      opponentColor: "black",
      title: "Expect this reply",
      action: { label: "With White, choose 1.e4 and prepare your next move after 1...c5." },
      why: "Against 1.e4 they choose 1...c5 in 8 of 10 games.",
      confidence: "medium_high",
      evidence: { stat: "8/10", games: [], window: { from: "2026-07-01", to: "2026-08-20", timeClasses: ["rapid"], ratedOnly: true }, sampleSize: 8 },
    }],
    sections: { matchupSummary: [], strengths: [], weaknesses: [], weakSignals: [], ifYouHaveWhite: [], ifYouHaveBlack: [], deviationPoints: [], behavior: [], prepChecklist: [] },
    guardLog: { droppedInsights: 0, reasons: {} },
    generatedAt: "2026-08-20T10:00:00.000Z",
    freshness: "usable",
    reportSnapshot: {
      id: "scout:lichess:sameplayer:white:all:standard:30:launch-2",
      activeRequest: { platform: "lichess", normalizedUsername: "sameplayer", displayUsername: "SamePlayer", myColor: "white", formats: ["rapid", "blitz", "bullet"], mode: "standard", maxGames: 30, schemaVersion: "launch-2", requestedAt: "2026-08-20T10:00:00.000Z" },
      createdAt: "2026-08-20T10:00:00.000Z",
    },
  };
}

describe("Matchup Prep immutable report projection", () => {
  it("projects exact submitted identity, action IDs, evidence, window, and zero-filled format breakdown from one snapshot", () => {
    const report = snapshotReport();
    const view = projectScoutReport(report);
    expect(view.snapshot).toBe(report.reportSnapshot);
    expect(view.opponent.provider).toBe("lichess");
    expect(view.actions).toEqual(report.scoutBrief);
    expect(view.gameWindow).toEqual(report.dataQuality.window);
    expect(view.formatBreakdown).toEqual([{ format: "rapid", games: 9 }, { format: "blitz", games: 3 }, { format: "bullet", games: 0 }]);
  });

  it("refuses export or visible report projection when an old report lacks immutable identity", () => {
    const report = snapshotReport();
    delete report.reportSnapshot;
    expect(() => projectScoutReport(report)).toThrow("MissingScoutReportSnapshot");
  });

  it("renders one Scout Brief and one legal explorer rather than legacy duplicate insight sections", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"), "utf8");
    expect(source).toContain("projectScoutReport(report)");
    expect(source).toContain("<ForecastWalkthrough");
    expect(source).toContain("Evidence summary");
    expect(source).toContain("const [evidenceOpen, setEvidenceOpen] = useState(false)");
    expect(source).toContain("open={evidenceOpen}");
    expect(source).toContain("aria-expanded={evidenceOpen}");
    expect(source).not.toMatch(/Detailed Insights|Prep Checklist|If You Have White|If You Have Black/);
  });

  it("uses the same immutable projection for the export card and never accepts a mutable color prop", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/prep/PrepExportCard.tsx"), "utf8");
    expect(source).toContain("projectScoutReport(report)");
    expect(source).toContain("view.actions");
    expect(source).not.toMatch(/myColor\??:/);
  });
});
