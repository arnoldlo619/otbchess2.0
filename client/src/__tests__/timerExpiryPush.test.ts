/**
 * timerExpiryPush.test.ts
 *
 * Unit tests for the server-side timer expiry push scheduling logic.
 * We test the pure helper functions (delay calculation, payload construction)
 * that are used by the PUT /api/tournament/:id/timer endpoint.
 */

import { describe, it, expect } from "vitest";

// ─── Pure helpers mirroring the server logic ─────────────────────────────────

interface TimerSnapshot {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
}

/**
 * Calculates the milliseconds until the timer expires from `now`.
 * Returns a negative number if the timer has already expired.
 */
function calcExpiryDelayMs(snap: TimerSnapshot, now: number): number {
  const endWallMs = snap.startWallMs + snap.durationSec * 1000 - snap.elapsedAtPauseMs;
  return endWallMs - now;
}

/**
 * Returns true if a new expiry timeout should be scheduled.
 */
function shouldScheduleExpiry(snap: TimerSnapshot, now: number): boolean {
  if (snap.status !== "running") return false;
  if (snap.startWallMs <= 0 || snap.durationSec <= 0) return false;
  return calcExpiryDelayMs(snap, now) > 0;
}

/**
 * Builds the Web Push payload for a timer expiry notification.
 */
function buildExpiryPayload(tournamentId: string, tournamentName: string, round: number) {
  return {
    title: `⏰ Time's Up — Round ${round}`,
    body: `${tournamentName} — Report your result to the director at the registration table.`,
    tag: `otb-timer-expired-${tournamentId}-${round}`,
    url: `/tournament/${tournamentId}`,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calcExpiryDelayMs", () => {
  const now = Date.now();

  it("returns a positive delay for a timer that has not yet expired", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 60,
      startWallMs: now,
      elapsedAtPauseMs: 0,
      savedAt: now,
    };
    const delay = calcExpiryDelayMs(snap, now);
    expect(delay).toBeCloseTo(60_000, -2); // within 100ms
  });

  it("returns a negative delay for a timer that has already expired", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 60,
      startWallMs: now - 90_000, // started 90 seconds ago
      elapsedAtPauseMs: 0,
      savedAt: now - 90_000,
    };
    expect(calcExpiryDelayMs(snap, now)).toBeLessThan(0);
  });

  it("accounts for elapsed time at pause when calculating delay", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 60,
      startWallMs: now,
      elapsedAtPauseMs: 30_000, // 30 seconds already consumed before this start
      savedAt: now,
    };
    const delay = calcExpiryDelayMs(snap, now);
    expect(delay).toBeCloseTo(30_000, -2); // only 30 seconds remain
  });

  it("returns zero delay when timer expires exactly now", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 60,
      startWallMs: now - 60_000,
      elapsedAtPauseMs: 0,
      savedAt: now - 60_000,
    };
    expect(calcExpiryDelayMs(snap, now)).toBeCloseTo(0, -1);
  });
});

describe("shouldScheduleExpiry", () => {
  const now = Date.now();

  it("returns true for a running timer that has not yet expired", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 300,
      startWallMs: now,
      elapsedAtPauseMs: 0,
      savedAt: now,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(true);
  });

  it("returns false for a paused timer", () => {
    const snap: TimerSnapshot = {
      status: "paused",
      durationSec: 300,
      startWallMs: now - 60_000,
      elapsedAtPauseMs: 60_000,
      savedAt: now,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(false);
  });

  it("returns false for an idle timer", () => {
    const snap: TimerSnapshot = {
      status: "idle",
      durationSec: 0,
      startWallMs: 0,
      elapsedAtPauseMs: 0,
      savedAt: now,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(false);
  });

  it("returns false for an expired timer", () => {
    const snap: TimerSnapshot = {
      status: "expired",
      durationSec: 60,
      startWallMs: now - 90_000,
      elapsedAtPauseMs: 0,
      savedAt: now,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(false);
  });

  it("returns false when the timer has already passed its end time", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 60,
      startWallMs: now - 120_000, // started 2 minutes ago
      elapsedAtPauseMs: 0,
      savedAt: now - 120_000,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(false);
  });

  it("returns false when durationSec is zero", () => {
    const snap: TimerSnapshot = {
      status: "running",
      durationSec: 0,
      startWallMs: now,
      elapsedAtPauseMs: 0,
      savedAt: now,
    };
    expect(shouldScheduleExpiry(snap, now)).toBe(false);
  });
});

describe("buildExpiryPayload", () => {
  it("includes the correct title with round number", () => {
    const p = buildExpiryPayload("t123", "Club Championship", 3);
    expect(p.title).toBe("⏰ Time's Up — Round 3");
  });

  it("includes the tournament name and director instruction in the body", () => {
    const p = buildExpiryPayload("t123", "Club Championship", 3);
    expect(p.body).toContain("Club Championship");
    expect(p.body).toContain("director");
  });

  it("generates a unique tag per tournament and round", () => {
    const p1 = buildExpiryPayload("t123", "A", 1);
    const p2 = buildExpiryPayload("t123", "A", 2);
    const p3 = buildExpiryPayload("t456", "A", 1);
    expect(p1.tag).not.toBe(p2.tag);
    expect(p1.tag).not.toBe(p3.tag);
  });

  it("sets the url to the spectator view for the tournament", () => {
    const p = buildExpiryPayload("t123", "A", 1);
    expect(p.url).toBe("/tournament/t123");
  });
});
