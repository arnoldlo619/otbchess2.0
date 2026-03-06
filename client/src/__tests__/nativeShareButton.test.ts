/**
 * Tests for the NativeShareButton share-text generation logic in Report.tsx.
 *
 * The NativeShareButton builds a plain-text share string from a
 * PlayerPerformance object. We test that string in isolation so we don't
 * need to render the full page or mock html2canvas.
 *
 * The logic under test (extracted from Report.tsx):
 *
 *   const rankLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
 *   const shareText = `I finished ${rankLabel} at ${tournamentName}! 🏆 ${points} pts · Perf ${performanceRating} · ${wins}W ${draws}D ${losses}L #OTBChess`;
 */

import { describe, it, expect } from "vitest";
import type { PlayerPerformance } from "@/lib/performanceStats";
import type { Player } from "@/lib/tournamentData";

// ─── Helpers replicated from Report.tsx NativeShareButton ─────────────────────

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function buildNativeShareText(perf: PlayerPerformance, tournamentName: string): string {
  return `I finished ${rankLabel(perf.rank)} at ${tournamentName}! 🏆 ${perf.points} pts · Perf ${perf.performanceRating} · ${perf.wins}W ${perf.draws}D ${perf.losses}L #OTBChess`;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Magnus Eriksson",
    username: "magnuserik",
    elo: 2241,
    title: "FM",
    country: "SE",
    points: 3.5,
    wins: 3,
    draws: 1,
    losses: 0,
    buchholz: 8.0,
    colorHistory: ["W", "B", "W"],
    platform: "chesscom",
    ...overrides,
  };
}

function makePerf(overrides: Partial<PlayerPerformance> = {}): PlayerPerformance {
  const player = makePlayer();
  return {
    player,
    rank: 1,
    totalPlayers: 8,
    points: 3.5,
    wins: 3,
    draws: 1,
    losses: 0,
    buchholz: 8.0,
    performanceRating: 2350,
    ratingChange: 109,
    bestWin: null,
    biggestUpset: null,
    longestStreak: 3,
    whiteGames: 2,
    blackGames: 2,
    badge: "champion",
    badgeLabel: "Champion",
    ...overrides,
  };
}

// ─── rankLabel ────────────────────────────────────────────────────────────────

describe("rankLabel", () => {
  it("returns '1st' for rank 1", () => {
    expect(rankLabel(1)).toBe("1st");
  });

  it("returns '2nd' for rank 2", () => {
    expect(rankLabel(2)).toBe("2nd");
  });

  it("returns '3rd' for rank 3", () => {
    expect(rankLabel(3)).toBe("3rd");
  });

  it("returns '4th' for rank 4", () => {
    expect(rankLabel(4)).toBe("4th");
  });

  it("returns '10th' for rank 10", () => {
    expect(rankLabel(10)).toBe("10th");
  });

  it("returns '11th' for rank 11", () => {
    expect(rankLabel(11)).toBe("11th");
  });
});

// ─── buildNativeShareText ─────────────────────────────────────────────────────

describe("buildNativeShareText", () => {
  it("includes the tournament name", () => {
    const perf = makePerf();
    const text = buildNativeShareText(perf, "Spring Open 2026");
    expect(text).toContain("Spring Open 2026");
  });

  it("includes the correct rank label for 1st place", () => {
    const perf = makePerf({ rank: 1 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("1st");
  });

  it("includes the correct rank label for 2nd place", () => {
    const perf = makePerf({ rank: 2 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("2nd");
  });

  it("includes the correct rank label for 3rd place", () => {
    const perf = makePerf({ rank: 3 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("3rd");
  });

  it("includes the correct rank label for 5th place", () => {
    const perf = makePerf({ rank: 5 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("5th");
  });

  it("includes the player's points", () => {
    const perf = makePerf({ points: 3.5 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("3.5 pts");
  });

  it("includes the performance rating", () => {
    const perf = makePerf({ performanceRating: 2350 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("Perf 2350");
  });

  it("includes wins, draws, losses in W/D/L format", () => {
    const perf = makePerf({ wins: 3, draws: 1, losses: 0 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("3W 1D 0L");
  });

  it("includes the #OTBChess hashtag", () => {
    const perf = makePerf();
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("#OTBChess");
  });

  it("includes the trophy emoji", () => {
    const perf = makePerf();
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("🏆");
  });

  it("produces correct full string for champion", () => {
    const perf = makePerf({ rank: 1, points: 4, wins: 4, draws: 0, losses: 0, performanceRating: 2400 });
    const text = buildNativeShareText(perf, "Club Championship");
    expect(text).toBe(
      "I finished 1st at Club Championship! 🏆 4 pts · Perf 2400 · 4W 0D 0L #OTBChess"
    );
  });

  it("produces correct full string for a mid-table finisher", () => {
    const perf = makePerf({ rank: 4, points: 2.5, wins: 2, draws: 1, losses: 2, performanceRating: 1950 });
    const text = buildNativeShareText(perf, "Weekend Blitz");
    expect(text).toBe(
      "I finished 4th at Weekend Blitz! 🏆 2.5 pts · Perf 1950 · 2W 1D 2L #OTBChess"
    );
  });

  it("handles zero points gracefully", () => {
    const perf = makePerf({ rank: 8, points: 0, wins: 0, draws: 0, losses: 4, performanceRating: 1400 });
    const text = buildNativeShareText(perf, "Test");
    expect(text).toContain("0 pts");
    expect(text).toContain("0W 0D 4L");
  });

  it("handles tournament names with special characters", () => {
    const perf = makePerf({ rank: 1 });
    const text = buildNativeShareText(perf, "Café Chess & Co.");
    expect(text).toContain("Café Chess & Co.");
  });
});
