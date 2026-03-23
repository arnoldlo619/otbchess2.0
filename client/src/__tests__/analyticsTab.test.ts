/**
 * Analytics Tab — Battle Stats Computation Tests
 *
 * Tests cover:
 * 1. completedBattles filter (only status === "completed")
 * 2. activePlayers unique count from completed battles
 * 3. Per-member battle stats (wins, draws, losses, winRate)
 * 4. memberBattleStats sort order (by total desc) and slice (top 8)
 * 5. computePlayerOfMonth ranking logic (wins × 3 + winRate × 0.5)
 * 6. Edge cases: no battles, all draws, single player
 */

import { describe, it, expect } from "vitest";

// ── Types (mirrored from clubBattleRegistry) ──────────────────────────────────

type BattleStatus = "waiting" | "active" | "completed" | "cancelled";
type BattleResult = "player_a" | "player_b" | "draw" | null;

interface ClubBattle {
  id: string;
  clubId: string;
  playerAId: string;
  playerBId: string;
  status: BattleStatus;
  result: BattleResult;
  completedAt?: string;
  createdAt: string;
}

interface ClubMember {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: string;
  avatarUrl?: string;
}

// ── Helpers replicated from ClubDashboard analytics tab ──────────────────────

function computeCompletedBattles(battles: ClubBattle[]) {
  return battles.filter(b => b.status === "completed");
}

function computeActivePlayers(completedBattles: ClubBattle[]): number {
  return new Set([
    ...completedBattles.map(b => b.playerAId),
    ...completedBattles.map(b => b.playerBId),
  ]).size;
}

interface MemberBattleStat {
  memberId: string;
  name: string;
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

function computeMemberBattleStats(
  members: ClubMember[],
  completedBattles: ClubBattle[]
): MemberBattleStat[] {
  return members
    .map(m => {
      const myBattles = completedBattles.filter(
        b => b.playerAId === m.userId || b.playerBId === m.userId
      );
      const wins = myBattles.filter(
        b =>
          (b.result === "player_a" && b.playerAId === m.userId) ||
          (b.result === "player_b" && b.playerBId === m.userId)
      ).length;
      const draws = myBattles.filter(b => b.result === "draw").length;
      const losses = myBattles.length - wins - draws;
      const winRate =
        myBattles.length > 0 ? Math.round((wins / myBattles.length) * 100) : 0;
      return {
        memberId: m.userId,
        name: m.displayName,
        total: myBattles.length,
        wins,
        draws,
        losses,
        winRate,
      };
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

interface PotmEntry {
  memberId: string;
  memberName: string;
  battleWins: number;
  winRate: number;
  eventsAttended: number;
  score: number;
}

function computePlayerOfMonth(
  members: ClubMember[],
  battles: ClubBattle[],
  windowMs = 30 * 24 * 60 * 60 * 1000
): PotmEntry[] {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recentBattles = battles.filter(
    b =>
      b.status === "completed" &&
      b.completedAt &&
      new Date(b.completedAt).getTime() >= cutoff
  );

  return members
    .map(m => {
      const myBattles = recentBattles.filter(
        b => b.playerAId === m.userId || b.playerBId === m.userId
      );
      const wins = myBattles.filter(
        b =>
          (b.result === "player_a" && b.playerAId === m.userId) ||
          (b.result === "player_b" && b.playerBId === m.userId)
      ).length;
      const winRate =
        myBattles.length > 0 ? Math.round((wins / myBattles.length) * 100) : 0;
      const score = wins * 3 + winRate * 0.5;
      return {
        memberId: m.userId,
        memberName: m.displayName,
        battleWins: wins,
        winRate,
        eventsAttended: 0,
        score,
      };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ── Test data ─────────────────────────────────────────────────────────────────

const NOW_ISO = new Date().toISOString();
const RECENT_ISO = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
const OLD_ISO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

const MEMBERS: ClubMember[] = [
  { userId: "alice", displayName: "Alice", role: "member", joinedAt: NOW_ISO },
  { userId: "bob",   displayName: "Bob",   role: "member", joinedAt: NOW_ISO },
  { userId: "carol", displayName: "Carol", role: "member", joinedAt: NOW_ISO },
];

function makeBattle(
  id: string,
  playerAId: string,
  playerBId: string,
  result: BattleResult,
  completedAt?: string
): ClubBattle {
  return {
    id,
    clubId: "club1",
    playerAId,
    playerBId,
    status: result !== null ? "completed" : "active",
    result,
    completedAt,
    createdAt: NOW_ISO,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Analytics Tab — completedBattles filter", () => {
  it("includes only battles with status=completed", () => {
    const battles: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_a", RECENT_ISO),
      makeBattle("b2", "bob", "carol", null),
      { ...makeBattle("b3", "alice", "carol", "draw", RECENT_ISO), status: "cancelled" },
    ];
    const completed = computeCompletedBattles(battles);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe("b1");
  });

  it("returns empty array when no battles exist", () => {
    expect(computeCompletedBattles([])).toHaveLength(0);
  });
});

describe("Analytics Tab — activePlayers count", () => {
  it("counts unique players across completed battles", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob",   "player_a", RECENT_ISO),
      makeBattle("b2", "bob",   "carol", "player_b", RECENT_ISO),
      makeBattle("b3", "alice", "carol", "draw",     RECENT_ISO),
    ];
    expect(computeActivePlayers(completed)).toBe(3);
  });

  it("returns 0 when no completed battles", () => {
    expect(computeActivePlayers([])).toBe(0);
  });

  it("deduplicates players who appear in multiple battles", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_a", RECENT_ISO),
      makeBattle("b2", "alice", "bob", "player_b", RECENT_ISO),
      makeBattle("b3", "alice", "bob", "draw",     RECENT_ISO),
    ];
    expect(computeActivePlayers(completed)).toBe(2);
  });
});

describe("Analytics Tab — memberBattleStats", () => {
  it("computes wins, draws, losses, winRate correctly", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob",   "player_a", RECENT_ISO), // alice wins
      makeBattle("b2", "alice", "bob",   "player_b", RECENT_ISO), // bob wins
      makeBattle("b3", "alice", "bob",   "draw",     RECENT_ISO), // draw
      makeBattle("b4", "alice", "carol", "player_a", RECENT_ISO), // alice wins
    ];
    const stats = computeMemberBattleStats(MEMBERS, completed);

    const alice = stats.find(s => s.memberId === "alice")!;
    expect(alice.total).toBe(4);
    expect(alice.wins).toBe(2);   // b1 + b4
    expect(alice.draws).toBe(1);  // b3
    expect(alice.losses).toBe(1); // b2
    expect(alice.winRate).toBe(50);

    const bob = stats.find(s => s.memberId === "bob")!;
    expect(bob.total).toBe(3);
    expect(bob.wins).toBe(1);
    expect(bob.draws).toBe(1);
    expect(bob.losses).toBe(1);
    expect(bob.winRate).toBe(33);
  });

  it("excludes members with no battles", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_a", RECENT_ISO),
    ];
    const stats = computeMemberBattleStats(MEMBERS, completed);
    expect(stats.find(s => s.memberId === "carol")).toBeUndefined();
  });

  it("sorts by total battles descending", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob",   "player_a", RECENT_ISO),
      makeBattle("b2", "alice", "carol", "player_a", RECENT_ISO),
      makeBattle("b3", "alice", "bob",   "draw",     RECENT_ISO),
      makeBattle("b4", "bob",   "carol", "player_b", RECENT_ISO),
    ];
    const stats = computeMemberBattleStats(MEMBERS, completed);
    expect(stats[stats.length - 1].memberId).toBe("carol");
    expect(stats[0].total).toBeGreaterThanOrEqual(stats[1].total);
  });

  it("slices to top 8 members", () => {
    const manyMembers: ClubMember[] = Array.from({ length: 12 }, (_, i) => ({
      userId: `player${i}`,
      displayName: `Player ${i}`,
      role: "member",
      joinedAt: NOW_ISO,
    }));
    const battles: ClubBattle[] = manyMembers.flatMap((m, i) =>
      i < 11
        ? [makeBattle(`b${i}`, m.userId, manyMembers[i + 1].userId, "player_a", RECENT_ISO)]
        : []
    );
    const stats = computeMemberBattleStats(manyMembers, battles);
    expect(stats.length).toBeLessThanOrEqual(8);
  });

  it("handles all-draw battles (winRate = 0)", () => {
    const completed: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "draw", RECENT_ISO),
      makeBattle("b2", "alice", "bob", "draw", RECENT_ISO),
    ];
    const stats = computeMemberBattleStats(MEMBERS, completed);
    const alice = stats.find(s => s.memberId === "alice")!;
    expect(alice.wins).toBe(0);
    expect(alice.draws).toBe(2);
    expect(alice.winRate).toBe(0);
  });
});

