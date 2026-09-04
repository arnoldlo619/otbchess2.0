/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { V3ScoutReportTab } from "../client/src/components/prep/V3ScoutReportTab";
import type { ScoutReportV3 } from "../shared/prepTypes";

const tokens = { card: "card", cardSubtle: "subtle", textPrimary: "primary", textSecondary: "secondary", textTertiary: "tertiary", divider: "divider", monoBlock: "mono" };

function report(): ScoutReportV3 {
  return {
    version: 3, engineVersion: "test", provider: "chesscom", generatedAt: "2026-08-27T00:00:00.000Z", freshness: "usable",
    opponent: { username: "fixture", record: { white: { w: 5, d: 1, l: 4 }, black: { w: 4, d: 1, l: 2 } }, avgRating: 1800, timeControlSplit: { rapid: { games: 8, score: 0.5 } } },
    dataQuality: { requested: 30, fetched: 8, parsed: 8, quarantined: 0, excluded: {}, ratedShare: 1, window: { from: "2026-08-01", to: "2026-08-27" }, grade: "B", freshness: "usable", notes: [] },
    openingForecast: { white: [], black: [] }, access: { tier: "pro", detailedInsightsAvailable: true }, scoutBrief: [], sections: { matchupSummary: [], strengths: [], weaknesses: [], weakSignals: [], ifYouHaveWhite: [], ifYouHaveBlack: [], deviationPoints: [], behavior: [], prepChecklist: [] }, guardLog: { droppedInsights: 0, reasons: {} },
    insights: [{ id: "supporting", kind: "opening_tendency", color: "black", role: "plays", claim: "Observed supporting fact.", interpretation: "Supporting only.", confidence: "medium", sampleSize: 6, evidence: { stat: "6/8", games: [], window: { from: "2026-08-01", to: "2026-08-27", timeClasses: ["rapid"], ratedOnly: true } }, recommendation: { action: "Rehearse the line.", line: { san: "1. e4 e5", validated: true } } }],
    reportSnapshot: { id: "snapshot", createdAt: "2026-08-27T00:00:00.000Z", activeRequest: { platform: "chesscom", normalizedUsername: "fixture", displayUsername: "fixture", myColor: "white", formats: ["rapid"], mode: "standard", maxGames: 30, schemaVersion: "launch-2", requestedAt: "2026-08-27T00:00:00.000Z" } },
  };
}

afterEach(cleanup);

describe("Scout Brief evidence disclosure", () => {
  it("is collapsed by default and exposes accessible expanded state when toggled", async () => {
    render(<V3ScoutReportTab report={report()} isDark t={tokens} reportCacheKey="snapshot" />);
    const summary = screen.getByText("Evidence summary").closest("summary");
    const details = summary?.closest("details");
    expect(summary?.getAttribute("aria-expanded")).toBe("false");
    expect(details?.open).toBe(false);
    fireEvent.click(summary!);
    await waitFor(() => expect(summary?.getAttribute("aria-expanded")).toBe("true"));
    expect(details?.open).toBe(true);
    expect(screen.getByText("Observed supporting fact.")).toBeTruthy();
    fireEvent.click(summary!);
    await waitFor(() => expect(summary?.getAttribute("aria-expanded")).toBe("false"));
    expect(details?.open).toBe(false);
  });
});
