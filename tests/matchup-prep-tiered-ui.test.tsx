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
  openingSummary: { white: [{ name: "Italian Game", games: 8, share: 0.8, score: 0.5 }, { name: "London System", games: 2, share: 0.2, score: 0.5 }], black: [{ name: "Sicilian Defense", games: 7, share: 0.7, score: 0.43 }, { name: "Scandinavian Defense", games: 3, share: 0.3, score: 0.5 }] },
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
      insights: [{ id: "weak:sicilian", kind: "weakness", color: "black", role: "plays", claim: "They score 42% in Sicilian Defense positions.", evidence: { stat: "3/7", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true } }, interpretation: "A reliable target.", recommendation: { action: "Target the Sicilian Defense." }, confidence: "medium_high", sampleSize: 7, baseline: { metric: "black", value: 0.5, delta: -0.08 } }],
      scoutBrief: [{ id: "weak:sicilian", sourceInsightId: "weak:sicilian", kind: "weakness", type: "target", opponentColor: "black", colorPerspective: "white", finding: "They score 42% in Sicilian Defense positions.", title: "Target this underperforming line", action: { label: "With White, target the Sicilian Defense.", source: "recentEvidence" }, whyItMatters: "A reliable target.", confidence: "medium_high", evidence: { stat: "3/7", games: [], window: { from: "2026-01-01", to: "2026-09-01", timeClasses: ["rapid"], ratedOnly: true }, relevantGames: 7, sourceGameIds: [] } }],
    };
    render(<V3ScoutReportTab report={proReport} isDark={true} t={tokens} reportCacheKey="snapshot-key" />);
    expect(screen.getByText("Italian Game")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The 30-second plan" })).toBeTruthy();
    expect(screen.getAllByText("Target this underperforming line").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Practice")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View Pro/i })).toBeNull();
  });
});
