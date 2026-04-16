/**
 * battleTrend.test.ts
 * Unit tests for computeWeeklyBattleTrend, computeTrendDelta, getWeekStart, formatWeekLabel.
 */

import { describe, it, expect } from "vitest";
import {
  computeWeeklyBattleTrend,
  computeTrendDelta,
  getWeekStart,
  formatWeekLabel,
} from "@/lib/battleTrend";
import type { ClubBattle } from "@/lib/clubBattleRegistry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a minimal completed ClubBattle with a given completedAt ISO string. */
function makeBattle(
  id: string,
  completedAt: string,
  result: "player_a" | "player_b" | "draw" = "player_a"
): ClubBattle {
  return {
    id,
    clubId: "club-1",
    playerAId: "alice",
    playerAName: "Alice",
    playerBId: "bob",
    playerBName: "Bob",
    status: "completed",
    result,
    createdAt: completedAt,
    completedAt,
  };
}

/** Monday 2026-03-16 (week of Mar 16) */
const MON_MAR_16 = new Date("2026-03-16T10:00:00.000Z");
/** Monday 2026-03-09 */
const _MON_MAR_09 = new Date("2026-03-09T10:00:00.000Z");
/** Monday 2026-02-16 (6 weeks before Mar 30) */
const _MON_FEB_16 = new Date("2026-02-16T10:00:00.000Z");

// ─── getWeekStart ─────────────────────────────────────────────────────────────

describe("getWeekStart", () => {
  it("returns the Monday for a Wednesday input", () => {
    const wed = new Date("2026-03-18T15:00:00.000Z"); // Wednesday
    const ws = getWeekStart(wed);
    expect(ws.getDay()).toBe(1); // Monday
    expect(ws.getDate()).toBe(16);
    expect(ws.getMonth()).toBe(2); // March (0-indexed)
  });

  it("returns the same day for a Monday input", () => {
    const mon = new Date("2026-03-16T08:00:00.000Z");
    const ws = getWeekStart(mon);
    expect(ws.getDay()).toBe(1);
    expect(ws.getDate()).toBe(16);
  });

  it("returns the previous Monday for a Sunday input", () => {
    const sun = new Date("2026-03-22T23:59:00.000Z"); // Sunday
    const ws = getWeekStart(sun);
    expect(ws.getDay()).toBe(1);
    expect(ws.getDate()).toBe(16); // Monday Mar 16
  });

  it("returns Monday at midnight (00:00:00)", () => {
    const thu = new Date("2026-03-19T18:30:00.000Z");
    const ws = getWeekStart(thu);
    expect(ws.getHours()).toBe(0);
    expect(ws.getMinutes()).toBe(0);
    expect(ws.getSeconds()).toBe(0);
  });
});

// ─── formatWeekLabel ──────────────────────────────────────────────────────────

describe("formatWeekLabel", () => {
  it("formats a date as 'Mon DD'", () => {
    const d = new Date("2026-03-16T00:00:00");
    const label = formatWeekLabel(d);
    expect(label).toMatch(/Mar\s+16/);
  });

  it("formats January correctly", () => {
    const d = new Date("2026-01-05T00:00:00");
    const label = formatWeekLabel(d);
    expect(label).toMatch(/Jan\s+5/);
  });
});

// ─── computeWeeklyBattleTrend — empty input ───────────────────────────────────

describe("computeWeeklyBattleTrend — empty input", () => {
  it("returns exactly N buckets when no battles exist", () => {
    const result = computeWeeklyBattleTrend([], 8, MON_MAR_16);
    expect(result).toHaveLength(8);
  });

  it("all buckets have zero totals when no battles", () => {
    const result = computeWeeklyBattleTrend([], 8, MON_MAR_16);
    result.forEach((b) => {
      expect(b.total).toBe(0);
      expect(b.wins).toBe(0);
      expect(b.draws).toBe(0);
      expect(b.losses).toBe(0);
    });
  });

  it("respects the weeks parameter", () => {
    expect(computeWeeklyBattleTrend([], 4, MON_MAR_16)).toHaveLength(4);
    expect(computeWeeklyBattleTrend([], 12, MON_MAR_16)).toHaveLength(12);
  });
});

