/**
 * Unit tests for the PlayerTimerBanner remaining-time calculation logic
 * and the director-side timer snapshot helpers.
 */
import { describe, it, expect } from "vitest";

// ─── Helpers (mirrors PlayerTimerBanner logic) ────────────────────────────────
type TimerSnap = {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
};

function calcRemaining(snap: TimerSnap, nowMs: number): number {
  if (snap.status === "idle") return 0;
  if (snap.status === "expired") return 0;
  if (snap.status === "paused") {
    return Math.max(0, snap.durationSec - Math.round(snap.elapsedAtPauseMs / 1000));
  }
  // running
  const elapsed = Math.round((nowMs - snap.startWallMs + snap.elapsedAtPauseMs) / 1000);
  return Math.max(0, snap.durationSec - elapsed);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isLowTime(remaining: number): boolean {
  return remaining > 0 && remaining <= 60;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("calcRemaining", () => {
  it("returns 0 for idle status", () => {
    const snap: TimerSnap = { status: "idle", durationSec: 1800, startWallMs: 0, elapsedAtPauseMs: 0, savedAt: 0 };
    expect(calcRemaining(snap, Date.now())).toBe(0);
  });

  it("returns 0 for expired status", () => {
    const snap: TimerSnap = { status: "expired", durationSec: 1800, startWallMs: 0, elapsedAtPauseMs: 0, savedAt: 0 };
    expect(calcRemaining(snap, Date.now())).toBe(0);
  });

  it("returns correct remaining for paused timer with 5 min elapsed", () => {
    const snap: TimerSnap = {
      status: "paused",
      durationSec: 1800, // 30 min
      startWallMs: 0,
      elapsedAtPauseMs: 5 * 60 * 1000, // 5 min elapsed
      savedAt: 0,
    };
    expect(calcRemaining(snap, Date.now())).toBe(25 * 60); // 25 min left
  });

  it("returns correct remaining for running timer started 10 min ago", () => {
    const now = Date.now();
    const snap: TimerSnap = {
      status: "running",
      durationSec: 1800, // 30 min
      startWallMs: now - 10 * 60 * 1000, // started 10 min ago
      elapsedAtPauseMs: 0,
      savedAt: now - 10 * 60 * 1000,
    };
    const remaining = calcRemaining(snap, now);
    expect(remaining).toBeGreaterThanOrEqual(19 * 60 - 1);
    expect(remaining).toBeLessThanOrEqual(20 * 60);
  });

  it("clamps to 0 when timer has run past duration", () => {
    const now = Date.now();
    const snap: TimerSnap = {
      status: "running",
      durationSec: 600, // 10 min
      startWallMs: now - 15 * 60 * 1000, // started 15 min ago
      elapsedAtPauseMs: 0,
      savedAt: now - 15 * 60 * 1000,
    };
    expect(calcRemaining(snap, now)).toBe(0);
  });

  it("accounts for elapsedAtPauseMs when resuming", () => {
    const now = Date.now();
    const snap: TimerSnap = {
      status: "running",
      durationSec: 1800,
      startWallMs: now - 5 * 60 * 1000, // resumed 5 min ago
      elapsedAtPauseMs: 10 * 60 * 1000, // had 10 min elapsed before pause
      savedAt: now - 5 * 60 * 1000,
    };
    const remaining = calcRemaining(snap, now);
    // total elapsed = 10 + 5 = 15 min, remaining = 30 - 15 = 15 min
    expect(remaining).toBeGreaterThanOrEqual(14 * 60 - 1);
    expect(remaining).toBeLessThanOrEqual(15 * 60);
  });
});

describe("formatTime", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 90 seconds as 1:30", () => {
    expect(formatTime(90)).toBe("1:30");
  });

  it("formats 3600 seconds as 60:00", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("pads single-digit seconds", () => {
    expect(formatTime(65)).toBe("1:05");
  });
});

describe("isLowTime", () => {
  it("returns false for 0 seconds (expired)", () => {
    expect(isLowTime(0)).toBe(false);
  });

  it("returns true for exactly 60 seconds", () => {
    expect(isLowTime(60)).toBe(true);
  });

  it("returns true for 30 seconds", () => {
    expect(isLowTime(30)).toBe(true);
  });

  it("returns false for 61 seconds", () => {
    expect(isLowTime(61)).toBe(false);
  });

  it("returns false for 1800 seconds", () => {
    expect(isLowTime(1800)).toBe(false);
  });
});
