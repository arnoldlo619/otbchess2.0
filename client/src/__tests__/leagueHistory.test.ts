/**
 * League Season History — tests for the history endpoint logic and frontend routing
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read source files for structural verification
const leaguesTs = readFileSync(resolve(__dirname, "../../../server/leagues.ts"), "utf-8");
const appTsx = readFileSync(resolve(__dirname, "../App.tsx"), "utf-8");
const historyPage = readFileSync(resolve(__dirname, "../pages/LeagueHistory.tsx"), "utf-8");
const dashboardPage = readFileSync(resolve(__dirname, "../pages/LeagueDashboard.tsx"), "utf-8");

describe("League Season History — Backend", () => {
  it("has a GET /:leagueId/history endpoint", () => {
    expect(leaguesTs).toContain('leaguesRouter.get("/:leagueId/history"');
  });

  it("returns league metadata in the history response", () => {
    expect(leaguesTs).toContain("league: {");
    expect(leaguesTs).toContain("league.name");
    expect(leaguesTs).toContain("league.description");
    expect(leaguesTs).toContain("league.status");
    expect(leaguesTs).toContain("league.formatType");
  });

  it("returns champion data", () => {
    expect(leaguesTs).toContain("champion:");
    expect(leaguesTs).toContain("champion.displayName");
    expect(leaguesTs).toContain("champion.points");
  });

  it("returns enriched standings with chess.com data", () => {
    expect(leaguesTs).toContain("enrichedStandings");
    expect(leaguesTs).toContain("chesscomUsername: player?.chesscomUsername");
    expect(leaguesTs).toContain("chesscomRating: player?.rating");
    expect(leaguesTs).toContain("gamesPlayed: s.wins + s.losses + s.draws");
  });

  it("builds head-to-head records from completed matches", () => {
    expect(leaguesTs).toContain("headToHead: h2h");
    expect(leaguesTs).toContain('h2h[w][b].wins++');
    expect(leaguesTs).toContain('h2h[b][w].losses++');
    expect(leaguesTs).toContain('h2h[w][b].draws++');
    expect(leaguesTs).toContain('h2h[b][w].draws++');
  });

  it("computes season stats (white wins, black wins, draws, percentages)", () => {
    expect(leaguesTs).toContain("seasonStats:");
    expect(leaguesTs).toContain("whiteWins");
    expect(leaguesTs).toContain("blackWins");
    expect(leaguesTs).toContain("whiteWinPct");
    expect(leaguesTs).toContain("blackWinPct");
    expect(leaguesTs).toContain("drawPct");
  });

  it("groups matches by week in the response", () => {
    expect(leaguesTs).toContain("weeks: weekResults");
    expect(leaguesTs).toContain("weekNumber: w.weekNumber");
  });

  it("is a public endpoint (no requireAuth)", () => {
    // The history endpoint should be publicly accessible
    const historyLine = leaguesTs.split("\n").find(l => l.includes('/:leagueId/history'));
    expect(historyLine).toBeDefined();
    expect(historyLine).not.toContain("requireAuth");
  });
});

describe("League Season History — Frontend Route", () => {
  it("has a lazy-loaded LeagueHistory page import", () => {
    expect(appTsx).toContain('const LeagueHistory = lazy(() => import("./pages/LeagueHistory"))');
  });

  it("registers the /leagues/:leagueId/history route", () => {
    expect(appTsx).toContain('/leagues/:leagueId/history');
    expect(appTsx).toContain("component={LeagueHistory}");
  });

  it("history route is registered BEFORE the catch-all league route", () => {
    const historyIdx = appTsx.indexOf("/leagues/:leagueId/history");
    const dashboardIdx = appTsx.indexOf('component={LeagueDashboard}');
    expect(historyIdx).toBeLessThan(dashboardIdx);
  });
});

describe("League Season History — Page Component", () => {
  it("fetches from /api/leagues/:leagueId/history", () => {
    expect(historyPage).toContain("/api/leagues/${leagueId}/history");
  });

  it("renders standings tab", () => {
    expect(historyPage).toContain('"standings"');
    expect(historyPage).toContain("s.rank");
    expect(historyPage).toContain("s.points");
  });

  it("renders rounds/weeks tab", () => {
    expect(historyPage).toContain('"weeks"');
    expect(historyPage).toContain("Round {w.weekNumber}");
  });

  it("renders head-to-head tab with player selector", () => {
    expect(historyPage).toContain('"h2h"');
    expect(historyPage).toContain("h2hPlayer");
    expect(historyPage).toContain("h2hRows");
    expect(historyPage).toContain("Select Player"); // actual label in LeagueHistory.tsx
  });

  it("renders stats tab with result distribution", () => {
    expect(historyPage).toContain('"stats"');
    expect(historyPage).toContain("seasonStats.whiteWins");
    expect(historyPage).toContain("seasonStats.blackWins");
    expect(historyPage).toContain("seasonStats.draws");
    expect(historyPage).toContain("Result Distribution");
  });

  it("displays champion banner for completed leagues", () => {
    expect(historyPage).toContain("Season Champion"); // actual label in LeagueHistory.tsx
    expect(historyPage).toContain("champion.displayName");
  });

  it("shows top performers section in stats", () => {
    expect(historyPage).toContain("Top Performers");
    // Top performers shows standings by points, not by named stat categories
    expect(historyPage).toContain("s.points");
    expect(historyPage).toContain("s.displayName");
  });

  it("has a back link to the league dashboard", () => {
    expect(historyPage).toContain("Back to League");
    expect(historyPage).toContain("/leagues/${leagueId}");
  });
});

describe("League Dashboard — History Link", () => {
  it("has a link to the full season history page", () => {
    expect(dashboardPage).toContain("View Full Season History");
    expect(dashboardPage).toContain("/leagues/${league.id}/history");
  });

  it("shows the history tab only for completed leagues", () => {
    expect(dashboardPage).toContain('league.status === "completed" ? [{ id: "history"');
  });
});
