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

export type DirectorLifecycleStatus =
  | "draft"
  | "registration"
  | "ready_to_start"
  | "live"
  | "paused"
  | "between_rounds"
  | "awaiting_finalization"
  | "finalizing"
  | "finalization_error"
  | "completed"
  | "cancelled";

export interface DirectorLifecycleInput {
  status?: unknown;
  playerCount: number;
  canStart: boolean;
  currentRound: number;
  totalRounds: number;
  allResultsIn: boolean;
  canGenerateNext: boolean;
  finalizationStatus?: "idle" | "pending" | "success" | "error";
}

export interface DirectorLifecycleDisplay {
  status: DirectorLifecycleStatus;
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

/**
 * Canonical Director-facing lifecycle vocabulary. This is intentionally more
 * specific than the public registration/live/completed status so the host can
 * always see the next operational state without conflating it with save sync.
 */
export function selectDirectorLifecycleStatus(input: DirectorLifecycleInput): DirectorLifecycleDisplay {
  if (input.status === "cancelled") {
    return { status: "cancelled", label: "Cancelled", description: "This tournament is no longer active.", tone: "danger" };
  }
  if (input.finalizationStatus === "error") {
    return { status: "finalization_error", label: "Finalization failed", description: "Results are saved locally. Retry publishing the final state.", tone: "danger" };
  }
  if (input.finalizationStatus === "pending") {
    return { status: "finalizing", label: "Finalizing", description: "Publishing final results to players and spectators.", tone: "info" };
  }
  if (input.status === "completed" || input.finalizationStatus === "success") {
    return { status: "completed", label: "Completed", description: "Final results are published.", tone: "success" };
  }
  if (input.status === "registration") {
    if (input.playerCount === 0) {
      return { status: "draft", label: "Draft", description: "Add players before opening tournament operations.", tone: "neutral" };
    }
    if (input.canStart) {
      return { status: "ready_to_start", label: "Ready to Start", description: "The roster is ready. Generate Round 1 when players are seated.", tone: "success" };
    }
    return { status: "registration", label: "Registration Open", description: "Players can still join this tournament.", tone: "info" };
  }
  if (input.status === "paused") {
    return { status: "paused", label: "Paused", description: `Round ${Math.max(1, input.currentRound)} is paused.`, tone: "warning" };
  }
  if (input.allResultsIn && input.currentRound >= input.totalRounds && input.totalRounds > 0) {
    return { status: "awaiting_finalization", label: "Awaiting Finalization", description: "All final-round results are recorded.", tone: "warning" };
  }
  if (input.allResultsIn && input.canGenerateNext) {
    return { status: "between_rounds", label: "Between Rounds", description: `Round ${input.currentRound} is complete. Generate the next round when ready.`, tone: "success" };
  }
  return { status: "live", label: "Live", description: `Round ${Math.max(1, input.currentRound)} is in progress.`, tone: "info" };
}
