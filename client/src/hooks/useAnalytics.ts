/**
 * useAnalytics — Client-side analytics tracking hook
 *
 * Provides a fire-and-forget `track` function that POSTs events to
 * /api/analytics/event. All calls are best-effort: network failures
 * are silently swallowed so they never affect the user experience.
 *
 * Usage:
 *   const { track } = useAnalytics(tournamentId);
 *   track("page_view");
 *   track("search", { playerName: "Alice" });
 *   track("follow", { playerId: "p1", playerName: "Alice" });
 *   track("unfollow", { playerId: "p1" });
 *   track("cta_click", { cta: "join_club" });
 *   track("email_capture", { email: "a@b.com" });
 *   track("card_claim", { playerId: "p1" });
 */

import { useCallback, useRef } from "react";

export type AnalyticsEventType =
  | "page_view"
  | "search"
  | "follow"
  | "unfollow"
  | "cta_click"
  | "email_capture"
  | "card_claim";

type Metadata = Record<string, unknown>;

// ─── Core fire-and-forget fetch ───────────────────────────────────────────────

function postEvent(
  tournamentId: string,
  eventType: AnalyticsEventType,
  metadata?: Metadata
): void {
  try {
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, eventType, metadata }),
      // keepalive ensures the request completes even if the page navigates away
      keepalive: true,
    }).catch(() => {
      // Network errors are silently ignored — analytics must never break UX
    });
  } catch {
    // Synchronous errors (e.g., JSON.stringify failure) are also ignored
  }
}

// ─── Deduplication: prevent double page_view on React StrictMode double-mount ─

const firedPageViews = new Set<string>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics(tournamentId: string | null | undefined) {
  const tournamentIdRef = useRef(tournamentId);
  tournamentIdRef.current = tournamentId;

  const track = useCallback(
    (eventType: AnalyticsEventType, metadata?: Metadata) => {
      const tid = tournamentIdRef.current;
      if (!tid) return;

      // Deduplicate page_view events within the same session
      if (eventType === "page_view") {
        const key = `${tid}:page_view`;
        if (firedPageViews.has(key)) return;
        firedPageViews.add(key);
      }

      postEvent(tid, eventType, metadata);
    },
    [] // stable reference — reads tournamentId via ref
  );

  return { track };
}

// ─── Standalone helper (for use outside React components) ────────────────────

export function trackAnalyticsEvent(
  tournamentId: string,
  eventType: AnalyticsEventType,
  metadata?: Metadata
): void {
  postEvent(tournamentId, eventType, metadata);
}
