/**
 * Unit tests for SpectatorTimerBanner helpers
 *
 * Tests the pure helper functions extracted from the component:
 *   - formatMmSs: formats seconds into MM:SS
 *   - calcRemaining: computes remaining seconds from a TimerSnapshot
 *   - visual state derivation: isExpired, isNearEnd, isVeryLow
 */
import {describe, it, expect} from "vitest";

// ── Helpers (duplicated from component for testability) ───────────────────────

interface TimerSnap {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
}

function formatMmSs(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function calcRemaining(snap: TimerSnap, nowMs?: number): number {
  const now = nowMs ?? Date.now();
  if (snap.status === "paused" || snap.status === "expired") {
    return Math.max(0, snap.durationSec - snap.elapsedAtPauseMs / 1000);
  }
  if (snap.status === "running") {
    const elapsed = (now - snap.startWallMs) / 1000 + snap.elapsedAtPauseMs / 1000;
    return Math.max(0, snap.durationSec - elapsed);
  }
  return snap.durationSec;
}

function deriveState(snap: TimerSnap, remainingSec: number) {
  const isExpired = snap.status === "expired" || remainingSec <= 0;
  const isPaused = snap.status === "paused";
  const isNearEnd = !isExpired && !isPaused && remainingSec <= 300;
  const isVeryLow = !isExpired && !isPaused && remainingSec <= 60;
  const progress = snap.durationSec > 0 ? Math.max(0, remainingSec / snap.durationSec) : 0;
  return { isExpired, isPaused, isNearEnd, isVeryLow, progress };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("formatMmSs", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(formatMmSs(0)).toBe("00:00");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(formatMmSs(90)).toBe("01:30");
  });

  it("formats 3600 seconds as 60:00", () => {
    expect(formatMmSs(3600)).toBe("60:00");
  });

  it("formats 1800 seconds as 30:00", () => {
    expect(formatMmSs(1800)).toBe("30:00");
  });

  it("clamps negative values to 00:00", () => {
    expect(formatMmSs(-5)).toBe("00:00");
  });

  it("floors fractional seconds", () => {
    expect(formatMmSs(59.9)).toBe("00:59");
  });
});

describe("calcRemaining", () => {
  const NOW = 1_700_000_000_000;

  it("returns durationSec for idle snapshot", () => {
    const snap: TimerSnap = {
      status: "idle",
      durationSec: 1800,
      startWallMs: 0,
      elapsedAtPauseMs: 0,
      savedAt: NOW,
    };
    expect(calcRemaining(snap, NOW)).toBe(1800);
  });

  it("computes remaining for a running timer with no prior elapsed", () => {
    const snap: TimerSnap = {
      status: "running",
      durationSec: 1800,
      startWallMs: NOW - 300_000, // started 5 minutes ago
      elapsedAtPauseMs: 0,
      savedAt: NOW,
    };
    expect(calcRemaining(snap, NOW)).toBeCloseTo(1500, 0); // 30 min - 5 min = 25 min
  });

  it("accounts for elapsedAtPauseMs when running", () => {
    const snap: TimerSnap = {
      status: "running",
      durationSec: 1800,
      startWallMs: NOW - 60_000, // resumed 1 minute ago
      elapsedAtPauseMs: 300_000, // had already used 5 minutes before pause
      savedAt: NOW,
    };
    // total elapsed = 5 min (prior) + 1 min (since resume) = 6 min
    // remaining = 30 - 6 = 24 min = 1440 sec
    expect(calcRemaining(snap, NOW)).toBeCloseTo(1440, 0);
  });

  it("returns remaining for a paused timer", () => {
    const snap: TimerSnap = {
      status: "paused",
      durationSec: 1800,
      startWallMs: NOW - 600_000,
      elapsedAtPauseMs: 600_000, // paused after 10 minutes
      savedAt: NOW,
    };
    expect(calcRemaining(snap, NOW)).toBeCloseTo(1200, 0); // 30 - 10 = 20 min
  });

  it("returns 0 for an expired timer", () => {
    const snap: TimerSnap = {
      status: "expired",
      durationSec: 1800,
      startWallMs: NOW - 2_000_000,
      elapsedAtPauseMs: 1_800_000,
      savedAt: NOW,
    };
    expect(calcRemaining(snap, NOW)).toBe(0);
  });

  it("clamps to 0 when running timer has exceeded duration", () => {
    const snap: TimerSnap = {
      status: "running",
      durationSec: 60,
      startWallMs: NOW - 120_000, // started 2 minutes ago, only 1 minute duration
      elapsedAtPauseMs: 0,
      savedAt: NOW,
    };
    expect(calcRemaining(snap, NOW)).toBe(0);
  });
});

describe("deriveState", () => {
  const baseSnap: TimerSnap = {
    status: "running",
    durationSec: 1800,
    startWallMs: Date.now(),
    elapsedAtPauseMs: 0,
    savedAt: Date.now(),
  };

  it("marks expired when status is expired", () => {
    const snap = { ...baseSnap, status: "expired" as const };
    const { isExpired } = deriveState(snap, 0);
    expect(isExpired).toBe(true);
  });

  it("marks expired when remainingSec is 0", () => {
    const { isExpired } = deriveState(baseSnap, 0);
    expect(isExpired).toBe(true);
  });

  it("marks paused when status is paused", () => {
    const snap = { ...baseSnap, status: "paused" as const };
    const { isPaused } = deriveState(snap, 500);
    expect(isPaused).toBe(true);
  });

  it("marks isNearEnd when ≤ 300 seconds remain and running", () => {
    const { isNearEnd } = deriveState(baseSnap, 299);
    expect(isNearEnd).toBe(true);
  });

  it("does not mark isNearEnd when > 300 seconds remain", () => {
    const { isNearEnd } = deriveState(baseSnap, 301);
    expect(isNearEnd).toBe(false);
  });

  it("marks isVeryLow when ≤ 60 seconds remain and running", () => {
    const { isVeryLow } = deriveState(baseSnap, 59);
    expect(isVeryLow).toBe(true);
  });

  it("does not mark isVeryLow when > 60 seconds remain", () => {
    const { isVeryLow } = deriveState(baseSnap, 61);
    expect(isVeryLow).toBe(false);
  });

  it("computes progress correctly", () => {
    const { progress } = deriveState(baseSnap, 900); // half of 1800
    expect(progress).toBeCloseTo(0.5, 2);
  });

  it("clamps progress to 0 when remaining is 0", () => {
    const { progress } = deriveState(baseSnap, 0);
    expect(progress).toBe(0);
  });

  it("does not mark isNearEnd when paused", () => {
    const snap = { ...baseSnap, status: "paused" as const };
    const { isNearEnd } = deriveState(snap, 200);
    expect(isNearEnd).toBe(false);
  });
});
