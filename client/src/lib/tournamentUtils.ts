/**
 * tournamentUtils.ts — Canonical helpers for tournament display logic.
 *
 * Single source of truth for:
 *   - Format label mapping (all 7 formats)
 *   - Status display label + colour class
 *
 * Import from here instead of writing inline ternaries.
 */

// ─── Format Labels ────────────────────────────────────────────────────────────

export type TournamentFormat =
  | "swiss"
  | "doubleswiss"
  | "roundrobin"
  | "elimination"
  | "swiss_elim"
  | "quads"
  | string; // allow unknown future formats

/**
 * Returns a human-readable label for a tournament format.
 *
 * @param format  - the raw format string stored in state/DB
 * @param rounds  - optional round count (used to build "Swiss · 5R" style labels)
 * @param sections - optional section count for quads
 * @param players  - optional player count for quads
 */
export function getTournamentFormatLabel(
  format: TournamentFormat,
  rounds?: number,
  sections?: number,
  players?: number
): string {
  switch (format) {
    case "swiss":
      return rounds ? `Swiss · ${rounds}R` : "Swiss";
    case "doubleswiss":
      return rounds ? `Double Swiss · ${rounds}R` : "Double Swiss";
    case "roundrobin":
      return "Round Robin";
    case "elimination":
      return "Elimination";
    case "swiss_elim":
      return rounds ? `Swiss+Elim · ${rounds}R` : "Swiss + Elimination";
    case "quads": {
      if (rounds && sections && players) {
        const secLabel = sections > 1 ? `${sections} Sections` : "1 Section";
        return `Quads · ${secLabel} · ${players} Players · ${rounds}R`;
      }
      if (rounds) return `Quads · ${rounds}R`;
      return "Quads";
    }
    default:
      return format ?? "Unknown";
  }
}

/**
 * Short label (no round count) — for badges, cards, and compact UI.
 */
export function getTournamentFormatShortLabel(format: TournamentFormat): string {
  switch (format) {
    case "swiss":       return "Swiss";
    case "doubleswiss": return "Double Swiss";
    case "roundrobin":  return "Round Robin";
    case "elimination": return "Elimination";
    case "swiss_elim":  return "Swiss + Elim";
    case "quads":       return "Quads";
    default:            return format ?? "Unknown";
  }
}

// ─── Status Labels ────────────────────────────────────────────────────────────

export type TournamentStatus =
  | "registration"
  | "in_progress"
  | "paused"
  | "completed"
  | string;

export type CanonicalTournamentStatus =
  | "registration"
  | "in_progress"
  | "paused"
  | "completed";

type TournamentStatusSource =
  | unknown
  | { status?: unknown; elimPhase?: unknown };

export interface StatusDisplay {
  label: string;
  isLive: boolean;
  isComplete: boolean;
  isPending: boolean;
}

/**
 * Resolves local and server lifecycle sources into one safe status. Completed
 * is terminal and always wins, so stale in-progress state cannot render Live
 * after finalization.
 */
export function getTournamentStatus(
  ...sources: TournamentStatusSource[]
): CanonicalTournamentStatus {
  const statuses = sources.flatMap((source) => {
    if (source && typeof source === "object") {
      const candidate = source as { status?: unknown; elimPhase?: unknown };
      return [candidate.status, candidate.elimPhase];
    }
    return [source];
  });

  if (statuses.includes("completed")) return "completed";
  if (statuses.includes("paused")) return "paused";
  if (statuses.includes("in_progress") || statuses.includes("elimination")) return "in_progress";
  return "registration";
}

/**
 * Returns display metadata for a tournament status string.
 * Never returns isLive=true for a completed tournament.
 */
export function getTournamentStatusDisplay(...sources: TournamentStatusSource[]): StatusDisplay {
  switch (getTournamentStatus(...sources)) {
    case "completed":
      return { label: "Completed", isLive: false, isComplete: true, isPending: false };
    case "in_progress":
      return { label: "Live", isLive: true, isComplete: false, isPending: false };
    case "paused":
      return { label: "Paused", isLive: false, isComplete: false, isPending: false };
    case "registration":
    default:
      return { label: "Registration Open", isLive: false, isComplete: false, isPending: true };
  }
}
