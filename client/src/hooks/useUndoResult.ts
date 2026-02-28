/**
 * useUndoResult
 *
 * Manages the 5-second undo window after a director records a game result.
 *
 * Usage:
 *   const { pending, recordWithUndo, dismiss } = useUndoResult(enterResult);
 *
 *   - Call `recordWithUndo(gameId, newResult, prevResult, label)` instead of
 *     `enterResult` directly. It applies the new result immediately and starts
 *     the 5-second countdown.
 *   - `pending` is non-null while the snackbar should be visible.
 *   - `dismiss()` hides the snackbar without reverting.
 *   - Calling `recordWithUndo` again while a pending undo exists replaces it
 *     (no stacking).
 *
 * The hook does NOT revert automatically on timeout — the result stays as
 * recorded. The undo action calls `enterResult(gameId, prevResult)` to revert.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { Result } from "@/lib/tournamentData";

export const UNDO_DURATION_MS = 5000;

export interface UndoPending {
  gameId: string;
  prevResult: Result;
  newResult: Result;
  /** Human-readable label, e.g. "Board 3: White wins" */
  label: string;
  /** Timestamp when the undo window started (ms) */
  startedAt: number;
}

interface UseUndoResultReturn {
  pending: UndoPending | null;
  recordWithUndo: (
    gameId: string,
    newResult: Result,
    prevResult: Result,
    label: string
  ) => void;
  undo: () => void;
  dismiss: () => void;
}

export function useUndoResult(
  enterResult: (gameId: string, result: Result) => void
): UseUndoResultReturn {
  const [pending, setPending] = useState<UndoPending | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any running timer
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setPending(null);
  }, [clearTimer]);

  const recordWithUndo = useCallback(
    (
      gameId: string,
      newResult: Result,
      prevResult: Result,
      label: string
    ) => {
      // Apply the result immediately
      enterResult(gameId, newResult);

      // Replace any existing pending undo
      clearTimer();

      const next: UndoPending = {
        gameId,
        prevResult,
        newResult,
        label,
        startedAt: Date.now(),
      };
      setPending(next);

      // Auto-dismiss after UNDO_DURATION_MS
      timerRef.current = setTimeout(() => {
        setPending(null);
        timerRef.current = null;
      }, UNDO_DURATION_MS);
    },
    [enterResult, clearTimer]
  );

  const undo = useCallback(() => {
    if (!pending) return;
    clearTimer();
    // Revert to the previous result
    enterResult(pending.gameId, pending.prevResult);
    setPending(null);
  }, [pending, enterResult, clearTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return { pending, recordWithUndo, dismiss, undo };
}
