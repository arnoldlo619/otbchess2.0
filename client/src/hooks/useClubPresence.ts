/**
 * useClubPresence
 *
 * Polls the /api/clubs/:clubId/presence endpoint every 30 seconds to get the
 * live online member count. Also sends a heartbeat every 60 seconds so the
 * current user is counted as online while they have the club page open.
 *
 * Returns:
 *   onlineCount  — number of members seen in the last 5 minutes
 *   totalMembers — total members in the club
 *   isLoading    — true while the first fetch is in flight
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiGetPresence, apiHeartbeat } from "../lib/clubsApi";

const POLL_INTERVAL_MS = 30_000;   // refresh count every 30 s
const HEARTBEAT_INTERVAL_MS = 60_000; // send heartbeat every 60 s

interface PresenceState {
  onlineCount: number;
  totalMembers: number;
  isLoading: boolean;
}

export function useClubPresence(
  clubId: string | null | undefined,
  /** Pass true only when the current user is an authenticated member of this club */
  isMember: boolean
): PresenceState {
  const [state, setState] = useState<PresenceState>({
    onlineCount: 0,
    totalMembers: 0,
    isLoading: true,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPresence = useCallback(async () => {
    if (!clubId) return;
    const data = await apiGetPresence(clubId);
    setState((prev) => ({
      ...prev,
      onlineCount: data.onlineCount,
      totalMembers: data.totalMembers,
      isLoading: false,
    }));
  }, [clubId]);

  const sendHeartbeat = useCallback(async () => {
    if (!clubId || !isMember) return;
    await apiHeartbeat(clubId);
    // Re-fetch presence after heartbeat so our own count is reflected immediately
    await fetchPresence();
  }, [clubId, isMember, fetchPresence]);

  useEffect(() => {
    if (!clubId) return;

    // Initial fetch
    fetchPresence();

    // Initial heartbeat (if member)
    if (isMember) {
      sendHeartbeat();
    }

    // Poll for presence every 30 s
    pollRef.current = setInterval(fetchPresence, POLL_INTERVAL_MS);

    // Heartbeat every 60 s (only if member)
    if (isMember) {
      heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [clubId, isMember, fetchPresence, sendHeartbeat]);

  return state;
}
