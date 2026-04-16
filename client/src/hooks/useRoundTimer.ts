/**
 * useRoundTimer
 *
 * Manages a per-round countdown clock for the Director Dashboard.
 *
 * Features:
 *   - Configurable duration (minutes), defaulting to the tournament time preset
 *   - start / pause / reset controls
 *   - Tracks elapsed seconds via requestAnimationFrame for smooth UI
 *   - Fires `onNearEnd` callback once when `nearEndThresholdSec` remain
 *   - Fires `onExpired` callback once when the clock reaches zero
 *   - Resets automatically when `roundNumber` changes (new round generated)
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "expired";

// ─── localStorage persistence ─────────────────────────────────────────────────
// Key pattern: otb-timer-{tournamentId}
// Snapshot written by the director; read by the participant page.

export interface TimerSnapshot {
  status: TimerStatus;
  durationSec: number;
  /** Wall-clock ms when the timer was last started/resumed */
  startWallMs: number;
  /** Elapsed seconds accumulated before the last pause */
  elapsedAtPauseMs: number;
  /** Unix ms when the snapshot was written (for staleness checks) */
  savedAt: number;
}

export function timerStorageKey(tournamentId: string): string {
  return `otb-timer-${tournamentId}`;
}

export function saveTimerSnapshot(tournamentId: string, snap: TimerSnapshot): void {
  try {
    localStorage.setItem(timerStorageKey(tournamentId), JSON.stringify(snap));
  } catch { /* quota exceeded — ignore */ }
}

export function loadTimerSnapshot(tournamentId: string): TimerSnapshot | null {
  try {
    const raw = localStorage.getItem(timerStorageKey(tournamentId));
    return raw ? (JSON.parse(raw) as TimerSnapshot) : null;
  } catch {
    return null;
  }
}

/** Compute remaining seconds from a snapshot at the current wall-clock time. */
export function remainingFromSnapshot(snap: TimerSnapshot, nowMs = Date.now()): number {
  if (snap.status === "idle" || snap.status === "expired") return 0;
  const elapsedSec =
    snap.status === "running"
      ? snap.elapsedAtPauseMs / 1000 + (nowMs - snap.startWallMs) / 1000
      : snap.elapsedAtPauseMs / 1000;
  return Math.max(0, snap.durationSec - elapsedSec);
}

export interface RoundTimerState {
  status: TimerStatus;
  /** Total duration in seconds */
  durationSec: number;
  /** Seconds elapsed since last start */
  elapsedSec: number;
  /** Seconds remaining */
  remainingSec: number;
  /** True once the near-end threshold has been crossed */
  nearEndFired: boolean;
}

export interface UseRoundTimerOptions {
  /** Initial duration in minutes (can be changed while idle) */
  initialDurationMin?: number;
  /** Threshold in seconds at which onNearEnd fires (default: 300 = 5 min) */
  nearEndThresholdSec?: number;
  /** Called once when remaining time crosses nearEndThresholdSec */
  onNearEnd?: () => void;
  /** Called once when the timer reaches zero */
  onExpired?: () => void;
  /** Round number — when this changes the timer auto-resets */
  roundNumber?: number;
  /** Tournament ID — when provided, timer state is persisted to localStorage */
  tournamentId?: string;
}

export interface UseRoundTimerReturn extends RoundTimerState {
  start: () => void;
  pause: () => void;
  reset: () => void;
  setDurationMin: (min: number) => void;
}

export const DEFAULT_DURATION_MIN = 30;
export const DEFAULT_NEAR_END_SEC = 300; // 5 minutes

