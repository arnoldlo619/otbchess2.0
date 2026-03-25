/**
 * useWakeLock
 * ───────────
 * Requests a Screen Wake Lock when `active` is true and releases it when
 * `active` becomes false or the component unmounts.
 *
 * The Screen Wake Lock API is supported in Chrome 84+, Edge 84+, and
 * Safari 16.4+ (including iOS 16.4+). Older browsers and iOS < 16.4 do
 * not support it — the hook silently no-ops in those cases.
 *
 * The lock is also automatically re-acquired if the page becomes visible
 * again after being backgrounded (e.g. the user switches apps and returns),
 * because the browser releases wake locks on page visibility change.
 */

import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      // Release any existing lock when the screen is no longer needed
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
      return;
    }

    // Guard: API not available (older browsers / iOS < 16.4)
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
      } catch {
        // Permission denied or API unavailable — silently ignore
      }
    }

    acquire();

    // Re-acquire the lock when the page becomes visible again, because
    // browsers automatically release wake locks when the page is hidden.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && active) {
        acquire();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
