import { describe, expect, it } from "vitest";

import { simpleOpeningName } from "../shared/simpleOpeningNames.js";
import type { ScoutReportV3 } from "../shared/prepTypes.js";
import { presentPrepReport } from "../server/prepRoutes.js";
import { buildReport } from "../server/prep/buildReport.js";
import { makeLaunchGames } from "../server/prep/__fixtures__/launchFixtures.js";

const report: ScoutReportV3 = {
  version: 3,
  engineVersion: "4.1.0-tiered-brief",
  provider: "chesscom",
  opponent: {
    username: "scouted-player",
    record: { white: { w: 5, d: 1, l: 4 }, black: { w: 3, d: 2, l: 5 } },
    avgRating: 1540,
    timeControlSplit: { rapid: { games: 20, score: 0.5 } },
  },
  dataQuality: { requested: 30, fetched: 20, parsed: 20, quarantined: 0, excluded: {}, ratedShare: 1, window: { from: "2026-01-01", to: "2026-09-01" }, grade: "A", freshness: "strong", notes: [] },
  openingForecast: { white: [{ moveSan: "e4", count: 10, pct: 100, score: 0.5, wins: 5, draws: 0, losses: 5, children: [] }], black: [] },
  openingSummary: {
    white: [{ name: "Italian Game", games: 7, share: 0.7, score: 0.5 }, { name: "London System", games: 3, share: 0.3, score: 0.67 }],
    black: [{ name: "Sicilian Defense", games: 6, share: 0.6, score: 0.42 }, { name: "Scandinavian Defense", games: 4, share: 0.4, score: 0.5 }],
  },
  insights: [{ id: "weak:black:sicilian", kind: "weakness", color: "black", role: "plays", claim: "They score 42% in Sicilian Defense positions.", evidence: { stat: "3/7", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true } }, interpretation: "A repeatable weakness.", recommendation: { action: "Target the Sicilian Defense." }, confidence: "medium_high", sampleSize: 7, baseline: { metric: "black", value: 0.5, delta: -0.08 } }],
  scoutBrief: [],
  sections: { matchupSummary: [], strengths: [], weaknesses: ["weak:black:sicilian"], weakSignals: [], ifYouHaveWhite: [], ifYouHaveBlack: [], deviationPoints: [], behavior: [], prepChecklist: [] },
  guardLog: { droppedInsights: 0, reasons: {} },
  generatedAt: "2026-09-01T00:00:00.000Z",
  reportSnapshot: { id: "snapshot-key", activeRequest: { platform: "chesscom", normalizedUsername: "scouted-player", displayUsername: "scouted-player", myColor: "white", formats: ["rapid"], mode: "standard", maxGames: 30, schemaVersion: "3", requestedAt: "2026-09-01T00:00:00.000Z" }, createdAt: "2026-09-01T00:00:00.000Z" },
};

describe("tiered Matchup Prep access", () => {
  it("normalizes nuanced provider labels into familiar opening families", () => {
    expect(simpleOpeningName("Italian Game: Giuoco Piano", "C50")).toBe("Italian Game");
    expect(simpleOpeningName("Sicilian Defense: Najdorf Variation", "B90")).toBe("Sicilian Defense");
    expect(simpleOpeningName("Classical, 4...Qe7", "C65")).toBe("Ruy Lopez");
    expect(simpleOpeningName("Main Setup: d4-Nc3-Bf4", "D02", "d4")).toBe("Queen's Pawn Opening");
  });

  it("builds familiar opening summaries plus a complete evidence-backed Pro Scout Brief from eligible games", () => {
    const generated = buildReport(
      "chesscom",
      "sameplayer",
      [...makeLaunchGames({ count: 16, playerColor: "white" }), ...makeLaunchGames({ count: 16, playerColor: "black" })],
      { maxGames: 30, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true },
    );
    expect(generated.openingSummary?.white.length).toBeLessThanOrEqual(2);
    expect(generated.openingSummary?.black.length).toBeLessThanOrEqual(2);
    expect(generated.openingSummary?.white.map(opening => opening.name).join(" ")).not.toMatch(/Variation|Classical,/i);
    expect(generated.openingSummary?.black.map(opening => opening.name).join(" ")).not.toMatch(/Variation|Classical,/i);
    expect(generated.scoutBrief?.map(action => action.type)).toEqual(["expect", "prepare", "practice"]);
    expect(generated.scoutBrief?.every(action => action.evidence.relevantGames >= 2 && action.evidence.games.length > 0)).toBe(true);
    expect(generated.scoutBrief?.every(action => action.action.source === "explorerReference")).toBe(true);
  });

  it("keeps a complete observed-line brief for limited samples while withholding a stale report plan", () => {
    const limited = buildReport(
      "chesscom",
      "sameplayer",
      makeLaunchGames({ count: 6, playerColor: "black" }),
      { maxGames: 30, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true },
    );
    const stale = buildReport(
      "chesscom",
      "sameplayer",
      makeLaunchGames({ count: 20, playerColor: "black", newestDaysAgo: 550, spacingDays: 7 }),
      { maxGames: 30, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true },
    );

    expect(limited.dataQuality.freshness).toBe("limited");
    expect(limited.scoutBrief?.map(action => action.type)).toEqual(["expect", "prepare", "practice"]);
    expect(stale.dataQuality.freshness).toBe("stale");
    expect(stale.scoutBrief).toEqual([]);
  });

  it("returns only the simple opening brief to free accounts", () => {
    const free = presentPrepReport(report, false);
    expect(free.access).toEqual({ tier: "free", detailedInsightsAvailable: false });
    expect(free.openingSummary).toEqual(report.openingSummary);
    expect(free.insights).toEqual([]);
    expect(free.scoutBrief).toEqual([]);
    expect(free.openingForecast).toEqual({ white: [], black: [] });
    expect(free.sections.weaknesses).toEqual([]);
  });

  it("retains detailed weaknesses and study paths for Pro accounts", () => {
    const pro = presentPrepReport(report, true);
    expect(pro.access).toEqual({ tier: "pro", detailedInsightsAvailable: true });
    expect(pro.insights).toHaveLength(1);
    expect(pro.sections.weaknesses).toEqual(["weak:black:sicilian"]);
    expect(pro.openingForecast.white).toHaveLength(1);
  });
});
