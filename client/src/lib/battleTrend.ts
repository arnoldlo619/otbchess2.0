/**
 * battleTrend.ts
 * Helpers for computing weekly battle activity trends.
 * Used by the Analytics tab sparkline chart.
 */

import type { ClubBattle } from "./clubBattleRegistry";

export interface WeekBucket {
  /** ISO week label, e.g. "Mar 10" (Monday of that week) */
  label: string;
  /** Monday of the week as a Date */
  weekStart: Date;
  total: number;
  wins: number;   // player_a or player_b wins (any player)
  draws: number;
  losses: number; // same as wins from the other side — kept for symmetry
}

/**
 * Returns the Monday of the ISO week containing `date`.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a Date as "Mon DD" (e.g. "Mar 10").
 */
export function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Builds an array of WeekBucket objects for the last `weeks` ISO weeks
 * (including the current partial week), bucketing completed battles by
 * their `completedAt` timestamp.
 *
 * @param battles  All battles for the club (any status; only "completed" are counted)
 * @param weeks    Number of weeks to include (default 8)
 * @param now      Reference "now" date (injectable for testing)
 */
export function computeWeeklyBattleTrend(
  battles: ClubBattle[],
  weeks = 8,
  now: Date = new Date()
): WeekBucket[] {
  // Build the bucket array from oldest to newest
  const currentWeekStart = getWeekStart(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    buckets.push({
      label: formatWeekLabel(weekStart),
      weekStart,
      total: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    });
  }

  // Bucket completed battles
  const completed = battles.filter(
    (b) => b.status === "completed" && b.completedAt
  );
  for (const battle of completed) {
    const ts = new Date(battle.completedAt!);
    const ws = getWeekStart(ts);
    const bucket = buckets.find(
      (bk) => bk.weekStart.getTime() === ws.getTime()
    );
    if (!bucket) continue; // outside the window
    bucket.total++;
    if (battle.result === "draw") {
      bucket.draws++;
    } else if (battle.result === "player_a" || battle.result === "player_b") {
      bucket.wins++;
    }
    // losses = total - wins - draws (computed on read, not stored)
  }

  // Compute losses field for convenience
  for (const bk of buckets) {
    bk.losses = bk.total - bk.wins - bk.draws;
  }

  return buckets;
}

/**
 * Computes the percentage change between the average of the first half
 * and the average of the second half of the bucket array.
 * Returns null if there is no data in either half.
 */
export function computeTrendDelta(buckets: WeekBucket[]): number | null {
  if (buckets.length < 2) return null;
  const mid = Math.floor(buckets.length / 2);
  const older = buckets.slice(0, mid);
  const newer = buckets.slice(mid);
  const avgOlder = older.reduce((s, b) => s + b.total, 0) / older.length;
  const avgNewer = newer.reduce((s, b) => s + b.total, 0) / newer.length;
  if (avgOlder === 0) return avgNewer > 0 ? 100 : null;
  return Math.round(((avgNewer - avgOlder) / avgOlder) * 100);
}
