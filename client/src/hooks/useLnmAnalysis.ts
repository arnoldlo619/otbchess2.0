/**
 * useLnmAnalysis
 *
 * Handles the full post-game PGN → Stockfish analysis pipeline for
 * Live Notation Mode (LNM).
 *
 * Flow:
 *  1. Caller invokes `startAnalysis(pgn, options)`.
 *  2. Hook POSTs to POST /api/games/from-pgn → receives { sessionId, gameId }.
 *  3. Hook navigates to /game/:gameId/analysis immediately (GameAnalysis page
 *     polls for analysis completion itself via GET /api/games/:id/analysis).
 *
 * States exposed:
 *  - idle      : nothing happening
 *  - submitting: POST in flight
 *  - navigating: gameId received, about to navigate
 *  - error     : POST failed
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LnmAnalysisStatus =
  | "idle"
  | "submitting"
  | "navigating"
  | "error";

export interface LnmAnalysisOptions {
  whitePlayer?: string;
  blackPlayer?: string;
  result?: string;
  event?: string;
  date?: string;
}

export interface UseLnmAnalysisReturn {
  /** Current pipeline status */
  status: LnmAnalysisStatus;
  /** Error message if status === 'error' */
  error: string | null;
  /** gameId returned from the server (available once status === 'navigating') */
  gameId: string | null;
  /** Start the pipeline: POST PGN, then navigate */
  startAnalysis: (pgn: string, options?: LnmAnalysisOptions) => Promise<void>;
  /** Reset to idle (e.g. after dismissing an error) */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLnmAnalysis(): UseLnmAnalysisReturn {
  const [status, setStatus] = useState<LnmAnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setGameId(null);
  }, []);

  const startAnalysis = useCallback(
    async (pgn: string, options: LnmAnalysisOptions = {}) => {
      if (!pgn || pgn.trim().length === 0) {
        setError("No moves recorded — play at least one move before analysing.");
        setStatus("error");
        return;
      }

      setStatus("submitting");
      setError(null);
      setGameId(null);

      try {
        const res = await fetch("/api/games/from-pgn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            pgn,
            whitePlayer: options.whitePlayer ?? "White",
            blackPlayer: options.blackPlayer ?? "Black",
            result: options.result ?? "*",
            event: options.event ?? "OTB Battle",
            date:
              options.date ?? new Date().toISOString().split("T")[0],
          }),
        });

        if (!res.ok) {
          let msg = "Failed to submit game for analysis.";
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            // ignore JSON parse error
          }
          setError(msg);
          setStatus("error");
          return;
        }

        const data = (await res.json()) as { gameId: string; sessionId: string };

        if (!data.gameId) {
          setError("Server returned no game ID.");
          setStatus("error");
          return;
        }

        setGameId(data.gameId);
        setStatus("navigating");

        // Navigate to the GameAnalysis page — it polls for analysis completion
        navigate(`/game/${data.gameId}/analysis`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Network error — please try again.";
        setError(msg);
        setStatus("error");
      }
    },
    [navigate]
  );

  return { status, error, gameId, startAnalysis, reset };
}