// ─── computeWeeklyBattleTrend — single battle ─────────────────────────────────

describe("computeWeeklyBattleTrend — single battle", () => {
  it("counts a battle in the current week's bucket", () => {
    const now = new Date("2026-03-18T12:00:00.000Z"); // Wednesday of Mar 16 week
    const battle = makeBattle("b1", "2026-03-17T10:00:00.000Z"); // Tuesday same week
    const result = computeWeeklyBattleTrend([battle], 8, now);
    const lastBucket = result[result.length - 1];
    expect(lastBucket.total).toBe(1);
    expect(lastBucket.wins).toBe(1);
  });

  it("counts a battle in the correct prior week", () => {
    const now = new Date("2026-03-23T12:00:00.000Z"); // Monday Mar 23
    const battle = makeBattle("b1", "2026-03-10T10:00:00.000Z"); // Mar 10 = week of Mar 9
    const result = computeWeeklyBattleTrend([battle], 8, now);
    // Week of Mar 9 should be 2 weeks before Mar 23
    const bucket = result.find((b) => b.label.includes("Mar") && b.weekStart.getDate() === 9);
    expect(bucket).toBeDefined();
    expect(bucket!.total).toBe(1);
  });

  it("ignores battles outside the window", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    // Battle from 10 weeks ago — outside the 8-week window
    const battle = makeBattle("b1", "2026-01-12T10:00:00.000Z");
    const result = computeWeeklyBattleTrend([battle], 8, now);
    const total = result.reduce((s, b) => s + b.total, 0);
    expect(total).toBe(0);
  });

  it("ignores battles without completedAt", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    const battle: ClubBattle = {
      id: "b1",
      clubId: "club-1",
      playerAId: "alice",
      playerAName: "Alice",
      playerBId: "bob",
      playerBName: "Bob",
      status: "pending",
      createdAt: "2026-03-20T10:00:00.000Z",
    };
    const result = computeWeeklyBattleTrend([battle], 8, now);
    const total = result.reduce((s, b) => s + b.total, 0);
    expect(total).toBe(0);
  });
});

// ─── computeWeeklyBattleTrend — multiple battles ──────────────────────────────

describe("computeWeeklyBattleTrend — multiple battles", () => {
  it("correctly counts wins, draws, and losses", () => {
    // Use a Monday as 'now' so the current week bucket is well-defined
    const now = new Date("2026-03-16T12:00:00"); // local Monday Mar 16
    const battles: ClubBattle[] = [
      makeBattle("b1", "2026-03-16T10:00:00", "player_a"),
      makeBattle("b2", "2026-03-17T10:00:00", "player_b"),
      makeBattle("b3", "2026-03-18T10:00:00", "draw"),
    ];
    const result = computeWeeklyBattleTrend(battles, 8, now);
    // All 3 are in the current week (last bucket)
    const lastBucket = result[result.length - 1];
    expect(lastBucket.total).toBe(3);
    expect(lastBucket.wins).toBe(2); // player_a + player_b both count as "wins"
    expect(lastBucket.draws).toBe(1);
    expect(lastBucket.losses).toBe(0); // losses = total - wins - draws = 3 - 2 - 1 = 0
  });

  it("distributes battles across multiple weeks correctly", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    const battles: ClubBattle[] = [
      makeBattle("b1", "2026-03-17T10:00:00.000Z"), // week of Mar 16
      makeBattle("b2", "2026-03-10T10:00:00.000Z"), // week of Mar 9
      makeBattle("b3", "2026-03-03T10:00:00.000Z"), // week of Mar 2
    ];
    const result = computeWeeklyBattleTrend(battles, 8, now);
    const totalAcrossAll = result.reduce((s, b) => s + b.total, 0);
    expect(totalAcrossAll).toBe(3);
  });

  it("losses field equals total minus wins minus draws", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    const battles: ClubBattle[] = [
      makeBattle("b1", "2026-03-17T10:00:00.000Z", "player_a"),
      makeBattle("b2", "2026-03-17T11:00:00.000Z", "draw"),
    ];
    const result = computeWeeklyBattleTrend(battles, 8, now);
    result.forEach((b) => {
      expect(b.losses).toBe(b.total - b.wins - b.draws);
    });
  });
});

