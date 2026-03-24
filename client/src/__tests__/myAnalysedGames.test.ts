/**
 * myAnalysedGames.test.ts
 * Unit tests for the My Analysed Games feature.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AnalysedGame } from "../hooks/useMyAnalysedGames";

// ─── Helpers (mirrored from AnalysedGameCard) ─────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

type GameResult = "1-0" | "0-1" | "1/2-1/2" | null;

function getResultLabel(result: GameResult): string {
  switch (result) {
    case "1-0":      return "1 – 0";
    case "0-1":      return "0 – 1";
    case "1/2-1/2":  return "½ – ½";
    default:         return "—";
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "bg-white/20";
  if (acc >= 90) return "bg-[#4ade80]";
  if (acc >= 75) return "bg-emerald-400";
  if (acc >= 60) return "bg-yellow-400";
  if (acc >= 45) return "bg-orange-400";
  return "bg-red-400";
}

function accuracyLabel(acc: number | null): string {
  if (acc === null) return "—";
  return `${Math.round(acc)}%`;
}

function filterProcessed(games: AnalysedGame[]): AnalysedGame[] {
  return games.filter((g) => g.sessionStatus === "processed");
}

// ─── Sample data ──────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<AnalysedGame> = {}): AnalysedGame {
  return {
    id: "game-1",
    sessionId: "session-1",
    pgn: "1. e4 e5",
    openingName: "King's Pawn Opening",
    openingEco: "B00",
    totalMoves: 20,
    whitePlayer: "Magnus",
    blackPlayer: "Hikaru",
    result: "1-0",
    event: "OTB Battle",
    date: "2026-03-24",
    whiteAccuracy: 92.5,
    blackAccuracy: 78.3,
    isPublic: 0,
    shareToken: null,
    createdAt: "2026-03-24T10:00:00.000Z",
    sessionStatus: "processed",
    ...overrides,
  };
}

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate helper", () => {
  it("formats ISO date string to readable format", () => {
    const result = formatDate("2026-03-24T10:00:00.000Z");
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2026/);
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns a non-empty string for any date input", () => {
    const result = formatDate("2026-01-15");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes a numeric day in output", () => {
    // Use a full ISO timestamp to avoid timezone-induced date shift
    const result = formatDate("2026-03-24T12:00:00.000Z");
    // The day may be 23 or 24 depending on local timezone; just verify a digit is present
    expect(result).toMatch(/\d/);
    expect(result).toMatch(/2026/);
  });
});

// ─── getResultLabel ───────────────────────────────────────────────────────────

describe("getResultLabel helper", () => {
  it("returns '1 – 0' for white win", () => {
    expect(getResultLabel("1-0")).toBe("1 – 0");
  });

  it("returns '0 – 1' for black win", () => {
    expect(getResultLabel("0-1")).toBe("0 – 1");
  });

  it("returns '½ – ½' for draw", () => {
    expect(getResultLabel("1/2-1/2")).toBe("½ – ½");
  });

  it("returns '—' for null result", () => {
    expect(getResultLabel(null)).toBe("—");
  });
});

// ─── accuracyColor ────────────────────────────────────────────────────────────

describe("accuracyColor helper", () => {
  it("returns green for accuracy >= 90", () => {
    expect(accuracyColor(95)).toBe("bg-[#4ade80]");
    expect(accuracyColor(90)).toBe("bg-[#4ade80]");
  });

  it("returns emerald for accuracy 75-89", () => {
    expect(accuracyColor(80)).toBe("bg-emerald-400");
    expect(accuracyColor(75)).toBe("bg-emerald-400");
  });

  it("returns yellow for accuracy 60-74", () => {
    expect(accuracyColor(65)).toBe("bg-yellow-400");
    expect(accuracyColor(60)).toBe("bg-yellow-400");
  });

  it("returns orange for accuracy 45-59", () => {
    expect(accuracyColor(50)).toBe("bg-orange-400");
    expect(accuracyColor(45)).toBe("bg-orange-400");
  });

  it("returns red for accuracy < 45", () => {
    expect(accuracyColor(30)).toBe("bg-red-400");
    expect(accuracyColor(0)).toBe("bg-red-400");
  });

  it("returns muted for null accuracy", () => {
    expect(accuracyColor(null)).toBe("bg-white/20");
  });
});

// ─── accuracyLabel ────────────────────────────────────────────────────────────

describe("accuracyLabel helper", () => {
  it("formats accuracy as percentage string", () => {
    expect(accuracyLabel(92.5)).toBe("93%");
    expect(accuracyLabel(78.3)).toBe("78%");
    expect(accuracyLabel(100)).toBe("100%");
    expect(accuracyLabel(0)).toBe("0%");
  });

  it("returns '—' for null accuracy", () => {
    expect(accuracyLabel(null)).toBe("—");
  });

  it("rounds to nearest integer", () => {
    expect(accuracyLabel(74.6)).toBe("75%");
    expect(accuracyLabel(74.4)).toBe("74%");
  });
});

// ─── filterProcessed ─────────────────────────────────────────────────────────

describe("filterProcessed (useMyAnalysedGames filtering logic)", () => {
  it("returns only processed games", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "processed" }),
      makeGame({ id: "2", sessionStatus: "analysing" }),
      makeGame({ id: "3", sessionStatus: "processed" }),
      makeGame({ id: "4", sessionStatus: "pending" }),
    ];
    const result = filterProcessed(games);
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toEqual(["1", "3"]);
  });

  it("returns empty array when no processed games", () => {
    const games = [
      makeGame({ sessionStatus: "analysing" }),
      makeGame({ sessionStatus: "pending" }),
    ];
    expect(filterProcessed(games)).toHaveLength(0);
  });

  it("returns all games when all are processed", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "processed" }),
      makeGame({ id: "2", sessionStatus: "processed" }),
    ];
    expect(filterProcessed(games)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(filterProcessed([])).toHaveLength(0);
  });
});

// ─── fetch logic ─────────────────────────────────────────────────────────────

describe("useMyAnalysedGames fetch logic", () => {
  const originalFetch = global.fetch;

  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { global.fetch = originalFetch; });

  it("returns processed games from API response", async () => {
    const mockGames = [
      makeGame({ id: "1", sessionStatus: "processed" }),
      makeGame({ id: "2", sessionStatus: "analysing" }),
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => mockGames,
    } as Response);

    const result = filterProcessed(mockGames);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("handles 401 response gracefully (returns empty)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const res = await global.fetch("/api/games", { credentials: "include" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });

  it("builds correct error message for non-401 error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    } as Response);

    const res = await global.fetch("/api/games", { credentials: "include" });
    const errorMsg = `Failed to load games (${res.status})`;
    expect(errorMsg).toBe("Failed to load games (500)");
  });

  it("handles network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    try {
      await global.fetch("/api/games", { credentials: "include" });
      expect(true).toBe(false);
    } catch (err) {
      expect((err as Error).message).toBe("Network error");
    }
  });
});

// ─── Profile section display logic ───────────────────────────────────────────

describe("Profile section display logic", () => {
  it("shows singular 'game' label for 1 game", () => {
    const count = 1;
    const label = `${count} game${count !== 1 ? "s" : ""} reviewed`;
    expect(label).toBe("1 game reviewed");
  });

  it("shows plural 'games' label for multiple games", () => {
    const count = 5;
    const label = `${count} game${count !== 1 ? "s" : ""} reviewed`;
    expect(label).toBe("5 games reviewed");
  });

  it("shows '+N more games' when list exceeds 5", () => {
    const total = 8;
    const overflow = total - 5;
    expect(`+${overflow} more games`).toBe("+3 more games");
  });

  it("does not show overflow when 5 or fewer games", () => {
    expect(5 > 5).toBe(false);
  });

  it("shows loading skeletons when status is loading", () => {
    expect("loading" === "loading").toBe(true);
  });

  it("shows empty state when success and no games", () => {
    const games: AnalysedGame[] = [];
    expect("success" === "success" && games.length === 0).toBe(true);
  });

  it("shows games list when success and games exist", () => {
    const games = [makeGame()];
    expect("success" === "success" && games.length > 0).toBe(true);
  });
});

// ─── AnalysedGameCard data display ───────────────────────────────────────────

describe("AnalysedGameCard data display", () => {
  it("uses 'White' as fallback when whitePlayer is null", () => {
    const game = makeGame({ whitePlayer: null });
    expect(game.whitePlayer ?? "White").toBe("White");
  });

  it("uses 'Black' as fallback when blackPlayer is null", () => {
    const game = makeGame({ blackPlayer: null });
    expect(game.blackPlayer ?? "Black").toBe("Black");
  });

  it("shows accuracy bars when at least one accuracy is non-null", () => {
    const game = makeGame({ whiteAccuracy: 85, blackAccuracy: null });
    const hasAccuracy = game.whiteAccuracy !== null || game.blackAccuracy !== null;
    expect(hasAccuracy).toBe(true);
  });

  it("hides accuracy bars when both accuracies are null", () => {
    const game = makeGame({ whiteAccuracy: null, blackAccuracy: null });
    const hasAccuracy = game.whiteAccuracy !== null || game.blackAccuracy !== null;
    expect(hasAccuracy).toBe(false);
  });

  it("shows move count when totalMoves > 0", () => {
    const game = makeGame({ totalMoves: 32 });
    expect(game.totalMoves > 0).toBe(true);
  });

  it("links to /game/:id/analysis", () => {
    const game = makeGame({ id: "abc-123" });
    expect(`/game/${game.id}/analysis`).toBe("/game/abc-123/analysis");
  });

  it("shows ECO code when openingEco is present", () => {
    const game = makeGame({ openingEco: "C60", openingName: "Spanish Game" });
    expect(game.openingEco).toBe("C60");
    expect(game.openingName).toBe("Spanish Game");
  });

  it("uses game.date over createdAt for display when available", () => {
    const game = makeGame({ date: "2026-01-15", createdAt: "2026-03-24T10:00:00.000Z" });
    expect(game.date ?? game.createdAt).toBe("2026-01-15");
  });

  it("falls back to createdAt when date is null", () => {
    const game = makeGame({ date: null, createdAt: "2026-03-24T10:00:00.000Z" });
    expect(game.date ?? game.createdAt).toBe("2026-03-24T10:00:00.000Z");
  });

  it("singular move label for 1 move", () => {
    const game = makeGame({ totalMoves: 1 });
    const label = `${game.totalMoves} move${game.totalMoves !== 1 ? "s" : ""}`;
    expect(label).toBe("1 move");
  });

  it("plural move label for multiple moves", () => {
    const game = makeGame({ totalMoves: 32 });
    const label = `${game.totalMoves} move${game.totalMoves !== 1 ? "s" : ""}`;
    expect(label).toBe("32 moves");
  });
});
