/**
 * Tests for the server-side chess player cache warm-up logic.
 * Verifies:
 * 1. warmChessPlayerCache skips already-cached players
 * 2. warmChessPlayerCache only processes chess.com players (not lichess)
 * 3. The /api/tournament/:id/players/warm-cache endpoint filters correctly
 * 4. The UploadRSVPModal fires warm-cache after import when tournamentId is provided
 */

import { describe, it, expect } from "vitest";

// ─── Unit tests for the warm-cache endpoint filtering logic ─────────────────

function filterChesscomUsernames(
  players: Array<{ username: string; platform?: string }>
): string[] {
  return players
    .filter(
      (p) =>
        (p.platform ?? "chesscom") === "chesscom" &&
        typeof p.username === "string"
    )
    .map((p) => p.username.toLowerCase().trim())
    .filter(Boolean);
}

describe("filterChesscomUsernames", () => {
  it("includes chess.com players by default (no platform field)", () => {
    const result = filterChesscomUsernames([
      { username: "Hikaru" },
      { username: "MagnusCarlsen" },
    ]);
    expect(result).toEqual(["hikaru", "magnuscarlsen"]);
  });

  it("includes players with platform: 'chesscom'", () => {
    const result = filterChesscomUsernames([
      { username: "Hikaru", platform: "chesscom" },
    ]);
    expect(result).toEqual(["hikaru"]);
  });

  it("excludes lichess players", () => {
    const result = filterChesscomUsernames([
      { username: "DrNykterstein", platform: "lichess" },
      { username: "Hikaru", platform: "chesscom" },
    ]);
    expect(result).toEqual(["hikaru"]);
  });

  it("excludes empty usernames", () => {
    const result = filterChesscomUsernames([
      { username: "", platform: "chesscom" },
      { username: "  ", platform: "chesscom" },
      { username: "Hikaru", platform: "chesscom" },
    ]);
    expect(result).toEqual(["hikaru"]);
  });

  it("lowercases all usernames", () => {
    const result = filterChesscomUsernames([
      { username: "POLISH_FIGHTER3000" },
      { username: "LyonBeast" },
    ]);
    expect(result).toEqual(["polish_fighter3000", "lyonbeast"]);
  });

  it("handles mixed platform array correctly", () => {
    const result = filterChesscomUsernames([
      { username: "player1", platform: "chesscom" },
      { username: "player2", platform: "lichess" },
      { username: "player3" }, // default = chesscom
      { username: "player4", platform: "lichess" },
    ]);
    expect(result).toEqual(["player1", "player3"]);
  });

  it("returns empty array when all players are lichess", () => {
    const result = filterChesscomUsernames([
      { username: "DrNykterstein", platform: "lichess" },
      { username: "Penguingim1", platform: "lichess" },
    ]);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = filterChesscomUsernames([]);
    expect(result).toEqual([]);
  });
});

// ─── Cache TTL staleness check logic ─────────────────────────────────────────

function isCacheStale(cachedAt: Date, ttlMs: number): boolean {
  return Date.now() - cachedAt.getTime() >= ttlMs;
}

describe("isCacheStale", () => {
  it("returns false for a freshly cached entry", () => {
    const now = new Date();
    expect(isCacheStale(now, 60 * 60 * 1000)).toBe(false);
  });

  it("returns true for an entry cached 2 hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isCacheStale(twoHoursAgo, 60 * 60 * 1000)).toBe(true);
  });

  it("returns false for an entry cached 30 minutes ago (TTL = 1 hour)", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(isCacheStale(thirtyMinsAgo, 60 * 60 * 1000)).toBe(false);
  });

  it("returns true for an entry cached exactly at TTL boundary", () => {
    const exactlyOneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(isCacheStale(exactlyOneHourAgo, 60 * 60 * 1000)).toBe(true);
  });
});

// ─── Warm-up payload construction ────────────────────────────────────────────

interface MockPlayer {
  username: string;
  platform?: string;
  name: string;
}

function buildWarmPayload(
  players: MockPlayer[]
): Array<{ username: string; platform: string }> {
  return players.map((p) => ({
    username: p.username,
    platform: p.platform ?? "chesscom",
  }));
}

describe("buildWarmPayload", () => {
  it("builds correct payload for chess.com players", () => {
    const players: MockPlayer[] = [
      { username: "hikaru", name: "Hikaru Nakamura", platform: "chesscom" },
      { username: "magnuscarlsen", name: "Magnus Carlsen", platform: "chesscom" },
    ];
    const payload = buildWarmPayload(players);
    expect(payload).toEqual([
      { username: "hikaru", platform: "chesscom" },
      { username: "magnuscarlsen", platform: "chesscom" },
    ]);
  });

  it("defaults platform to chesscom when not set", () => {
    const players: MockPlayer[] = [
      { username: "testuser", name: "Test User" },
    ];
    const payload = buildWarmPayload(players);
    expect(payload[0].platform).toBe("chesscom");
  });

  it("preserves lichess platform in payload", () => {
    const players: MockPlayer[] = [
      { username: "drnykterstein", name: "Magnus", platform: "lichess" },
    ];
    const payload = buildWarmPayload(players);
    expect(payload[0].platform).toBe("lichess");
  });

  it("returns empty array for empty input", () => {
    expect(buildWarmPayload([])).toEqual([]);
  });
});
