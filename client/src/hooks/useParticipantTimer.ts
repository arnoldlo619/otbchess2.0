/**
 * useParticipantTimer
 *
 * Read-only hook for the participant Tournament page.
 * Reads the timer snapshot written by the director's useRoundTimer hook
 * from localStorage and re-derives remaining time locally using rAF.
 *
 * Updates every animation frame while running; polls localStorage every
 * 2 seconds to pick up changes from the director (same-device or cross-tab).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadTimerSnapshot,
  remainingFromSnapshot,
  timerStorageKey,
} from "./useRoundTimer";
import type { TimerSnapshot, TimerStatus } from "./useRoundTimer";

export interface ParticipantTimerState {
  /** Whether the director has an active timer (running or paused) */
  isActive: boolean;
  status: TimerStatus;
  remainingSec: number;
  durationSec: number;
  /** True when ≤ 5 minutes remain */
  isNearEnd: boolean;
}

const NEAR_END_SEC = 300; // 5 minutes
const POLL_INTERVAL_MS = 2000; // re-read localStorage every 2 s

export function useParticipantTimer(tournamentId: string): ParticipantTimerState {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(() =>
    loadTimerSnapshot(tournamentId)
  );
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const snapshotRef = useRef<TimerSnapshot | null>(snapshot);

  // Keep ref in sync for use inside rAF callback
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // Poll localStorage for director updates
  useEffect(() => {
    const poll = () => {
      const fresh = loadTimerSnapshot(tournamentId);
      setSnapshot(fresh);
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tournamentId]);

  // Also listen for cross-tab storage events (director in another tab)
  useEffect(() => {
    const key = timerStorageKey(tournamentId);
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setSnapshot(JSON.parse(e.newValue) as TimerSnapshot);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [tournamentId]);

  // rAF loop — only runs when timer is "running"
  const startRaf = useCallback(() => {
    const loop = () => {
      const snap = snapshotRef.current;
      if (!snap || snap.status !== "running") return;
      setRemainingSec(remainingFromSnapshot(snap));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!snapshot) {
      stopRaf();
      setRemainingSec(0);
      return;
    }
    if (snapshot.status === "running") {
      setRemainingSec(remainingFromSnapshot(snapshot));
      startRaf();
    } else {
      stopRaf();
      setRemainingSec(
        snapshot.status === "paused"
          ? Math.max(0, snapshot.durationSec - snapshot.elapsedAtPauseMs / 1000)
          : 0
      );
    }
    return stopRaf;
  }, [snapshot, startRaf, stopRaf]);

  // Cleanup on unmount
  useEffect(() => () => stopRaf(), [stopRaf]);

  const status: TimerStatus = snapshot?.status ?? "idle";
  const isActive = status === "running" || status === "paused";
  const durationSec = snapshot?.durationSec ?? 0;

  return {
    isActive,
    status,
    remainingSec,
    durationSec,
    isNearEnd: isActive && remainingSec > 0 && remainingSec <= NEAR_END_SEC,
  };
}
