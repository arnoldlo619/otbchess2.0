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

    setElapsedSec((prev) => {
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
        return durationSec;
      }

      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [durationSec, nearEndThresholdSec]);

  const start = useCallback(() => {
    setStatus((prev) => {
      if (prev === "running" || prev === "expired") return prev;
      startWallRef.current = Date.now();
      elapsedAtPauseRef.current = prev === "paused" ? elapsedSec : 0;
      rafRef.current = requestAnimationFrame(tick);
      return "running";
    });
  }, [elapsedSec, tick]);

  const pause = useCallback(() => {
    setStatus((prev) => {
      if (prev !== "running") return prev;
      cancelRaf();
      elapsedAtPauseRef.current = elapsedSec;
      return "paused";
    });
  }, [elapsedSec, cancelRaf]);

  const reset = useCallback(() => {
    cancelRaf();
    elapsedAtPauseRef.current = 0;
    setElapsedSec(0);
    setNearEndFired(false);
    setStatus("idle");
  }, [cancelRaf]);

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
