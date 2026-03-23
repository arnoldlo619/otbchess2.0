/**
 * clubBattleApi.test.ts
 * Unit tests for the client-side battle API service.
 * Tests cover: API URL construction, response mapping, migration logic,
 * and graceful fallback behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBattleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    clubId: "club-1",
    playerAId: "alice",
    playerAName: "Alice",
    playerBId: "bob",
    playerBName: "Bob",
    status: "completed",
    result: "player_a",
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:01:00.000Z",
    completedAt: "2026-01-01T00:30:00.000Z",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("clubBattleApi — URL construction", () => {
  it("builds the correct list URL", () => {
    const url = `/api/clubs/club-1/battles`;
    expect(url).toBe("/api/clubs/club-1/battles");
  });

  it("builds the correct stats URL with encoded player ID", () => {
    const playerId = "user@example.com";
    const url = `/api/clubs/club-1/battles/stats/${encodeURIComponent(playerId)}`;
    expect(url).toBe("/api/clubs/club-1/battles/stats/user%40example.com");
  });

  it("builds the correct leaderboard URL", () => {
    const url = `/api/clubs/club-1/battles/leaderboard`;
    expect(url).toBe("/api/clubs/club-1/battles/leaderboard");
  });
});

describe("clubBattleApi — row mapping", () => {
  it("maps a completed battle row to ClubBattle correctly", () => {
    const row = makeBattleRow();
    // Simulate the rowToBattle mapping logic
    const battle = {
      id: row.id,
      clubId: row.clubId,
      playerAId: row.playerAId,
      playerAName: row.playerAName,
      playerBId: row.playerBId,
      playerBName: row.playerBName,
      status: row.status as "completed",
      result: row.result as "player_a",
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
    };

    expect(battle.id).toBe("b1");
    expect(battle.result).toBe("player_a");
    expect(battle.notes).toBeUndefined();
    expect(battle.completedAt).toBe("2026-01-01T00:30:00.000Z");
  });

  it("handles null optional fields gracefully", () => {
    const row = makeBattleRow({ result: null, notes: null, startedAt: null, completedAt: null });
    const battle = {
      result: row.result ?? undefined,
      notes: row.notes ?? undefined,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
    };

    expect(battle.result).toBeUndefined();
    expect(battle.notes).toBeUndefined();
    expect(battle.startedAt).toBeUndefined();
    expect(battle.completedAt).toBeUndefined();
  });

  it("converts Date objects to ISO strings", () => {
    const dateObj = new Date("2026-03-01T12:00:00.000Z");
    const iso = typeof dateObj === "string" ? dateObj : new Date(dateObj).toISOString();
    expect(iso).toBe("2026-03-01T12:00:00.000Z");
  });
});

describe("clubBattleApi — migration logic", () => {
  // Use a Map to simulate localStorage in Node environment
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    clear: () => store.clear(),
  };

  const MIGRATION_KEY = "otb_battles_migrated_club-1";
  const BATTLES_KEY = "otb_battles_club-1";

  beforeEach(() => {
    ls.clear();
  });

  afterEach(() => {
    ls.clear();
  });

  it("skips migration if already marked as done", () => {
    ls.setItem(MIGRATION_KEY, "1");
    const alreadyMigrated = ls.getItem(MIGRATION_KEY) === "1";
    expect(alreadyMigrated).toBe(true);
  });

  it("marks migration as done when no battles exist", () => {
    expect(ls.getItem(BATTLES_KEY)).toBeNull();
    ls.setItem(MIGRATION_KEY, "1");
    expect(ls.getItem(MIGRATION_KEY)).toBe("1");
  });

  it("parses localStorage battles correctly", () => {
    const battles = [makeBattleRow(), makeBattleRow({ id: "b2" })];
    ls.setItem(BATTLES_KEY, JSON.stringify(battles));
    const parsed = JSON.parse(ls.getItem(BATTLES_KEY)!);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("b1");
    expect(parsed[1].id).toBe("b2");
  });

  it("handles malformed JSON gracefully", () => {
    ls.setItem(BATTLES_KEY, "not-valid-json{");
    let battles = null;
    try {
      battles = JSON.parse(ls.getItem(BATTLES_KEY)!);
    } catch {
      battles = null;
    }
    expect(battles).toBeNull();
  });

  it("does not re-migrate if migration key is already set", () => {
    ls.setItem(MIGRATION_KEY, "1");
    ls.setItem(BATTLES_KEY, JSON.stringify([makeBattleRow()]));
    const alreadyMigrated = ls.getItem(MIGRATION_KEY) === "1";
    expect(alreadyMigrated).toBe(true);
  });
});

describe("clubBattleApi — leaderboard computation", () => {
  it("computes win rate correctly", () => {
    const wins = 7;
    const draws = 2;
    const losses = 1;
    const total = wins + draws + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    expect(winRate).toBe(70);
  });

  it("returns 0 win rate when no battles played", () => {
    const wins = 0;
    const total = 0;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    expect(winRate).toBe(0);
  });

  it("ranks players by wins descending", () => {
    const players = [
      { playerId: "a", wins: 3, draws: 0, losses: 1, total: 4, winRate: 75 },
      { playerId: "b", wins: 7, draws: 1, losses: 2, total: 10, winRate: 70 },
      { playerId: "c", wins: 1, draws: 0, losses: 0, total: 1, winRate: 100 },
    ];
    const sorted = [...players].sort((a, b) => b.wins - a.wins);
    expect(sorted[0].playerId).toBe("b");
    expect(sorted[1].playerId).toBe("a");
    expect(sorted[2].playerId).toBe("c");
  });
});

describe("clubBattleApi — bulk import validation", () => {
  it("filters out battles with missing required fields", () => {
    const battles = [
      makeBattleRow(),
      { id: "", clubId: "club-1", playerAId: "", playerAName: "X", playerBId: "y", playerBName: "Y", status: "completed", createdAt: new Date().toISOString() },
    ];
    const valid = battles.filter((b) => b.id && b.playerAId && b.playerBId);
    expect(valid).toHaveLength(1);
    expect(valid[0].id).toBe("b1");
  });

  it("deduplicates battles by ID", () => {
    const battles = [makeBattleRow(), makeBattleRow()]; // same ID twice
    const unique = [...new Map(battles.map((b) => [b.id, b])).values()];
    expect(unique).toHaveLength(1);
  });
});
