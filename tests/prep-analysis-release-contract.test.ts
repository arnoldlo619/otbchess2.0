import { describe, expect, it } from "vitest";
import { resolveAnalysisWorkspace } from "../server/prep/analysisResolver";
import { buildPositionAnalysisUrl } from "../client/src/lib/analyzeAction";
import type { PrepAnalysisSnapshot, ScoutReportV3 } from "../shared/prepTypes";

const cacheKey = "v3:lichess:opponent:all:g50:cblack";

const report: ScoutReportV3 = {
  version: 3,
  engineVersion: "3.0.0",
  provider: "lichess",
  opponent: { username: "opponent", record: { white: { w: 1, d: 0, l: 0 }, black: { w: 0, d: 0, l: 1 } }, avgRating: 1600, timeControlSplit: {} },
  dataQuality: { requested: 2, fetched: 2, parsed: 2, quarantined: 0, excluded: {}, ratedShare: 1, window: { from: "2024-01-01", to: "2024-01-02" }, grade: "D", notes: [] },
  openingForecast: { white: [], black: [] },
  insights: [{
    id: "claim-1", kind: "opening_tendency", color: "black", role: "plays", claim: "Claim",
    evidence: { stat: "2 games", games: [{ url: "https://lichess.org/MPJcy1JW", date: "2024-01-01", result: "W" }], window: { from: "2024-01-01", to: "2024-01-02", timeClasses: ["rapid"], ratedOnly: true } },
    interpretation: "Interpretation", recommendation: { action: "Prepare" }, confidence: "low", sampleSize: 2,
  }],
  sections: { matchupSummary: [], strengths: [], weaknesses: [], weakSignals: [], ifYouHaveWhite: [], ifYouHaveBlack: [], deviationPoints: [], behavior: [], prepChecklist: [] },
  guardLog: { droppedInsights: 0, reasons: {} },
  generatedAt: "2024-01-03T00:00:00.000Z",
  reportSnapshot: { id: cacheKey, myColor: "black", createdAt: "2024-01-03T00:00:00.000Z" },
};

const snapshot: PrepAnalysisSnapshot = {
  schemaVersion: 1,
  reportCacheKey: cacheKey,
  submittedMyColor: "black",
  createdAt: report.generatedAt,
  evidenceGameKeys: ["lichess:MPJcy1JW"],
  sourceGames: [{
    sourceGameKey: "lichess:MPJcy1JW", provider: "lichess", providerGameId: "MPJcy1JW", providerUrl: "https://lichess.org/MPJcy1JW",
    white: "WhitePlayer", black: "opponent", result: "1-0", playedAt: "2024-01-01", timeControl: "rapid",
    opening: { eco: "C20", name: "King's Pawn Game" }, rules: "chess", sans: ["e4", "e5", "Nf3", "Nc6"],
  }],
  legalUciPaths: [[], ["e2e4"], ["e2e4", "e7e5"], ["e2e4", "e7e5", "g1f3"], ["e2e4", "e7e5", "g1f3", "b8c6"]],
};

describe("analysis release contracts", () => {
  it("uses the snapshot orientation, never a browser color", () => {
    const result = resolveAnalysisWorkspace({
      subject: { kind: "source-game", reportCacheKey: cacheKey, sourceGameKey: "lichess:MPJcy1JW" },
      report, snapshot, reportCreatedAt: snapshot.createdAt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.workspace.position.orientation).toBe("black");
  });

  it("rejects cross-report and non-evidence game substitution", () => {
    const crossReport = resolveAnalysisWorkspace({
      subject: { kind: "source-game", reportCacheKey: "v3:lichess:other:all:g50:cwhite", sourceGameKey: "lichess:MPJcy1JW" },
      report, snapshot, reportCreatedAt: snapshot.createdAt,
    });
    expect(crossReport).toMatchObject({ ok: false, error: "cross_report_substitution" });
    const nonEvidence = resolveAnalysisWorkspace({
      subject: { kind: "source-game", reportCacheKey: cacheKey, sourceGameKey: "lichess:XXXXXXXX" },
      report, snapshot, reportCreatedAt: snapshot.createdAt,
    });
    expect(nonEvidence).toMatchObject({ ok: false, error: "game_not_in_report" });
  });

  it("rejects a legal position that is not in the report tree", () => {
    const result = resolveAnalysisWorkspace({
      subject: { kind: "report-position", reportCacheKey: cacheKey, canonicalUciPath: ["d2d4"] },
      report, snapshot, reportCreatedAt: snapshot.createdAt,
    });
    expect(result).toMatchObject({ ok: false, error: "position_not_in_report" });
  });

  it("launch URLs carry only subject IDs and a local return context", () => {
    const href = buildPositionAnalysisUrl({ reportCacheKey: cacheKey, canonicalUciPath: ["e2e4"], returnPath: "/prep/opponent#opening-forecast" });
    expect(href).toContain("/prep/analysis?");
    expect(href).toContain("return=%2Fprep%2Fopponent%23opening-forecast");
    expect(href).not.toContain("color=");
    expect(href).not.toContain("fen=");
  });
});
