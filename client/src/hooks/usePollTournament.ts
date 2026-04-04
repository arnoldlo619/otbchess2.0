/**
 * usePollTournament
 *
 * Polls the /api/tournament/:id/live-state endpoint at a configurable interval
 * and calls onUpdate with the fresh server data.
 *
 * Behaviour:
 * - Polling is paused when the document is hidden (Page Visibility API) and
 *   resumes immediately when the tab becomes visible again, triggering an
 *   immediate fetch on resume.
 * - Polling is paused when SSE is connected (SSE already provides real-time
 *   updates; polling is a fallback for when SSE drops).
 * - Returns: { lastUpdatedAt, isPolling, refresh }
 *   - lastUpdatedAt: Date of the most recent successful fetch (null if never)
 *   - isPolling: true when the interval is active
 *   - refresh: call to trigger an immediate out-of-cycle fetch
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { Player } from "@/lib/tournamentData";
import type { Round } from "@/lib/tournamentData";

export interface PollPayload {
  players?: Player[];
  status?: string;
  currentRound?: number;
  totalRounds?: number;
  tournamentName?: string;
  rounds?: Round[];
}

interface UsePollTournamentOptions {
  /** Tournament ID to poll */
  tournamentId: string;
  /** Polling interval in milliseconds. Default: 15000 (15 seconds) */
  intervalMs?: number;
  /** When true, polling is paused (e.g. when SSE is connected) */
  pauseWhenConnected?: boolean;
  /** Called with fresh data on every successful poll */
  onUpdate: (data: PollPayload) => void;
  /** Whether to skip polling entirely (e.g. demo tournament) */
  disabled?: boolean;
}

interface UsePollTournamentResult {
  /** Timestamp of the last successful fetch, or null if never fetched */
  lastUpdatedAt: Date | null;
  /** Whether the polling interval is currently active */
  isPolling: boolean;
  /** Trigger an immediate out-of-cycle fetch */
  refresh: () => void;
}

export function usePollTournament({
  tournamentId,
  intervalMs = 15_000,
  pauseWhenConnected = false,
  onUpdate,
  disabled = false,
}: UsePollTournamentOptions): UsePollTournamentResult {
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Keep latest onUpdate in a ref so the interval closure doesn't go stale
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Track whether a fetch is already in flight to avoid concurrent requests
  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (disabled || fetchingRef.current) return;
    if (tournamentId === "otb-demo-2026") return;

    fetchingRef.current = true;
    try {
      const res = await fetch(
        `/api/tournament/${encodeURIComponent(tournamentId)}/live-state`
      );
      if (!res.ok) return;
      const data: PollPayload = await res.json();
      onUpdateRef.current(data);
      setLastUpdatedAt(new Date());
    } catch {
      // Silent — network errors are expected on mobile
    } finally {
      fetchingRef.current = false;
    }
  }, [tournamentId, disabled]);

  // Expose a manual refresh function
  const refresh = useCallback(() => {
    doFetch();
  }, [doFetch]);

  useEffect(() => {
    if (disabled || tournamentId === "otb-demo-2026") {
      setIsPolling(false);
      return;
    }

    // When SSE is connected, we don't need to poll
    if (pauseWhenConnected) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    // Set up the polling interval
    const intervalId = setInterval(() => {
      // Only poll when the tab is visible
      if (document.visibilityState === "visible") {
        doFetch();
      }
    }, intervalMs);

    // On visibility change: resume immediately when tab becomes visible
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        doFetch();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setIsPolling(false);
    };
  }, [disabled, tournamentId, pauseWhenConnected, intervalMs, doFetch]);

  return { lastUpdatedAt, isPolling, refresh };
}
