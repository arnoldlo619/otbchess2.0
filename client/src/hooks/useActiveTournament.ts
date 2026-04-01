/**
 * useActiveTournament
 *
 * Single source of truth for detecting whether the current device has an
 * active tournament — either as a director or as a registered player.
 *
 * Priority order:
 *   1. Director session (most recent tournament with a valid director session)
 *   2. Player registration (most recent tournament the user joined)
 *
 * Returns null when no active tournament is found.
 *
 * Reactively updates when localStorage changes (cross-tab, storage events).
 */
import { useState, useEffect, useCallback } from "react";
import {
  listTournaments,
  hasDirectorSession,
  resolveTournament,
} from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";

export interface ActiveTournamentInfo {
  /** Tournament slug, e.g. "spring-open-2026" */
  id: string;
  /** Human-readable tournament name */
  name: string;
  /** Full URL to navigate to — director gets /manage, player gets spectator view */
  href: string;
  /** Whether the user is the director or a registered player */
  role: "director" | "participant";
  /** Tournament status derived from director state (if available) */
  status: "registration" | "in_progress" | "paused" | "completed" | "unknown";
}

function readActiveTournament(): ActiveTournamentInfo | null {
  try {
    const allTournaments = listTournaments();

    // ── Priority 1: Director session ─────────────────────────────────────────
    // Sort by most recently created so the latest tournament wins
    const sorted = [...allTournaments].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
    for (const t of sorted) {
      if (!hasDirectorSession(t.id)) continue;

      // Try to read tournament status from director state
      let status: ActiveTournamentInfo["status"] = "unknown";
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${t.id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { status?: string };
          const s = parsed.status;
          if (
            s === "registration" ||
            s === "in_progress" ||
            s === "paused" ||
            s === "completed"
          ) {
            status = s;
          }
        }
      } catch {
        // ignore — status stays "unknown"
      }

      // Skip completed tournaments — they don't need a "return" banner
      if (status === "completed") continue;

      return {
        id: t.id,
        name: t.name || t.id,
        href: `/tournament/${t.id}/manage`,
        role: "director",
        status,
      };
    }

    // ── Priority 2: Player registration ──────────────────────────────────────
    const registrations = getAllRegistrations();
    for (const reg of registrations) {
      const config =
        allTournaments.find(
          (t) =>
            t.id === reg.tournamentId ||
            t.inviteCode?.toUpperCase() === reg.tournamentId?.toUpperCase()
        ) ?? resolveTournament(reg.tournamentId);

      const tournamentId = config?.id ?? reg.tournamentId;
      const name = config?.name || reg.tournamentName || "Tournament";

      // Try to read status from director state (works if same device)
      let status: ActiveTournamentInfo["status"] = "unknown";
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${tournamentId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { status?: string };
          const s = parsed.status;
          if (
            s === "registration" ||
            s === "in_progress" ||
            s === "paused" ||
            s === "completed"
          ) {
            status = s;
          }
        }
      } catch {
        // ignore
      }

      // Skip completed tournaments
      if (status === "completed") continue;

      return {
        id: tournamentId,
        name,
        href: `/tournament/${tournamentId}`,
        role: "participant",
        status,
      };
    }
  } catch {
    // localStorage unavailable — fail silently
  }

  return null;
}

export function useActiveTournament(): ActiveTournamentInfo | null {
  const [active, setActive] = useState<ActiveTournamentInfo | null>(() =>
    readActiveTournament()
  );

  const refresh = useCallback(() => {
    setActive(readActiveTournament());
  }, []);

  useEffect(() => {
    // Re-check whenever localStorage changes (cross-tab registration, director state save)
    window.addEventListener("storage", refresh);
    // Also re-check on focus (user switches back from another app on mobile)
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return active;
}
