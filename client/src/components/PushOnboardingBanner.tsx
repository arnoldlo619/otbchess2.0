/**
 * PushOnboardingBanner
 *
 * A one-time, contextual, dismissible banner that appears on the spectator
 * tournament page to encourage push notification opt-ins from players who
 * might miss the bell icon in the header.
 *
 * Visibility rules:
 *   - Only shown for real tournaments (not demo)
 *   - Only shown when the tournament is in progress (at least 1 round started)
 *   - Hidden if push is already subscribed
 *   - Hidden if push permission is denied or browser is unsupported
 *   - Hidden for the director
 *   - Hidden after the user dismisses it (persisted in localStorage)
 *   - Animates in from the bottom with a smooth slide-up, fades out on dismiss
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, X } from "lucide-react";
import type { PushStatus } from "@/hooks/usePushSubscription";

interface PushOnboardingBannerProps {
  /** The tournament ID — used to namespace the localStorage key */
  tournamentId: string;
  /** Current push subscription status from usePushSubscription */
  pushStatus: PushStatus;
  /** Whether the current user is the director (banner hidden for directors) */
  isDirector: boolean;
  /** Whether the tournament is in progress with at least 1 round started */
  isInProgress: boolean;
  /** Callback to trigger the push subscribe flow */
  onSubscribe: () => Promise<void>;
  /** Whether push is loading (disable button during in-flight request) */
  isLoading: boolean;
  /** Dark mode flag */
  isDark: boolean;
}

/** localStorage key for dismissal state */
function dismissalKey(tournamentId: string): string {
  return `otb-push-onboard-dismissed-${tournamentId}`;
}

/** Check if the banner has been dismissed for this tournament */
export function isPushBannerDismissed(tournamentId: string): boolean {
  try {
    return localStorage.getItem(dismissalKey(tournamentId)) === "1";
  } catch {
    return false;
  }
}

/** Mark the banner as dismissed for this tournament */
export function dismissPushBanner(tournamentId: string): void {
  try {
    localStorage.setItem(dismissalKey(tournamentId), "1");
  } catch {
    // localStorage unavailable — ignore
  }
}

/** Determine if the banner should be shown */
export function shouldShowPushBanner({
  tournamentId,
  pushStatus,
  isDirector,
  isInProgress,
}: {
  tournamentId: string;
  pushStatus: PushStatus;
  isDirector: boolean;
  isInProgress: boolean;
}): boolean {
  if (!isInProgress) return false;
  if (isDirector) return false;
  if (pushStatus === "subscribed") return false;
  if (pushStatus === "denied") return false;
  if (pushStatus === "unsupported") return false;
  if (tournamentId === "otb-demo-2026") return false;
  if (isPushBannerDismissed(tournamentId)) return false;
  return true;
}

export function PushOnboardingBanner({
  tournamentId,
  pushStatus,
  isDirector,
  isInProgress,
  onSubscribe,
  isLoading,
  isDark,
}: PushOnboardingBannerProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Determine initial visibility on mount (and when status changes)
  useEffect(() => {
    const show = shouldShowPushBanner({ tournamentId, pushStatus, isDirector, isInProgress });
    if (show) {
      // Delay slightly so it doesn't flash on initial load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [tournamentId, pushStatus, isDirector, isInProgress]);

  // Hide banner after successful subscription
  useEffect(() => {
    if (pushStatus === "subscribed" && visible) {
      handleDismiss();
    }
  }, [pushStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    setExiting(true);
    dismissPushBanner(tournamentId);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 300);
  }, [tournamentId]);

  const handleSubscribe = useCallback(async () => {
    await onSubscribe();
    // Banner will auto-hide via the pushStatus === "subscribed" effect above
  }, [onSubscribe]);

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Push notification opt-in"
      className={`
        transition-all duration-300 ease-out
        ${exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}
      `}
    >
      <div
        className={`
          relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border
          ${isDark
            ? "bg-[oklch(0.25_0.08_145)] border-[#3D6B47]/40 text-white"
            : "bg-[#F0F8F2] border-[#3D6B47]/25 text-[#1a2e1e]"
          }
        `}
      >
        {/* Bell icon */}
        <div
          className={`
            flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5
            ${isDark ? "bg-[#3D6B47]/40" : "bg-[#3D6B47]/12"}
          `}
        >
          <Bell
            className={`w-4 h-4 ${isDark ? "text-[#7EC98A]" : "text-[#3D6B47]"}`}
          />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${isDark ? "text-white" : "text-[#1a2e1e]"}`}>
            Get notified when the next round starts
          </p>
          <p className={`text-xs mt-0.5 leading-snug ${isDark ? "text-white/55" : "text-[#3D6B47]/70"}`}>
            Tap the bell in the header — or enable notifications below — so you never miss your pairing.
          </p>

          {/* CTA row */}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold
                transition-all duration-150 active:scale-95
                ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
                ${isDark
                  ? "bg-[#3D6B47] text-white hover:bg-[#4a7d56]"
                  : "bg-[#3D6B47] text-white hover:bg-[#2e5236]"
                }
              `}
              aria-label="Enable push notifications"
            >
              {isLoading ? (
                <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Bell className="w-3 h-3" />
              )}
              {isLoading ? "Enabling…" : "Enable notifications"}
            </button>

            <button
              onClick={handleDismiss}
              className={`
                text-xs font-medium px-2 py-1.5 rounded-lg transition-colors duration-150
                ${isDark ? "text-white/40 hover:text-white/60" : "text-gray-400 hover:text-gray-600"}
              `}
              aria-label="Dismiss notification prompt"
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className={`
            flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5
            transition-colors duration-150
            ${isDark ? "text-white/30 hover:text-white/60 hover:bg-white/08" : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"}
          `}
          aria-label="Close notification prompt"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
