// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { V3ScoutReportTab } from "../client/src/components/prep/V3ScoutReportTab.js";
import type { ScoutReportV3 } from "../shared/prepTypes.js";

const tokens = {
  card: "rounded-xl border", cardSubtle: "rounded-lg", textPrimary: "text-slate-950", textSecondary: "text-slate-600", textTertiary: "text-slate-500", divider: "border-slate-200", monoBlock: "font-mono",
};

const freeReport: ScoutReportV3 = {
  version: 3, engineVersion: "4.1.0-tiered-brief", provider: "chesscom",
  opponent: { username: "scouted-player", record: { white: { w: 5, d: 1, l: 4 }, black: { w: 3, d: 2, l: 5 } }, avgRating: 1540, timeControlSplit: { rapid: { games: 20, score: 0.5 } } },
  dataQuality: { requested: 30, fetched: 20, parsed: 20, quarantined: 0, excluded: {}, ratedShare: 1, window: { from: "2026-01-01", to: "2026-09-01" }, grade: "A", freshness: "strong", notes: [] },
  openingForecast: { white: [], black: [] },
  openingSummary: { white: [{ name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6"], games: 8, share: 0.8, score: 0.5 }, { name: "London System", moves: ["d4", "d5", "Bf4", "Nf6"], games: 2, share: 0.2, score: 0.5 }], black: [{ name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "d6"], games: 7, share: 0.7, score: 0.43 }, { name: "Scandinavian Defense", moves: ["e4", "d5", "exd5", "Qxd5"], games: 3, share: 0.3, score: 0.5 }] },
  access: { tier: "free", detailedInsightsAvailable: false },
  insights: [], scoutBrief: [],
  sections: { matchupSummary: [], strengths: [], weaknesses: [], weakSignals: [], ifYouHaveWhite: [], ifYouHaveBlack: [], deviationPoints: [], behavior: [], prepChecklist: [] },
  guardLog: { droppedInsights: 0, reasons: {} }, generatedAt: "2026-09-01T00:00:00.000Z",
  reportSnapshot: { id: "snapshot-key", activeRequest: { platform: "chesscom", normalizedUsername: "scouted-player", displayUsername: "scouted-player", myColor: "white", formats: ["rapid"], mode: "standard", maxGames: 30, schemaVersion: "3", requestedAt: "2026-09-01T00:00:00.000Z" }, createdAt: "2026-09-01T00:00:00.000Z" },
};

describe("free Matchup Prep Scout Brief", () => {
  it("shows only two familiar openings for each color and a clear Pro boundary", () => {
    render(<V3ScoutReportTab report={freeReport} isDark={false} t={tokens} reportCacheKey="snapshot-key" />);
    expect(screen.getByTestId("simple-opening-brief")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "As White" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "As Black" })).toBeTruthy();
    expect(screen.getByText("Italian Game")).toBeTruthy();
    expect(screen.getByText("Italian Game").parentElement?.textContent).toContain("(1. e4 1... e5 2. Nf3 2... Nc6)");
    expect(screen.getByText("London System")).toBeTruthy();
    expect(screen.getByText("Sicilian Defense")).toBeTruthy();
    expect(screen.getByText("Scandinavian Defense")).toBeTruthy();
    expect(screen.getByText("50% as White")).toBeTruthy();
    expect(screen.getByText("30% as Black")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View Pro/i }).getAttribute("href")).toBe("/pricing");
    expect(screen.queryByText("Opening Forecast")).toBeNull();
    expect(screen.queryByText("Evidence summary")).toBeNull();
    expect(screen.queryByText(/Their two most-played openings with each color/i)).toBeNull();
    expect(screen.queryByText(/scouted-player as Black/i)).toBeNull();
  });

  it("keeps the opening overview and adds the 30-second Pro plan", () => {
    const proReport: ScoutReportV3 = {
      ...freeReport,
      access: { tier: "pro", detailedInsightsAvailable: true },
      openingForecast: {
        white: [{ moveSan: "e4", moveNumber: 1, sideToMove: "black", actor: "opponent", previewPath: ["e4"], count: 8, pct: 0.8, score: 0.5, wins: 4, draws: 0, losses: 4, children: [] }],
        black: [{ moveSan: "e4", moveNumber: 1, sideToMove: "black", actor: "user", previewPath: ["e4"], count: 7, pct: 0.7, score: 0.43, wins: 3, draws: 0, losses: 4, children: [{ moveSan: "c5", moveNumber: 1, sideToMove: "white", actor: "opponent", previewPath: ["e4", "c5"], count: 6, pct: 0.86, score: 0.4, wins: 2, draws: 1, losses: 3, children: [] }] }],
      },
      insights: [{ id: "weak:sicilian", kind: "weakness", color: "black", role: "plays", claim: "They score 42% in Sicilian Defense positions.", evidence: { stat: "3/7", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true } }, interpretation: "A reliable target.", recommendation: { action: "Target the Sicilian Defense." }, confidence: "medium_high", sampleSize: 7, baseline: { metric: "black", value: 0.5, delta: -0.08 } }],
      scoutBrief: [
        { id: "observed:expect:sicilian", sourceInsightId: "observed:expect:sicilian", kind: "opening_tendency", type: "expect", opponentColor: "black", colorPerspective: "white", finding: "Sicilian Defense is their most observed Black setup.", title: "Plan for the Sicilian Defense first.", action: { label: "With White, plan for the Sicilian Defense first.", legalLine: ["e4", "c5"], source: "explorerReference" }, whyItMatters: "e4 c5 appeared in 7 of 10 eligible Black games.", confidence: "medium_high", evidence: { stat: "7/10 eligible Black games", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true }, relevantGames: 7, parentGames: 10, sourceGameIds: [] } },
        { id: "observed:prepare:sicilian", sourceInsightId: "observed:prepare:sicilian", kind: "opening_tendency", type: "prepare", opponentColor: "black", colorPerspective: "white", finding: "The observed Sicilian Defense line is ready to rehearse.", title: "Prepare your response to the Sicilian Defense.", action: { label: "With White, rehearse the main response to the Sicilian Defense.", legalLine: ["e4", "c5"], source: "explorerReference" }, whyItMatters: "Rehearse e4 c5 before deciding on your first calm reply.", confidence: "medium_high", evidence: { stat: "7/10 eligible Black games", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true }, relevantGames: 7, parentGames: 10, sourceGameIds: [] } },
        { id: "observed:practice:sicilian", sourceInsightId: "observed:practice:sicilian", kind: "opening_tendency", type: "practice", opponentColor: "black", colorPerspective: "white", finding: "This is the most repeated Sicilian Defense position.", title: "Practice the main position.", action: { label: "With White, practice the observed Sicilian Defense position.", legalLine: ["e4", "c5"], source: "explorerReference" }, whyItMatters: "Set up e4 c5 and play the next move from memory.", confidence: "medium_high", evidence: { stat: "7/10 eligible Black games", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true }, relevantGames: 7, parentGames: 10, sourceGameIds: [] } },
      ],
    };
    render(<V3ScoutReportTab report={proReport} isDark={true} t={tokens} reportCacheKey="snapshot-key" />);
    expect(screen.getByText("Italian Game")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The 30-second plan" })).toBeTruthy();
    expect(screen.getByText("Expect")).toBeTruthy();
    expect(screen.getByText("Prepare")).toBeTruthy();
    expect(screen.getByText("Practice")).toBeTruthy();
    expect(screen.getByText("Expect these opening moves")).toBeTruthy();
    expect(screen.getAllByText("As White:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("scout-brief-as-white").className).toContain("scout-brief-move-label");
    expect(screen.getByText("1. e4")).toBeTruthy();
    expect(screen.getAllByText("As Black:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("scout-brief-as-black").className).toContain("scout-brief-move-label");
    expect(screen.getByText("1... c5")).toBeTruthy();
    expect(screen.queryByText("No high-confidence action yet")).toBeNull();
    expect(screen.queryByRole("link", { name: /View Pro/i })).toBeNull();
  });
});
