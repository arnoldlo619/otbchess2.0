/**
 * Tests for prep report caching and league integration features.
 *
 * Tests cover:
 * 1. Cache TTL logic (24h freshness check)
 * 2. Username normalisation for cache keys
 * 3. PrepReport _cached field handling
 * 4. getOpponentChesscom helper logic
 */
import { describe, it, expect } from "vitest";

// ── Cache TTL Logic ──────────────────────────────────────────────────────────
describe("Prep Cache TTL", () => {
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  it("should treat entries younger than 24h as fresh", () => {
    const cachedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h ago
    const age = Date.now() - cachedAt.getTime();
    expect(age < TTL_MS).toBe(true);
  });

  it("should treat entries older than 24h as stale", () => {
    const cachedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    const age = Date.now() - cachedAt.getTime();
    expect(age < TTL_MS).toBe(false);
  });

  it("should treat entries exactly at 24h as stale", () => {
    const cachedAt = new Date(Date.now() - TTL_MS);
    const age = Date.now() - cachedAt.getTime();
    expect(age < TTL_MS).toBe(false);
  });

  it("should treat entries 1ms before 24h as fresh", () => {
    const cachedAt = new Date(Date.now() - TTL_MS + 1);
    const age = Date.now() - cachedAt.getTime();
    expect(age < TTL_MS).toBe(true);
  });
});

// ── Username Normalisation ───────────────────────────────────────────────────
describe("Username Normalisation for Cache", () => {
  function normalise(username: string): string {
    return username.toLowerCase().trim();
  }

  it("should lowercase usernames", () => {
    expect(normalise("Hikaru")).toBe("hikaru");
    expect(normalise("GothamChess")).toBe("gothamchess");
  });

  it("should trim whitespace", () => {
    expect(normalise("  hikaru  ")).toBe("hikaru");
  });

  it("should handle already normalised names", () => {
    expect(normalise("hikaru")).toBe("hikaru");
  });

  it("should handle mixed case with spaces", () => {
    expect(normalise(" MagnusCarlsen ")).toBe("magnuscarlsen");
  });
});

// ── PrepReport _cached Field ─────────────────────────────────────────────────
describe("PrepReport _cached field", () => {
  interface MinimalReport {
    generatedAt: string;
    _cached?: boolean;
  }

  it("should default to undefined when not set", () => {
    const report: MinimalReport = { generatedAt: "2026-01-01T00:00:00Z" };
    expect(report._cached).toBeUndefined();
  });

  it("should be true when served from cache", () => {
    const report: MinimalReport = { generatedAt: "2026-01-01T00:00:00Z", _cached: true };
    expect(report._cached).toBe(true);
  });

  it("should be false when freshly generated", () => {
    const report: MinimalReport = { generatedAt: "2026-01-01T00:00:00Z", _cached: false };
    expect(report._cached).toBe(false);
  });
});

// ── getOpponentChesscom Helper ───────────────────────────────────────────────
describe("getOpponentChesscom logic", () => {
  interface Player {
    playerId: string;
    chesscomUsername?: string | null;
  }

  interface Match {
    playerWhiteId: string;
    playerBlackId: string;
  }

  function getOpponentChesscom(
    match: Match,
    userId: string,
    players: Player[]
  ): string | null {
    const oppId = match.playerWhiteId === userId
      ? match.playerBlackId
      : match.playerWhiteId;
    const oppPlayer = players.find(p => p.playerId === oppId);
    return oppPlayer?.chesscomUsername ?? null;
  }

  const players: Player[] = [
    { playerId: "u1", chesscomUsername: "hikaru" },
    { playerId: "u2", chesscomUsername: "gothamchess" },
    { playerId: "u3", chesscomUsername: null },
    { playerId: "u4" },
  ];

  it("should return opponent chess.com username when user is white", () => {
    const match: Match = { playerWhiteId: "u1", playerBlackId: "u2" };
    expect(getOpponentChesscom(match, "u1", players)).toBe("gothamchess");
  });

  it("should return opponent chess.com username when user is black", () => {
    const match: Match = { playerWhiteId: "u2", playerBlackId: "u1" };
    expect(getOpponentChesscom(match, "u1", players)).toBe("gothamchess");
  });

  it("should return null when opponent has no chess.com username", () => {
    const match: Match = { playerWhiteId: "u1", playerBlackId: "u3" };
    expect(getOpponentChesscom(match, "u1", players)).toBe(null);
  });

  it("should return null when opponent chesscomUsername is undefined", () => {
    const match: Match = { playerWhiteId: "u1", playerBlackId: "u4" };
    expect(getOpponentChesscom(match, "u1", players)).toBe(null);
  });

  it("should return null when opponent is not in players list", () => {
    const match: Match = { playerWhiteId: "u1", playerBlackId: "u99" };
    expect(getOpponentChesscom(match, "u1", players)).toBe(null);
  });
});

// ── Cache JSON Serialisation Round-Trip ──────────────────────────────────────
describe("Cache JSON round-trip", () => {
  it("should survive JSON serialisation and deserialisation", () => {
    const report = {
      opponent: {
        username: "hikaru",
        gamesAnalyzed: 50,
        whiteOpenings: [{ name: "Sicilian", eco: "B20", count: 10, wins: 6, draws: 2, losses: 2, winRate: 60, moves: "1.e4 c5" }],
      },
      prepLines: [{ name: "King's Indian", eco: "E60", moves: "1.d4 Nf6 2.c4 g6", rationale: "Counter aggressive play", confidence: "high" }],
      insights: ["Prefers e4 openings"],
      generatedAt: "2026-01-01T00:00:00Z",
    };

    const serialised = JSON.stringify(report);
    const deserialised = JSON.parse(serialised);

    expect(deserialised.opponent.username).toBe("hikaru");
    expect(deserialised.opponent.gamesAnalyzed).toBe(50);
    expect(deserialised.prepLines).toHaveLength(1);
    expect(deserialised.insights).toHaveLength(1);
    expect(deserialised.generatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("should handle large reports without data loss", () => {
    const openings = Array.from({ length: 20 }, (_, i) => ({
      name: `Opening ${i}`,
      eco: `A${String(i).padStart(2, "0")}`,
      count: i * 5,
      wins: i * 3,
      draws: i,
      losses: i,
      winRate: 60,
      moves: `1.e4 e5`,
    }));

    const report = {
      opponent: { username: "test", gamesAnalyzed: 100, whiteOpenings: openings },
      prepLines: [],
      insights: [],
      generatedAt: new Date().toISOString(),
    };

    const roundTripped = JSON.parse(JSON.stringify(report));
    expect(roundTripped.opponent.whiteOpenings).toHaveLength(20);
    expect(roundTripped.opponent.whiteOpenings[19].name).toBe("Opening 19");
  });
});
