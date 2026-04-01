/**
 * ActiveTournamentBanner
 *
 * A persistent floating banner that appears on all non-tournament pages
 * when the user has an active (non-completed) tournament on this device.
 *
 * Design decisions:
 * - Uses safe-area-inset-bottom to clear Android system nav bars and iOS home indicator.
 * - On the landing page (/) the banner is NOT dismissible — it's the primary nav aid.
 * - On other pages it can be dismissed for the session.
 * - Shows a live status badge (LIVE / PAUSED / LOBBY) for at-a-glance context.
 * - Re-checks on window focus so returning from another app shows fresh state.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, ChevronRight, X, Shield, Pause, Clock } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useActiveTournament } from "@/hooks/useActiveTournament";

export function ActiveTournamentBanner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [location] = useLocation();
  const activeTournament = useActiveTournament();

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("otb-banner-dismissed-v2");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Don't show on tournament-related pages or join flow
  const isOnTournamentPage =
    location.startsWith("/tournament/") || location.startsWith("/join");

  if (isOnTournamentPage || !activeTournament) return null;

  // On the landing page, never dismiss — it's the primary navigation aid
  const isLandingPage = location === "/" || location === "";
  const isDismissed = !isLandingPage && dismissed.has(activeTournament.id);

  if (isDismissed) return null;

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!activeTournament || isLandingPage) return;
    const next = new Set(dismissed);
    next.add(activeTournament.id);
    setDismissed(next);
    try {
      sessionStorage.setItem(
        "otb-banner-dismissed-v2",
        JSON.stringify(Array.from(next))
      );
    } catch { /* ignore */ }
  }

  // ── Status badge config ────────────────────────────────────────────────────
  type StatusKey = "in_progress" | "paused" | "registration" | "unknown" | "completed";
  const statusConfig: Record<StatusKey, { label: string; color: string; bg: string; pulse: boolean; icon: React.ElementType | null }> = {
    in_progress: { label: "LIVE",   color: "#4CAF50", bg: "rgba(76,175,80,0.15)",    pulse: true,  icon: null  },
    paused:      { label: "PAUSED", color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  pulse: false, icon: Pause },
    registration:{ label: "LOBBY",  color: "#60A5FA", bg: "rgba(96,165,250,0.15)",  pulse: false, icon: Clock },
    unknown:     { label: "ACTIVE", color: "#4CAF50", bg: "rgba(76,175,80,0.12)",   pulse: true,  icon: null  },
    completed:   { label: "DONE",   color: "#9CA3AF", bg: "rgba(156,163,175,0.12)", pulse: false, icon: null  },
  };

  const st = statusConfig[activeTournament.status as StatusKey] ?? statusConfig.unknown;
  const StatusIcon = st.icon;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-md animate-slide-up-fade"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      <Link
        href={activeTournament.href}
        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border transition-all active:scale-[0.98] ${
          isDark
            ? "bg-[oklch(0.20_0.07_145)]/96 border-[#4CAF50]/25 shadow-black/40"
            : "bg-white/97 border-[#3D6B47]/18 shadow-[#3D6B47]/12"
        } backdrop-blur-xl`}
      >
        {/* Role icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
        }`}>
          {activeTournament.role === "director"
            ? <Shield className="w-5 h-5" />
            : <Trophy className="w-5 h-5" />}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Status badge */}
            <span
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ color: st.color, background: st.bg }}
            >
              {st.pulse && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: st.color }} />
              )}
              {StatusIcon && <StatusIcon className="w-2.5 h-2.5" />}
              {st.label}
            </span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
              isDark ? "text-white/35" : "text-gray-400"
            }`}>
              {activeTournament.role === "director" ? "Director" : "Player"}
            </span>
          </div>
          <p
            className={`text-sm font-bold truncate leading-tight ${
              isDark ? "text-white" : "text-gray-900"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {activeTournament.name}
          </p>
          <p className={`text-xs mt-0.5 ${
            isDark ? "text-white/45" : "text-gray-500"
          }`}>
            {activeTournament.role === "director"
              ? "Tap to manage your tournament"
              : "Tap to view standings"}
          </p>
        </div>

        <ChevronRight className={`w-5 h-5 flex-shrink-0 ${
          isDark ? "text-white/30" : "text-gray-300"
        }`} />
      </Link>

      {/* Dismiss button — hidden on landing page */}
      {!isLandingPage && (
        <button
          onClick={handleDismiss}
          className={`absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center border shadow-md transition-all hover:scale-110 active:scale-95 ${
            isDark
              ? "bg-[oklch(0.22_0.06_145)] border-white/12 text-white/45 hover:text-white/80"
              : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
          }`}
          aria-label="Dismiss tournament banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
