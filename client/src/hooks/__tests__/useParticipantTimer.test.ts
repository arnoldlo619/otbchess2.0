// @vitest-environment jsdom
/**
 * Unit tests for useParticipantTimer helper functions.
 *
 * We test the pure helper functions exported from useRoundTimer
 * (timerStorageKey, saveTimerSnapshot, loadTimerSnapshot, remainingFromSnapshot)
 * and the derived state logic used in useParticipantTimer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  timerStorageKey,
  saveTimerSnapshot,
  loadTimerSnapshot,
  remainingFromSnapshot,
} from "../useRoundTimer";
import type { TimerSnapshot } from "../useRoundTimer";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TOURNAMENT_ID = "test-tourney-123";

function makeSnapshot(overrides: Partial<TimerSnapshot> = {}): TimerSnapshot {
  return {
    status: "running",
    durationSec: 1800, // 30 min
    startWallMs: Date.now() - 60_000, // started 60 s ago
    elapsedAtPauseMs: 0,
    savedAt: Date.now(),
    ...overrides,
  };
}

// ─── timerStorageKey ─────────────────────────────────────────────────────────

describe("timerStorageKey", () => {
  it("returns the expected key pattern", () => {
    expect(timerStorageKey("abc-123")).toBe("otb-timer-abc-123");
  });

  it("handles demo tournament id", () => {
    expect(timerStorageKey("otb-demo-2026")).toBe("otb-timer-otb-demo-2026");
  });
});

// ─── saveTimerSnapshot / loadTimerSnapshot ────────────────────────────────────

describe("saveTimerSnapshot / loadTimerSnapshot", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("round-trips a snapshot correctly", () => {
    const snap = makeSnapshot();
    saveTimerSnapshot(TOURNAMENT_ID, snap);
    const loaded = loadTimerSnapshot(TOURNAMENT_ID);
    expect(loaded).toEqual(snap);
  });

  it("returns null when no snapshot is stored", () => {
    expect(loadTimerSnapshot("nonexistent-id")).toBeNull();
  });

  it("overwrites a previous snapshot", () => {
    const snap1 = makeSnapshot({ durationSec: 600 });
    const snap2 = makeSnapshot({ durationSec: 1200 });
    saveTimerSnapshot(TOURNAMENT_ID, snap1);
    saveTimerSnapshot(TOURNAMENT_ID, snap2);
    const loaded = loadTimerSnapshot(TOURNAMENT_ID);
    expect(loaded?.durationSec).toBe(1200);
  });

  it("returns null when stored value is invalid JSON", () => {
    localStorage.setItem(timerStorageKey(TOURNAMENT_ID), "not-json{{{");
    expect(loadTimerSnapshot(TOURNAMENT_ID)).toBeNull();
  });
});

// ─── remainingFromSnapshot ────────────────────────────────────────────────────

describe("remainingFromSnapshot", () => {
  it("returns 0 for idle status", () => {
    const snap = makeSnapshot({ status: "idle", startWallMs: 0, elapsedAtPauseMs: 0 });
    expect(remainingFromSnapshot(snap)).toBe(0);
  });

  it("returns 0 for expired status", () => {
    const snap = makeSnapshot({ status: "expired" });
    expect(remainingFromSnapshot(snap)).toBe(0);
  });

  it("computes remaining correctly for a running timer", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 1800,
      startWallMs: now - 120_000, // 120 s elapsed since start
      elapsedAtPauseMs: 0,
    });
    const remaining = remainingFromSnapshot(snap, now);
    // 1800 - 120 = 1680
    expect(remaining).toBeCloseTo(1680, 0);
  });

  it("accounts for elapsedAtPauseMs in running state (resumed after pause)", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 1800,
      startWallMs: now - 30_000, // 30 s since resume
      elapsedAtPauseMs: 60_000,  // 60 s was already elapsed before pause
    });
    const remaining = remainingFromSnapshot(snap, now);
    // 1800 - (60 + 30) = 1710
    expect(remaining).toBeCloseTo(1710, 0);
  });

  it("computes remaining correctly for a paused timer", () => {
    const snap = makeSnapshot({
      status: "paused",
      durationSec: 1800,
      startWallMs: 0,
      elapsedAtPauseMs: 300_000, // 300 s elapsed
    });
    const remaining = remainingFromSnapshot(snap);
    // 1800 - 300 = 1500
    expect(remaining).toBeCloseTo(1500, 0);
  });

  it("never returns negative remaining time", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 60,
      startWallMs: now - 120_000, // 120 s elapsed, way past 60 s duration
      elapsedAtPauseMs: 0,
    });
    expect(remainingFromSnapshot(snap, now)).toBe(0);
  });

  it("returns full duration when timer just started (0 ms elapsed)", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 1800,
      startWallMs: now,
      elapsedAtPauseMs: 0,
    });
    const remaining = remainingFromSnapshot(snap, now);
    expect(remaining).toBeCloseTo(1800, 0);
  });
});

// ─── isActive / isNearEnd derivation ─────────────────────────────────────────

describe("isActive / isNearEnd derivation (logic used in useParticipantTimer)", () => {
  const NEAR_END_SEC = 300;

  function deriveState(snap: TimerSnapshot | null, nowMs = Date.now()) {
    if (!snap) return { isActive: false, isNearEnd: false, remainingSec: 0 };
    const status = snap.status;
    const isActive = status === "running" || status === "paused";
    const remainingSec = isActive ? remainingFromSnapshot(snap, nowMs) : 0;
    const isNearEnd = isActive && remainingSec > 0 && remainingSec <= NEAR_END_SEC;
    return { isActive, isNearEnd, remainingSec };
  }

  it("isActive is false when snapshot is null", () => {
    expect(deriveState(null).isActive).toBe(false);
  });

  it("isActive is true when running", () => {
    expect(deriveState(makeSnapshot({ status: "running" })).isActive).toBe(true);
  });

  it("isActive is true when paused", () => {
    expect(deriveState(makeSnapshot({ status: "paused" })).isActive).toBe(true);
  });

  it("isActive is false when expired", () => {
    expect(deriveState(makeSnapshot({ status: "expired" })).isActive).toBe(false);
  });

  it("isNearEnd is true when ≤ 5 min remain", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 1800,
      startWallMs: now - (1800 - 240) * 1000, // 240 s remaining
      elapsedAtPauseMs: 0,
    });
    expect(deriveState(snap, now).isNearEnd).toBe(true);
  });

  it("isNearEnd is false when > 5 min remain", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      status: "running",
      durationSec: 1800,
      startWallMs: now - 60_000, // 1740 s remaining
      elapsedAtPauseMs: 0,
    });
    expect(deriveState(snap, now).isNearEnd).toBe(false);
  });
});