export function useRoundTimer({
  initialDurationMin = DEFAULT_DURATION_MIN,
  nearEndThresholdSec = DEFAULT_NEAR_END_SEC,
  onNearEnd,
  onExpired,
  roundNumber,
  tournamentId,
}: UseRoundTimerOptions = {}): UseRoundTimerReturn {
  const [durationSec, setDurationSec] = useState(initialDurationMin * 60);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [nearEndFired, setNearEndFired] = useState(false);

  // Refs for the animation loop
  const rafRef = useRef<number | null>(null);
  const startWallRef = useRef<number>(0); // wall-clock ms when last resumed
  const elapsedAtPauseRef = useRef<number>(0); // elapsed seconds when paused

  // Stable callback refs
  const onNearEndRef = useRef(onNearEnd);
  const onExpiredRef = useRef(onExpired);
  useEffect(() => { onNearEndRef.current = onNearEnd; }, [onNearEnd]);
  useEffect(() => { onExpiredRef.current = onExpired; }, [onExpired]);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const wallElapsed = (Date.now() - startWallRef.current) / 1000;
    const totalElapsed = elapsedAtPauseRef.current + wallElapsed;

    setElapsedSec((_prev) => {
      const next = Math.min(totalElapsed, durationSec);
      const remaining = durationSec - next;

      // Near-end check — use functional updater to avoid stale closure
      setNearEndFired((fired) => {
        if (!fired && remaining <= nearEndThresholdSec && remaining > 0) {
          onNearEndRef.current?.();
          return true;
        }
        return fired;
      });

      // Expired check
      if (next >= durationSec) {
        setStatus("expired");
        onExpiredRef.current?.();
        if (tournamentId) {
          saveTimerSnapshot(tournamentId, {
            status: "expired",
            durationSec,
            startWallMs: startWallRef.current,
            elapsedAtPauseMs: durationSec * 1000,
            savedAt: Date.now(),
          });
        }
        return durationSec;
      }

      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [durationSec, nearEndThresholdSec, tournamentId]);

  const start = useCallback(() => {
    setStatus((prev) => {
      if (prev === "running" || prev === "expired") return prev;
      startWallRef.current = Date.now();
      elapsedAtPauseRef.current = prev === "paused" ? elapsedSec : 0;
      rafRef.current = requestAnimationFrame(tick);
      // Persist immediately so participant page picks up the start
      if (tournamentId) {
        saveTimerSnapshot(tournamentId, {
          status: "running",
          durationSec,
          startWallMs: startWallRef.current,
          elapsedAtPauseMs: elapsedAtPauseRef.current * 1000,
          savedAt: Date.now(),
        });
      }
      return "running";
    });
  }, [elapsedSec, tick, tournamentId, durationSec]);

  const pause = useCallback(() => {
    setStatus((prev) => {
      if (prev !== "running") return prev;
      cancelRaf();
      elapsedAtPauseRef.current = elapsedSec;
      // Persist paused state
      if (tournamentId) {
        saveTimerSnapshot(tournamentId, {
          status: "paused",
          durationSec,
          startWallMs: startWallRef.current,
          elapsedAtPauseMs: elapsedSec * 1000,
          savedAt: Date.now(),
        });
      }
      return "paused";
    });
  }, [elapsedSec, cancelRaf, tournamentId, durationSec]);

  const reset = useCallback(() => {
    cancelRaf();
    elapsedAtPauseRef.current = 0;
    setElapsedSec(0);
    setNearEndFired(false);
    setStatus("idle");
    // Persist idle state so participant page hides the clock
    if (tournamentId) {
      saveTimerSnapshot(tournamentId, {
        status: "idle",
        durationSec,
        startWallMs: 0,
        elapsedAtPauseMs: 0,
        savedAt: Date.now(),
      });
    }
  }, [cancelRaf, tournamentId, durationSec]);

  const setDurationMin = useCallback((min: number) => {
    const sec = Math.max(1, min) * 60;
    setDurationSec(sec);
    // If idle, just update; if running/paused, reset first
    cancelRaf();
    elapsedAtPauseRef.current = 0;
    setElapsedSec(0);
    setNearEndFired(false);
    setStatus("idle");
  }, [cancelRaf]);

  // Auto-reset when round number changes
  const prevRoundRef = useRef(roundNumber);
  useEffect(() => {
    if (prevRoundRef.current !== undefined && roundNumber !== prevRoundRef.current) {
      reset();
    }
    prevRoundRef.current = roundNumber;
  }, [roundNumber, reset]);

  // Cleanup on unmount
  useEffect(() => () => cancelRaf(), [cancelRaf]);

  const remainingSec = Math.max(0, durationSec - elapsedSec);

  return {
    status,
    durationSec,
    elapsedSec,
    remainingSec,
    nearEndFired,
    start,
    pause,
    reset,
    setDurationMin,
  };
}