// ─── computeWeeklyBattleTrend — bucket ordering ───────────────────────────────

describe("computeWeeklyBattleTrend — bucket ordering", () => {
  it("returns buckets in chronological order (oldest first)", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    const result = computeWeeklyBattleTrend([], 8, now);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].weekStart.getTime()).toBeGreaterThan(
        result[i - 1].weekStart.getTime()
      );
    }
  });

  it("last bucket's weekStart is the current week's Monday", () => {
    const now = new Date("2026-03-19T12:00:00.000Z"); // Thursday
    const result = computeWeeklyBattleTrend([], 8, now);
    const last = result[result.length - 1];
    expect(last.weekStart.getDay()).toBe(1); // Monday
    expect(last.weekStart.getDate()).toBe(16); // Mar 16
  });
});

// ─── computeTrendDelta ────────────────────────────────────────────────────────

describe("computeTrendDelta", () => {
  it("returns null for fewer than 2 buckets", () => {
    const buckets = computeWeeklyBattleTrend([], 1, MON_MAR_16);
    expect(computeTrendDelta(buckets)).toBeNull();
  });

  it("returns null when older half has no data and newer half also has none", () => {
    const buckets = computeWeeklyBattleTrend([], 8, MON_MAR_16);
    expect(computeTrendDelta(buckets)).toBeNull();
  });

  it("returns 100 when older half is zero and newer half has activity", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    // Only battles in the last 4 weeks (newer half)
    const battles = [
      makeBattle("b1", "2026-03-17T10:00:00.000Z"),
      makeBattle("b2", "2026-03-10T10:00:00.000Z"),
    ];
    const buckets = computeWeeklyBattleTrend(battles, 8, now);
    const delta = computeTrendDelta(buckets);
    expect(delta).toBe(100);
  });

  it("returns a negative delta when activity is declining", () => {
    const now = new Date("2026-03-23T12:00:00.000Z");
    // Heavy activity 8-5 weeks ago, nothing in last 4 weeks
    const battles = [
      makeBattle("b1", "2026-01-26T10:00:00.000Z"),
      makeBattle("b2", "2026-02-02T10:00:00.000Z"),
      makeBattle("b3", "2026-02-09T10:00:00.000Z"),
      makeBattle("b4", "2026-02-16T10:00:00.000Z"),
    ];
    const buckets = computeWeeklyBattleTrend(battles, 8, now);
    const delta = computeTrendDelta(buckets);
    // Newer half avg = 0, older half avg > 0 → negative
    expect(delta).not.toBeNull();
    expect(delta!).toBeLessThan(0);
  });

  it("returns 0 when both halves have equal average activity", () => {
    // Use a local Monday as 'now' for deterministic week boundaries
    const now = new Date("2026-03-23T12:00:00"); // Monday Mar 23
    // Compute the 8 bucket week starts dynamically to ensure correct alignment
    const currentWS = getWeekStart(now);
    const weekDates: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(currentWS);
      ws.setDate(ws.getDate() - i * 7);
      // Use Wednesday of each week (safe mid-week)
      ws.setDate(ws.getDate() + 2);
      ws.setHours(10, 0, 0, 0);
      weekDates.push(ws.toISOString());
    }
    // 1 battle per week → avg 1 in both halves → delta = 0
    const battles = weekDates.map((d, i) => makeBattle(`b${i}`, d));
    const buckets = computeWeeklyBattleTrend(battles, 8, now);
    const delta = computeTrendDelta(buckets);
    expect(delta).toBe(0);
  });
});
