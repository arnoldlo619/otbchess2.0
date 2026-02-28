/**
 * useVisibilitySync
 *
 * Fires a callback whenever the browser tab transitions from hidden → visible
 * (e.g. user returns from locking their phone, switching apps, or switching tabs).
 *
 * This is the foundation for offline resilience: callers re-read localStorage
 * on focus-return so stale in-memory state is replaced with the latest persisted
 * snapshot — critical for directors who lock their phone mid-tournament.
 *
 * Usage:
 *   useVisibilitySync(() => {
 *     const fresh = loadFromStorage(tournamentId);
 *     if (fresh) setState(fresh);
 *   });
 */

import { useEffect, useRef } from "react";

/**
 * Calls `onVisible` every time the document transitions from hidden → visible.
 * The callback is stable-ref'd so callers don't need to memoize it.
 *
 * @param onVisible  Function to call when the tab regains visibility.
 * @param enabled    Set to false to temporarily disable the listener (default: true).
 */
export function useVisibilitySync(
  onVisible: () => void,
  enabled = true
): void {
  // Keep a stable ref to the latest callback so the effect never re-runs
  // just because the caller passed a new function reference.
  const callbackRef = useRef(onVisible);
  useEffect(() => {
    callbackRef.current = onVisible;
  });

  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (!document.hidden) {
        callbackRef.current();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);
}