describe("Analytics Tab — computePlayerOfMonth", () => {
  it("ranks by score (wins × 3 + winRate × 0.5)", () => {
    const battles: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_a", RECENT_ISO),
      makeBattle("b2", "alice", "bob", "player_a", RECENT_ISO),
      makeBattle("b3", "bob",   "carol", "player_a", RECENT_ISO),
    ];
    const ranked = computePlayerOfMonth(MEMBERS, battles);
    // alice: 2W/2 → 100% WR → score = 6 + 50 = 56
    // bob:   1W/3 → 33% WR  → score = 3 + 16.5 = 19.5
    expect(ranked[0].memberId).toBe("alice");
    expect(ranked[1].memberId).toBe("bob");
  });

  it("excludes players with score = 0 (no wins)", () => {
    const battles: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_b", RECENT_ISO),
    ];
    const ranked = computePlayerOfMonth(MEMBERS, battles);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].memberId).toBe("bob");
  });

  it("excludes battles older than 30 days", () => {
    const battles: ClubBattle[] = [
      makeBattle("b1", "alice", "bob", "player_a", OLD_ISO),
    ];
    expect(computePlayerOfMonth(MEMBERS, battles)).toHaveLength(0);
  });

  it("returns empty array when no battles exist", () => {
    expect(computePlayerOfMonth(MEMBERS, [])).toHaveLength(0);
  });

  it("counts only recent wins within the 30-day window", () => {
    const battles: ClubBattle[] = [
      makeBattle("b1", "alice", "bob",   "player_a", RECENT_ISO), // recent
      makeBattle("b2", "alice", "carol", "player_a", OLD_ISO),    // old — excluded
    ];
    const ranked = computePlayerOfMonth(MEMBERS, battles);
    expect(ranked[0].battleWins).toBe(1);
  });
});
