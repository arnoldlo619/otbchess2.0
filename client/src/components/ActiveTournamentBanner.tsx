/**
 * ActiveTournamentBanner — persistent floating banner that appears on non-tournament
 * pages when the user has an active tournament (as director or participant).
 *
 * Shows the tournament name and a single tap navigates back to the correct dashboard:
 *   - Director → /tournament/:id/manage
 *   - Participant → /tournament/:id
 *
 * Dismissible per session. Automatically hidden on tournament pages themselves.
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, ChevronRight, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listTournaments,
  hasDirectorSession,
  type TournamentConfig,
} from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";

interface ActiveTournament {
  id: string;
  name: string;
  href: string;
  role: "director" | "participant";
}

export function ActiveTournamentBanner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("otb-banner-dismissed");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);

  useEffect(() => {
    // Don't show on tournament-related pages
    if (
      location.startsWith("/tournament/") ||
      location.startsWith("/join")
    ) {
      setActiveTournament(null);
      return;
    }

    // Find the most recent active tournament
    const tournaments = listTournaments();
    const registrations = getAllRegistrations();

    // Priority 1: Most recent directed tournament
    const directedTournament = tournaments.find((t) => hasDirectorSession(t.id));
    if (directedTournament && !dismissed.has(directedTournament.id)) {
      setActiveTournament({
        id: directedTournament.id,
        name: directedTournament.name,
        href: `/tournament/${directedTournament.id}/manage`,
        role: "director",
      });
      return;
    }

    // Priority 2: Most recent joined tournament (from registrations)
    for (const reg of registrations) {
      const config = tournaments.find(
        (t) =>
          t.id === reg.tournamentId ||
          t.inviteCode.toUpperCase() === reg.tournamentId.toUpperCase()
      );
      const tournamentId = config?.id ?? reg.tournamentId;
      if (!dismissed.has(tournamentId)) {
        setActiveTournament({
          id: tournamentId,
          name: reg.tournamentName || config?.name || "Tournament",
          href: `/tournament/${tournamentId}`,
          role: "participant",
        });
        return;
      }
    }

    setActiveTournament(null);
  }, [location, dismissed]);

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!activeTournament) return;
    const next = new Set(dismissed);
    next.add(activeTournament.id);
    setDismissed(next);
    try {
      sessionStorage.setItem("otb-banner-dismissed", JSON.stringify(Array.from(next)));
    } catch { /* ignore */ }
  }

  if (!activeTournament) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-md animate-slide-up-fade">
      <Link
        href={activeTournament.href}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border transition-all active:scale-[0.98] ${
          isDark
            ? "bg-[oklch(0.22_0.07_145)]/95 border-[#4CAF50]/30 shadow-[#3D6B47]/20"
            : "bg-white/95 border-[#3D6B47]/20 shadow-[#3D6B47]/10"
        } backdrop-blur-lg`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDark
              ? "bg-[#4CAF50]/20 text-[#4CAF50]"
              : "bg-[#3D6B47]/10 text-[#3D6B47]"
          }`}
        >
          <Trophy className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? "text-[#4CAF50]/80" : "text-[#3D6B47]/70"
            }`}
          >
            {activeTournament.role === "director" ? "Your Tournament" : "Active Tournament"}
          </p>
          <p
            className={`text-sm font-bold truncate ${
              isDark ? "text-white" : "text-gray-900"
            }`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {activeTournament.name}
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 flex-shrink-0 ${
            isDark ? "text-white/40" : "text-gray-400"
          }`}
        />
      </Link>
      <button
        onClick={handleDismiss}
        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border shadow-sm transition-all hover:scale-110 ${
          isDark
            ? "bg-[oklch(0.25_0.06_145)] border-white/15 text-white/50 hover:text-white/80"
            : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
        }`}
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
