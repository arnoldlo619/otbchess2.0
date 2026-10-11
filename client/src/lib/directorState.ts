/**
 * OTB Chess — Director State Management
 * Manages mutable tournament state: results, pairings, standings
 * Uses the full Swiss engine from swiss.ts for pairing and tiebreaks
 * Persists all state to localStorage with per-tournament keys and versioned schema
 *
 * Supports two modes:
 *  - Demo mode (tournamentId = "otb-demo-2026"): loads the hardcoded demo tournament
 *  - Created mode (tournamentId = any other slug): loads from tournamentRegistry + starts fresh
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { DEMO_TOURNAMENT, type Player, type Game, type Round, type Result } from "./tournamentData";
import { generateSwissPairings, generateDoubleSwissPairings, applyResultToPlayers, computeStandings, generateEliminationFirstRound, generateEliminationNextRound, generateThirdPlaceGame, suggestElimCutoff, elimRoundLabel, getPairingEligiblePlayers, type StandingRow } from "./swiss";
import { getTournamentConfig, type TournamentConfig } from "./tournamentRegistry";
import { useVisibilitySync } from "./useVisibilitySync";
import { calculateQuadStandings, generateQuadTournament, swapPlayersBetweenSections, type QuadSection, type QuadSettings, DEFAULT_QUAD_SETTINGS } from "./quads";
import { generateMockQuadsTournament, generateCompletedMockQuadsTournament, generateCoChampionMockQuadsTournament } from "./mockQuadsData";
import { isPlayerCountValid } from "./formatRegistry";

// ─── Schema Version ───────────────────────────────────────────────────────────
// Bump this when the DirectorState shape changes to force a clean reset
const SCHEMA_VERSION = 3;

function storageKey(tournamentId: string): string {
  return `otb-director-state-v${SCHEMA_VERSION}-${tournamentId}`;
}

// ─── Mutable State ────────────────────────────────────────────────────────────
export interface DirectorState {
  tournamentId: string;
  tournamentName: string;
  totalRounds: number;
  /** Tournament format — used to select the correct pairing engine. */
  format: "swiss" | "doubleswiss" | "roundrobin" | "elimination" | "swiss_elim" | "quads";
  /** For swiss_elim: number of Swiss rounds before the elimination cutoff. */
  swissRounds?: number;
  /** For swiss_elim: current phase — starts in "swiss", transitions to "elimination" after cutoff. */
  elimPhase?: "swiss" | "cutoff" | "elimination";
  /** For swiss_elim: how many players advance to the elimination bracket. */
  elimCutoff?: number;
  /** For swiss_elim: label for the current elimination round (e.g. "Quarterfinals"). */
  elimRoundLabelText?: string;
  /** For swiss_elim: the players who advanced to the elimination bracket (seeded order). */
  elimPlayers?: Player[];
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: "registration" | "in_progress" | "completed" | "paused";
  /** Minutes allocated per round (default 25). Used by the round timer. */
  roundMinutes: number;
  /** For quads: the generated sections (quads + optional bottom swiss). */
  quadSections?: QuadSection[];
  /** For quads: settings used for generation. */
  quadSettings?: QuadSettings;
  /** Audit trail: history of result entries/corrections. */
  resultHistory?: ResultHistoryEntry[];
}

export interface ResultHistoryEntry {
  /** Stable entry identifier for rendering and support references. */
  id?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Game identifier. */
  gameId?: string;
  /** Quad section identifier when applicable. */
  sectionId?: string;
  /** Round number */
  round: number;
  /** Board number */
  board: number;
  /** White player ID */
  whiteId: string;
  /** Black player ID */
  blackId: string;
  /** Previous result (null if first entry) */
  previousResult: Result | null;
  /** New result */
  newResult: Result;
  /** Whether this entry recorded, corrected, or undid a result. */
  action?: "recorded" | "corrected" | "undone";
  /** Authenticated actor identifier when available. */
  actorId?: string | null;
  /** Human-readable actor label; never stores email addresses. */
  actorName?: string;
}

export interface ResultEntryActor {
  id: string | null;
  displayName: string;
}

export interface ResultEntryMeta {
  action?: ResultHistoryEntry["action"];
}

export function createResultHistoryEntry(
  game: Game,
  newResult: Result,
  actor: ResultEntryActor,
  historyIndex: number,
  meta?: ResultEntryMeta,
  now: Date = new Date(),
): ResultHistoryEntry {
  const previousResult = game.result === "*" ? null : game.result;
  return {
    id: `${now.getTime()}-${game.id}-${historyIndex}`,
    timestamp: now.toISOString(),
    gameId: game.id,
    ...(game.sectionId ? { sectionId: game.sectionId } : {}),
    round: game.round,
    board: game.board,
    whiteId: game.whiteId,
    blackId: game.blackId,
    previousResult,
    newResult,
    action: meta?.action ?? (previousResult === null ? "recorded" : "corrected"),
    actorId: actor.id,
    actorName: actor.displayName.trim() || "Tournament Director",
  };
}

export function computeTournamentLiveStandings(
  players: Player[],
  rounds: Round[],
  format: DirectorState["format"],
  quadSections?: QuadSection[],
): StandingRow[] {
  if (format !== "quads" || !quadSections?.length) {
    return computeStandings(players, rounds);
  }

  const games = rounds.flatMap((round) => round.games);
  return [...quadSections]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .flatMap((section) => {
      const sectionPlayers = players.filter((player) => section.playerIds.includes(player.id));
      return calculateQuadStandings(section, games, sectionPlayers).flatMap((standing) => {
        const player = sectionPlayers.find((candidate) => candidate.id === standing.playerId);
        if (!player) return [];
        return [{
          player,
          rank: standing.finalRank,
          points: standing.score,
          buchholz: 0,
          buchholzCut1: 0,
          sonnebornBerger: standing.sonnebornBerger,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          matchW: 0,
          matchD: 0,
          matchL: 0,
        }];
      });
    });
}

export function computeDirectorLiveStandings(state: DirectorState): StandingRow[] {
  return computeTournamentLiveStandings(state.players, state.rounds, state.format, state.quadSections);
}

export type PreviousRoundCorrectionEligibility =
  | {
      eligible: true;
      correctionRoundNumber: number;
      pairingRegenerationRequired: boolean;
    }
  | {
      eligible: false;
      reason: string;
    };

export type PreviousRoundCorrectionOutcome =
  | {
      applied: true;
      correctedRoundNumber: number;
      regeneratedRoundNumber: number;
      changedGameCount: number;
      pairingRegenerated: boolean;
      state: DirectorState;
    }
  | {
      applied: false;
      reason: string;
    };

/**
 * Corrections are deliberately limited to the immediately preceding round.
 * For Swiss-style and elimination events, the active round must still be clean
 * so its boards can be safely regenerated from the corrected prior results.
 * Quads schedule all pairings upfront, so their current boards remain stable.
 */
export function getPreviousRoundCorrectionEligibility(
  state: DirectorState,
): PreviousRoundCorrectionEligibility {
  if (state.status !== "in_progress" && state.status !== "paused") {
    return { eligible: false, reason: "Round corrections are available while the tournament is active." };
  }

  if (state.currentRound < 2) {
    return { eligible: false, reason: "A previous round is available after Round 2 begins." };
  }

  const correctionRoundNumber = state.currentRound - 1;
  const correctionRound = state.rounds.find((round) => round.number === correctionRoundNumber);
  const activeRound = state.rounds.find((round) => round.number === state.currentRound);
  if (!correctionRound || !activeRound) {
    return { eligible: false, reason: "The current round data is not ready for a safe correction." };
  }

  const previousRoundIsComplete = correctionRound.games.every((game) => game.result !== "*");
  if (!previousRoundIsComplete) {
    return { eligible: false, reason: `Round ${correctionRoundNumber} is not complete yet.` };
  }

  if (state.format !== "quads") {
    const activeRoundHasRecordedBoards = activeRound.games.some(
      (game) => game.result !== "*" && game.whiteId !== "BYE" && game.blackId !== "BYE",
    );
    if (activeRoundHasRecordedBoards) {
      return {
        eligible: false,
        reason: `Round ${state.currentRound} already has recorded boards, so its pairings can no longer be safely regenerated.`,
      };
    }
  }

  return {
    eligible: true,
    correctionRoundNumber,
    pairingRegenerationRequired: state.format !== "quads",
  };
}

function rescorePlayersFromCompletedRounds(players: Player[], completedRounds: Round[]): Player[] {
  let rescoredPlayers: Player[] = players.map((player) => ({
    ...player,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [] as ("W" | "B")[],
  }));

  for (const round of [...completedRounds].sort((a, b) => a.number - b.number)) {
    for (const game of round.games) {
      if (game.result === "*") continue;

      if (game.whiteId === "BYE" || game.blackId === "BYE") {
        const byeRecipientId = game.whiteId === "BYE" ? game.blackId : game.whiteId;
        rescoredPlayers = rescoredPlayers.map((player) =>
          player.id === byeRecipientId
            ? { ...player, points: player.points + 1, wins: player.wins + 1 }
            : player,
        );
        continue;
      }

      rescoredPlayers = applyResultToPlayers(
        rescoredPlayers,
        { ...game, result: "*" },
        game.result,
      );
    }
  }

  const standingsByPlayerId = new Map(
    computeStandings(rescoredPlayers, completedRounds).map((standing) => [standing.player.id, standing]),
  );

  return rescoredPlayers.map((player) => {
    const standing = standingsByPlayerId.get(player.id);
    return standing
      ? {
          ...player,
          points: standing.points,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          buchholz: standing.buchholz,
        }
      : player;
  });
}

function regenerateEliminationRound(
  state: DirectorState,
  correctedRounds: Round[],
  rescoredPlayers: Player[],
): { games: Game[]; elimPlayers?: Player[]; elimRoundLabelText?: string } {
  const correctionRound = correctedRounds.find((round) => round.number === state.currentRound - 1);
  if (!correctionRound) return { games: [] };

  const swissRoundCount = state.swissRounds ?? 0;
  if (state.format === "swiss_elim" && state.elimPhase === "elimination" && correctionRound.number === swissRoundCount) {
    const cutoffSize = state.elimCutoff ?? suggestElimCutoff(rescoredPlayers.length);
    const elimPlayers = computeStandings(rescoredPlayers, correctedRounds)
      .filter((standing) => !standing.player.withdrawn)
      .slice(0, cutoffSize)
      .map((standing) => standing.player);

    return {
      games: generateEliminationFirstRound(elimPlayers, state.currentRound),
      elimPlayers,
      elimRoundLabelText: elimRoundLabel(cutoffSize),
    };
  }

  const bracketPlayers = state.elimPlayers ?? rescoredPlayers;
  const eliminationGames = generateEliminationNextRound(
    correctionRound.games,
    bracketPlayers,
    state.currentRound,
  );

  if (state.format === "swiss_elim") {
    const nonByeGames = correctionRound.games.filter(
      (game) => game.whiteId !== "BYE" && game.blackId !== "BYE",
    );
    if (nonByeGames.length === 2 && eliminationGames.length === 1) {
      const thirdPlaceGame = generateThirdPlaceGame(
        correctionRound.games,
        bracketPlayers,
        state.currentRound,
      );
      if (thirdPlaceGame) eliminationGames.push(thirdPlaceGame);
    }
  }

  return {
    games: eliminationGames,
    elimRoundLabelText: elimRoundLabel(Math.max(2, eliminationGames.filter((game) => !game.isThirdPlace).length * 2)),
  };
}

/**
 * Applies a result correction to exactly one completed round back and atomically
 * replaces the active round with a fresh pairing set when pairings are dynamic.
 */
export function applyPreviousRoundCorrection(
  state: DirectorState,
  correctedResults: Record<string, Result>,
  actor: ResultEntryActor = { id: null, displayName: "Tournament Director" },
  now: Date = new Date(),
): PreviousRoundCorrectionOutcome {
  const eligibility = getPreviousRoundCorrectionEligibility(state);
  if (!eligibility.eligible) return { applied: false, reason: eligibility.reason };

  const correctionRoundNumber = eligibility.correctionRoundNumber;
  const previousRound = state.rounds.find((round) => round.number === correctionRoundNumber);
  if (!previousRound) return { applied: false, reason: "The previous round could not be found." };

  const correctedGames = previousRound.games.map((game) => {
    if (game.whiteId === "BYE" || game.blackId === "BYE") return game;
    return { ...game, result: correctedResults[game.id] ?? game.result };
  });

  if (correctedGames.some((game) => game.result === "*")) {
    return { applied: false, reason: `Every board in Round ${correctionRoundNumber} needs a result before pairings can be regenerated.` };
  }

  const changedGames = correctedGames.filter((game) => {
    const priorGame = previousRound.games.find((candidate) => candidate.id === game.id);
    return priorGame?.result !== game.result;
  });
  if (changedGames.length === 0) {
    return { applied: false, reason: "Choose at least one different result to apply a correction." };
  }

  const correctedHistoricalRounds = state.rounds
    .filter((round) => round.number < state.currentRound)
    .map((round) => round.number === correctionRoundNumber
      ? { ...round, status: "completed" as const, games: correctedGames }
      : round,
    );
  const rescoredPlayers = rescorePlayersFromCompletedRounds(state.players, correctedHistoricalRounds);

  let regeneratedGames: Game[];
  let nextElimPlayers = state.elimPlayers;
  let nextElimRoundLabelText = state.elimRoundLabelText;

  if (state.format === "quads") {
    regeneratedGames = state.rounds.find((round) => round.number === state.currentRound)?.games ?? [];
  } else if (state.format === "elimination" || (state.format === "swiss_elim" && state.elimPhase === "elimination")) {
    const regeneration = regenerateEliminationRound(state, correctedHistoricalRounds, rescoredPlayers);
    regeneratedGames = regeneration.games;
    nextElimPlayers = regeneration.elimPlayers ?? nextElimPlayers;
    nextElimRoundLabelText = regeneration.elimRoundLabelText ?? nextElimRoundLabelText;
  } else if (state.format === "doubleswiss") {
    regeneratedGames = generateDoubleSwissPairings(rescoredPlayers, correctedHistoricalRounds, state.currentRound);
  } else {
    regeneratedGames = generateSwissPairings(rescoredPlayers, correctedHistoricalRounds, state.currentRound);
  }

  if (state.format !== "quads" && regeneratedGames.length === 0) {
    return { applied: false, reason: "The active round could not be regenerated from the corrected results." };
  }

  const rounds = state.rounds.map((round) => {
    if (round.number === correctionRoundNumber) {
      return { ...round, status: "completed" as const, games: correctedGames };
    }
    if (round.number === state.currentRound) {
      return { ...round, status: "in_progress" as const, games: regeneratedGames };
    }
    return round;
  });

  const historyStart = state.resultHistory?.length ?? 0;
  const correctionHistory = changedGames.map((game, index) => {
    const priorGame = previousRound.games.find((candidate) => candidate.id === game.id)!;
    return createResultHistoryEntry(
      priorGame,
      game.result,
      actor,
      historyStart + index,
      { action: "corrected" },
      new Date(now.getTime() + index),
    );
  });

  const nextState: DirectorState = {
    ...state,
    players: rescoredPlayers,
    rounds,
    ...(nextElimPlayers ? { elimPlayers: nextElimPlayers } : {}),
    ...(nextElimRoundLabelText ? { elimRoundLabelText: nextElimRoundLabelText } : {}),
    resultHistory: [...(state.resultHistory ?? []), ...correctionHistory],
  };

  return {
    applied: true,
    correctedRoundNumber: correctionRoundNumber,
    regeneratedRoundNumber: state.currentRound,
    changedGameCount: changedGames.length,
    pairingRegenerated: eligibility.pairingRegenerationRequired,
    state: nextState,
  };
}

interface PersistedState {
  schemaVersion: number;
  savedAt: string;
  state: DirectorState;
  serverRevision?: number;
}

type ServerStateResponse = {
  state: DirectorState;
  updatedAt: string;
  revision?: number;
  currentRevision?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDemoInitialState(): DirectorState {
  return {
    tournamentId: "otb-demo-2026",
    tournamentName: DEMO_TOURNAMENT.name,
    totalRounds: DEMO_TOURNAMENT.rounds,
    format: "swiss",
    players: DEMO_TOURNAMENT.players.map((p) => ({ ...p })),
    rounds: DEMO_TOURNAMENT.roundData.map((r) => ({
      ...r,
      games: r.games.map((g) => ({ ...g })),
    })),
    currentRound: DEMO_TOURNAMENT.currentRound,
    status: "in_progress",
    roundMinutes: 25,
  };
}

function getNewTournamentState(config: TournamentConfig): DirectorState {
  return {
    tournamentId: config.id,
    tournamentName: config.name,
    totalRounds: config.format === "quads" ? 3 : config.rounds,
    format: config.format ?? "swiss",
    players: [],
    rounds: [],
    currentRound: 0,
    status: "registration",
    roundMinutes: 25,
    ...(config.format === "swiss_elim" ? {
      swissRounds: config.swissRounds ?? config.rounds,
      elimPhase: "swiss" as const,
    } : {}),
    ...(config.format === "quads" ? {
      quadSettings: {
        ...DEFAULT_QUAD_SETTINGS,
        ratingSource: config.quadRatingSource ?? config.ratingType ?? "rapid",
        ratingType: config.ratingType ?? "rapid",
      },
    } : {}),
  };
}

/**
 * Safe temporary state for a real tournament before its authoritative server
 * snapshot arrives. Unknown IDs must never render the demo tournament's roster,
 * rounds, standings, or name under a historical/public route.
 */
function getUnresolvedInitialState(tournamentId: string): DirectorState {
  return {
    tournamentId,
    tournamentName: "Tournament",
    totalRounds: 0,
    format: "swiss",
    players: [],
    rounds: [],
    currentRound: 0,
    status: "registration",
    roundMinutes: 25,
  };
}

function loadFromStorage(tournamentId: string): DirectorState | null {
  try {
    const raw = localStorage.getItem(storageKey(tournamentId));
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      localStorage.removeItem(storageKey(tournamentId));
      return null;
    }
    // Migrate: add roundMinutes if missing from older persisted state
    if (typeof parsed.state.roundMinutes !== "number") {
      parsed.state.roundMinutes = 25;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

function saveToStorage(tournamentId: string, state: DirectorState): void {
  try {
    const persisted: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(storageKey(tournamentId), JSON.stringify(persisted));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/** Load a tournament's director state from localStorage (read-only, no hook). */
export function loadTournamentState(tournamentId: string): DirectorState | null {
  return loadFromStorage(tournamentId);
}

/**
 * Standalone function — can be called from any page (e.g. Join page) to add a
 * player directly to a tournament's localStorage store without needing the hook.
 * The Director Dashboard will pick up the change via the storage event listener.
 */
export type AddPlayerResult =
  | { success: true; reason: "ok" }
  | { success: false; reason: "duplicate" | "full" | "closed" | "unknown" };

export function addPlayerToTournament(tournamentId: string, player: Player): AddPlayerResult {
  try {
    let existing = loadFromStorage(tournamentId);
    // If no persisted state yet, try to bootstrap from registry config
    if (!existing) {
      const config = getTournamentConfig(tournamentId);
      if (!config) return { success: false, reason: "unknown" };
      existing = getNewTournamentState(config);
    }
    // Registration is only valid before Round 1 starts. The explicit demo
    // tournament remains open so public exploration continues to work.
    if (tournamentId !== "otb-demo-2026" && existing.status !== "registration") {
      return { success: false, reason: "closed" };
    }
    // Prevent duplicate registrations
    if (existing.players.some((p) => p.id === player.id || p.username === player.username)) {
      return { success: false, reason: "duplicate" };
    }
    // Enforce player cap from registry config
    const config = getTournamentConfig(tournamentId);
    const maxPlayers = config?.maxPlayers ?? Infinity;
    if (existing.players.length >= maxPlayers) {
      return { success: false, reason: "full" };
    }
    const playerWithTimestamp: Player = { ...player, joinedAt: Date.now() };
    const updated: DirectorState = { ...existing, players: [...existing.players, playerWithTimestamp] };
    saveToStorage(tournamentId, updated);
    return { success: true, reason: "ok" };
  } catch {
    return { success: false, reason: "unknown" };
  }
}

/** Roll back a local Join mutation when authoritative server sync rejects it. */
export function removeJoinedPlayerFromTournament(tournamentId: string, playerId: string): boolean {
  try {
    const existing = loadFromStorage(tournamentId);
    if (!existing) return false;
    const players = existing.players.filter((player) => player.id !== playerId);
    if (players.length === existing.players.length) return false;
    saveToStorage(tournamentId, { ...existing, players });
    return true;
  } catch {
    return false;
  }
}

function getSavedAt(tournamentId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(tournamentId));
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    return parsed.savedAt ?? null;
  } catch {
    return null;
  }
}

function resolveInitialState(tournamentId: string): DirectorState {
  // 1. Try to load persisted state for this tournament
  const persisted = loadFromStorage(tournamentId);
  if (persisted) return persisted;

  // 2. Demo tournament — use hardcoded data
  if (tournamentId === "otb-demo-2026") {
    return getDemoInitialState();
  }

  // 3. Newly created tournament — look up config from registry
  const config = getTournamentConfig(tournamentId);
  if (config) {
    return getNewTournamentState(config);
  }

  // 4. Unknown ID — wait for server hydration without impersonating the demo.
  return getUnresolvedInitialState(tournamentId);
}

export type LatePlayerOutcome =
  | { paired: true; opponentName: string; board: number }
  | { bye: true }
  | { duplicate: true }
  | { locked: true };

export interface LatePlayerRegistrationTransition {
  state: DirectorState;
  outcome: LatePlayerOutcome;
}

/**
 * Applies a Round 1 late-registration update as a single deterministic state transition.
 * Double Swiss boards stay atomic: if either color is reported, both games are retained.
 */
export function applyLatePlayerRegistration(
  previousState: DirectorState,
  player: Player,
): LatePlayerRegistrationTransition {
  if (previousState.status !== "in_progress" || previousState.currentRound !== 1 || previousState.format === "quads") {
    return { state: previousState, outcome: { locked: true } };
  }

  if (previousState.players.some((candidate) => candidate.id === player.id || (candidate.username && candidate.username === player.username))) {
    return { state: previousState, outcome: { duplicate: true } };
  }

  const round1 = previousState.rounds.find((round) => round.number === 1);
  if (!round1) return { state: previousState, outcome: { locked: true } };

  // A scored non-bye game has started. Automatic byes can be refreshed if another
  // player walks in, preventing avoidable consecutive byes before results are due.
  const hasReportedContestResult = (game: Game) =>
    game.result !== "*" && game.whiteId !== "BYE" && game.blackId !== "BYE";

  const lockedBoardNumbers = previousState.format === "doubleswiss"
    ? new Set(
        Array.from(new Set(round1.games.map((game) => game.board))).filter((board) =>
          round1.games.some((game) => game.board === board && hasReportedContestResult(game)),
        ),
      )
    : new Set<number>();
  const lockedGames = round1.games.filter((game) =>
    previousState.format === "doubleswiss"
      ? lockedBoardNumbers.has(game.board)
      : hasReportedContestResult(game),
  );
  const openGames = round1.games.filter((game) =>
    previousState.format === "doubleswiss"
      ? !lockedBoardNumbers.has(game.board)
      : !hasReportedContestResult(game),
  );

  const openPlayerIds = new Set<string>();
  for (const game of openGames) {
    if (game.whiteId !== "BYE") openPlayerIds.add(game.whiteId);
    if (game.blackId !== "BYE") openPlayerIds.add(game.blackId);
  }

  const updatedPlayers = [...previousState.players, player];
  const openPlayers = updatedPlayers.filter((candidate) => openPlayerIds.has(candidate.id) || candidate.id === player.id);
  const freshOpenGames = previousState.format === "doubleswiss"
    ? generateDoubleSwissPairings(openPlayers, [], 1)
    : generateSwissPairings(openPlayers, [], 1);

  // Map each fresh source board once so Double Swiss color-swapped games remain
  // together on one reporting card after the refreshed boards follow locked ones.
  const lockedMaxBoard = lockedGames.length > 0 ? Math.max(...lockedGames.map((game) => game.board)) : 0;
  const freshBoardNumbers = Array.from(new Set(freshOpenGames.map((game) => game.board))).sort((a, b) => a - b);
  const freshBoardMap = new Map(freshBoardNumbers.map((board, index) => [board, lockedMaxBoard + index + 1]));
  const numberedFreshGames = freshOpenGames.map((game) => ({
    ...game,
    board: freshBoardMap.get(game.board) ?? game.board,
  }));

  const newPlayerGame = numberedFreshGames.find((game) => game.whiteId === player.id || game.blackId === player.id);
  const outcome: LatePlayerOutcome = !newPlayerGame || newPlayerGame.whiteId === "BYE" || newPlayerGame.blackId === "BYE"
    ? { bye: true }
    : (() => {
        const opponentId = newPlayerGame.whiteId === player.id ? newPlayerGame.blackId : newPlayerGame.whiteId;
        const opponent = updatedPlayers.find((candidate) => candidate.id === opponentId);
        return { paired: true, opponentName: opponent?.name ?? "Unknown", board: newPlayerGame.board };
      })();

  return {
    state: {
      ...previousState,
      players: updatedPlayers,
      rounds: previousState.rounds.map((round) => round.number === 1
        ? { ...round1, games: [...lockedGames, ...numberedFreshGames] }
        : round,
      ),
    },
    outcome,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDirectorState(
  tournamentId: string = "otb-demo-2026",
  resultActor: ResultEntryActor = { id: null, displayName: "Tournament Director" },
) {
  const [state, setState] = useState<DirectorState>(() => resolveInitialState(tournamentId));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [lastSaved, setLastSaved] = useState<string | null>(() => getSavedAt(tournamentId));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverRevisionRef = useRef<number | null>(null);
  const isDemo = tournamentId === "otb-demo-2026";

  // Hydrate from server on first mount (recovers from page refresh / device switch)
  useEffect(() => {
    if (isDemo) return;
    fetch(`/api/tournament/${tournamentId}/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ServerStateResponse | null) => {
        if (!data?.state) return;
        const serverState = data.state as DirectorState;
        serverRevisionRef.current = typeof data.revision === "number" ? data.revision : null;
        // Only hydrate if the server state is newer than what's in localStorage
        const localRaw = localStorage.getItem(storageKey(tournamentId));
        if (localRaw) {
          try {
            const local: PersistedState = JSON.parse(localRaw);
            const localTime = new Date(local.savedAt).getTime();
            const serverTime = new Date(data.updatedAt as string).getTime();
            if (localTime >= serverTime) return; // local is at least as fresh
          } catch { /* fall through and use server state */ }
        }
        setState(serverState);
        saveToStorage(tournamentId, serverState);
        setLastSaved(data.updatedAt as string);
      })
      .catch(() => { /* network unavailable — stay with localStorage */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // Auto-save to localStorage whenever state changes (debounced 300ms)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToStorage(tournamentId, state);
      setLastSaved(new Date().toISOString());
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, tournamentId]);

  // Auto-save to server whenever state changes (debounced 1500ms, skip demo)
  useEffect(() => {
    if (isDemo) return;
    if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    serverSaveTimerRef.current = setTimeout(() => {
      const requestBody = serverRevisionRef.current === null
        ? { state }
        : { state, baseRevision: serverRevisionRef.current };
      fetch(`/api/tournament/${tournamentId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
        .then(async (response) => {
          if (response.status === 409) {
            const conflict = await response.json().catch(() => null) as ServerStateResponse | null;
            if (conflict?.state) {
              serverRevisionRef.current = typeof conflict.currentRevision === "number" ? conflict.currentRevision : serverRevisionRef.current;
              console.warn("[director-state] Stale tournament state save rejected; keeping local state until reload.", conflict);
            }
            return;
          }
          if (!response.ok) return;
          const saved = await response.json().catch(() => null) as { revision?: number } | null;
          if (typeof saved?.revision === "number") serverRevisionRef.current = saved.revision;
        })
        .catch(() => { /* fire-and-forget — localStorage is the fallback */ });
    }, 1500);
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    };
  }, [state, tournamentId, isDemo]);

  /**
   * Sends a current state snapshot using the same optimistic revision contract
   * as the debounced writer. Result entry paths use this to publish public
   * standings without issuing an intentionally doomed revision-less PUT.
   */
  const flushStateToServer = useCallback(async (nextState: DirectorState): Promise<boolean> => {
    if (isDemo) return true;
    const requestBody = serverRevisionRef.current === null
      ? { state: nextState }
      : { state: nextState, baseRevision: serverRevisionRef.current };
    try {
      const response = await fetch(`/api/tournament/${tournamentId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) return false;
      const saved = await response.json().catch(() => null) as { revision?: number } | null;
      if (typeof saved?.revision === "number") serverRevisionRef.current = saved.revision;
      return true;
    } catch {
      return false;
    }
  }, [isDemo, tournamentId]);

  // Re-sync from localStorage when the tab regains visibility (phone unlock, app switch)
  useVisibilitySync(() => {
    const fresh = loadFromStorage(tournamentId);
    if (fresh) setState(fresh);
  });

  // Listen for storage events from other tabs (e.g. Join page adding a player)
  useEffect(() => {
    function handleStorageEvent(e: StorageEvent) {
      if (e.key === storageKey(tournamentId) && e.newValue) {
        try {
          const parsed: PersistedState = JSON.parse(e.newValue);
          if (parsed.schemaVersion === SCHEMA_VERSION) {
            setState(parsed.state);
          }
        } catch {
          // ignore malformed data
        }
      }
    }
    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, [tournamentId]);

  // Add a player to the registration list
  const addPlayer = useCallback((player: Player) => {
    setState((prev) => {
      // Prevent duplicate registrations
      if (prev.players.some((p) => p.id === player.id || p.username === player.username)) {
        return prev;
      }
      return { ...prev, players: [...prev.players, player] };
    });
  }, []);

  const addLatePlayer = useCallback((player: Player): LatePlayerOutcome => {
    const transition = applyLatePlayerRegistration(stateRef.current, player);
    if (transition.state !== stateRef.current) {
      stateRef.current = transition.state;
      setState(transition.state);
    }
    return transition.outcome;
  }, []);

  // Remove a player from the registration list (only during registration phase)
  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => {
      if (prev.status !== "registration") return prev;
      return {
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
        // A pre-start Quads roster can already have provisional sections. Keep
        // those references in sync so the later pairing flow never sees a
        // player who has been removed from the registration roster.
        ...(prev.quadSections
          ? {
              quadSections: prev.quadSections.map((section) => ({
                ...section,
                playerIds: section.playerIds.filter((id) => id !== playerId),
              })),
            }
          : {}),
      };
    });
  }, []);

  // Remove a player during Round 1 and regenerate pairings preserving original matchups
  const removePlayerRound1 = useCallback((playerId: string) => {
    setState((prev) => {
      if (prev.status !== "in_progress" || prev.currentRound !== 1) return prev;
      const remainingPlayers = prev.players.filter((p) => p.id !== playerId);
      if (remainingPlayers.length < 2) return prev;

      // Get the current Round 1 games to preserve matchups
      const currentR1 = prev.rounds.find((r) => r.number === 1);
      const oldGames = currentR1?.games ?? [];

      // Build a set of original pairings (excluding the removed player and BYEs)
      const preservedPairs = new Set<string>();
      for (const g of oldGames) {
        if (g.whiteId === "BYE" || g.blackId === "BYE") continue;
        if (g.whiteId === playerId || g.blackId === playerId) continue;
        preservedPairs.add([g.whiteId, g.blackId].sort().join("|"));
      }

      // Generate fresh pairings for remaining players
      const freshGames = generateSwissPairings(remainingPlayers, [], 1);

      // Score each fresh game: +1 if it preserves an original pairing
      // Try to keep as many original matchups as possible
      // The generateSwissPairings for Round 1 uses top-half/bottom-half which
      // will naturally produce similar pairings when only 1 player is removed.
      // For additional stability, we check if the fresh pairings already preserve
      // most originals (they should, since seeding order is mostly unchanged).

      const newRound: Round = { number: 1, status: "in_progress", games: freshGames };
      return {
        ...prev,
        players: remainingPlayers,
        rounds: prev.rounds.map((r) => r.number === 1 ? newRound : r),
      };
    });
  }, []);

  /**
   * Withdraw an active player between rounds. Historical games and standings are
   * deliberately retained, while future Swiss pairing generation excludes them.
   * Quads and an active elimination bracket have structurally prebuilt paths, so
   * directors are prevented from creating an invalid partial withdrawal there.
   */
  const withdrawPlayer = useCallback((playerId: string): void => {
    setState((prev) => {
      if (
        prev.status === "registration" ||
        prev.status === "completed" ||
        prev.format === "quads" ||
        prev.format === "roundrobin" ||
        prev.format === "elimination" ||
        (prev.format === "swiss_elim" && prev.elimPhase === "elimination")
      ) return prev;
      const target = prev.players.find((player) => player.id === playerId);
      if (!target || target.withdrawn) return prev;
      return {
        ...prev,
        players: prev.players.map((player) =>
          player.id === playerId
            ? { ...player, withdrawn: true, withdrawnAt: new Date().toISOString() }
            : player,
        ),
      };
    });
  }, []);

  /** Reinstatement returns a player to eligibility for the next generated round. */
  const reinstatePlayer = useCallback((playerId: string): void => {
    setState((prev) => {
      if (
        prev.status === "registration" ||
        prev.status === "completed" ||
        prev.format === "quads" ||
        prev.format === "roundrobin" ||
        prev.format === "elimination" ||
        (prev.format === "swiss_elim" && prev.elimPhase === "elimination")
      ) return prev;
      const target = prev.players.find((player) => player.id === playerId);
      if (!target?.withdrawn) return prev;
      return {
        ...prev,
        players: prev.players.map((player) =>
          player.id === playerId
            ? { ...player, withdrawn: false, withdrawnAt: undefined }
            : player,
        ),
      };
    });
  }, []);

  // Start the tournament — transition from registration to Round 1
  const startTournament = useCallback((): { round1Games: Game[]; players: Player[] } | null => {
    let result: { round1Games: Game[]; players: Player[] } | null = null;
    setState((prev) => {
      if (!isPlayerCountValid(prev.format, prev.players.length)) return prev;
      let games: Game[];
      let nextState: DirectorState;
      if (prev.format === "quads") {
        // Quads: generate all sections and all 3 rounds upfront
        const settings = prev.quadSettings ?? DEFAULT_QUAD_SETTINGS;
        const quadResult = generateQuadTournament(prev.players, settings);
        const rounds: Round[] = [];
        for (let r = 1; r <= quadResult.rounds; r++) {
          const roundGames = quadResult.games.filter((g) => g.round === r);
          rounds.push({ number: r, status: r === 1 ? "in_progress" : "pending" as any, games: roundGames });
        }
        games = rounds[0]?.games ?? [];
        nextState = {
          ...prev,
          rounds,
          currentRound: 1,
          totalRounds: quadResult.rounds,
          status: "in_progress",
          quadSections: quadResult.sections,
          quadSettings: settings,
        };
      } else if (prev.format === "doubleswiss") {
        games = generateDoubleSwissPairings(prev.players, [], 1);
        const round1: Round = { number: 1, status: "in_progress", games };
        nextState = { ...prev, rounds: [round1], currentRound: 1, status: "in_progress" };
      } else if (prev.format === "swiss_elim") {
        games = generateSwissPairings(prev.players, [], 1);
        const round1: Round = { number: 1, status: "in_progress", games };
        nextState = {
          ...prev,
          rounds: [round1],
          currentRound: 1,
          status: "in_progress",
          elimPhase: "swiss",
          swissRounds: prev.swissRounds ?? prev.totalRounds,
        };
      } else {
        games = generateSwissPairings(prev.players, [], 1);
        const round1: Round = { number: 1, status: "in_progress", games };
        nextState = { ...prev, rounds: [round1], currentRound: 1, status: "in_progress" };
      }
      result = { round1Games: games, players: prev.players };
      return nextState;
    });
    return result;
  }, []);

  // Enter a result for a game and append a durable audit record.
  const enterResult = useCallback((gameId: string, result: Result, meta?: ResultEntryMeta) => {
    setState((prev) => {
      // Find the game being updated
      let targetGame: Game | undefined;
      for (const r of prev.rounds) {
        targetGame = r.games.find((g) => g.id === gameId);
        if (targetGame) break;
      }

      if (!targetGame || targetGame.result === result) return prev;

      // Update rounds with the new result
      const rounds = prev.rounds.map((r) => ({
        ...r,
        games: r.games.map((g) => (g.id !== gameId ? g : { ...g, result })),
      }));

      // Update player scores using the Swiss engine
      const players = targetGame
        ? applyResultToPlayers(prev.players, { ...targetGame }, result)
        : prev.players;

      // Quads use section-local Sonneborn-Berger and must not inherit Swiss Buchholz.
      const playersWithBuchholz = prev.format === "quads"
        ? players.map((player) => ({ ...player, buchholz: 0 }))
        : (() => {
            const standings = computeStandings(players, rounds);
            const buchholzMap = new Map(standings.map((standing) => [standing.player.id, standing.buchholz]));
            return players.map((player) => ({
              ...player,
              buchholz: buchholzMap.get(player.id) ?? player.buchholz,
            }));
          })();

      // Mark round as completed if all results are in
      const currentRoundData = rounds.find((r) => r.number === prev.currentRound);
      const roundComplete = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      const updatedRounds = rounds.map((r) =>
        r.number === prev.currentRound && roundComplete
          ? { ...r, status: "completed" as const }
          : r
      );

      // Audit trail: record the result change
      const historyEntry = createResultHistoryEntry(
        targetGame,
        result,
        resultActor,
        prev.resultHistory?.length ?? 0,
        meta,
      );
      const resultHistory = [...(prev.resultHistory ?? []), historyEntry];

      return { ...prev, rounds: updatedRounds, players: playersWithBuchholz, resultHistory };
    });
  }, [resultActor]);

  // Correct the immediately preceding round, then replace the clean active-round
  // pairings from the corrected standing order in one atomic state transition.
  const correctPreviousRound = useCallback((correctedResults: Record<string, Result>): PreviousRoundCorrectionOutcome => {
    const outcome = applyPreviousRoundCorrection(state, correctedResults, resultActor);
    if (outcome.applied) setState(outcome.state);
    return outcome;
  }, [resultActor, state]);

  // Generate pairings for next round using the full Swiss engine
  const generateNextRound = useCallback((): { roundNum: number; games: Game[]; players: Player[] } | null => {
    let result: { roundNum: number; games: Game[]; players: Player[] } | null = null;
    setState((prev) => {
      const nextRoundNum = prev.currentRound + 1;

      // Ensure current round is complete
      const currentRoundData = prev.rounds.find((r) => r.number === prev.currentRound);
      const allDone = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      if (!allDone) return prev;

      // ── Quads format — rounds are pre-generated, just advance ──────────
      if (prev.format === "quads") {
        if (nextRoundNum > prev.totalRounds) return prev;
        const nextRound = prev.rounds.find((r) => r.number === nextRoundNum);
        if (!nextRound) return prev;
        result = { roundNum: nextRoundNum, games: nextRound.games, players: prev.players };
        return {
          ...prev,
          currentRound: nextRoundNum,
          rounds: prev.rounds.map((r) =>
            r.number === nextRoundNum ? { ...r, status: "in_progress" } : r
          ),
        };
      }

      // ── Swiss-Elim format ──────────────────────────────────────────────
      if (prev.format === "swiss_elim") {
        const swissRoundCount = prev.swissRounds ?? prev.totalRounds;

        // Still in Swiss phase
        if (prev.elimPhase === "swiss" && prev.currentRound < swissRoundCount) {
          const newGames = generateSwissPairings(prev.players, prev.rounds, nextRoundNum);
          const newRound: Round = { number: nextRoundNum, status: "in_progress", games: newGames };
          result = { roundNum: nextRoundNum, games: newGames, players: prev.players };
          return {
            ...prev,
            rounds: [...prev.rounds, newRound],
            currentRound: nextRoundNum,
          };
        }

        // Swiss phase just completed — auto-generate elimination bracket
        if (prev.elimPhase === "swiss" && prev.currentRound >= swissRoundCount) {
          const eligiblePlayers = getPairingEligiblePlayers(prev.players);
          const cutoffSize = suggestElimCutoff(eligiblePlayers.length);
          const standings = computeStandings(prev.players, prev.rounds)
            .filter((standing) => !standing.player.withdrawn);
          const advancingPlayers = standings.slice(0, cutoffSize).map((s) => s.player);
          const elimGames = generateEliminationFirstRound(advancingPlayers, nextRoundNum);
          const newRound: Round = { number: nextRoundNum, status: "in_progress", games: elimGames };
          const elimRoundsCount = Math.ceil(Math.log2(cutoffSize));
          result = { roundNum: nextRoundNum, games: elimGames, players: prev.players };
          return {
            ...prev,
            rounds: [...prev.rounds, newRound],
            currentRound: nextRoundNum,
            totalRounds: prev.currentRound + elimRoundsCount,
            elimPhase: "elimination",
            elimCutoff: cutoffSize,
            elimPlayers: advancingPlayers,
            elimRoundLabelText: elimRoundLabel(cutoffSize),
          };
        }

        // In elimination phase — advance winners
        if (prev.elimPhase === "elimination") {
          const lastRound = prev.rounds.find((r) => r.number === prev.currentRound);
          if (!lastRound) return prev;
          const allPlayersForLookup = prev.elimPlayers ?? prev.players;
          const newGames = generateEliminationNextRound(lastRound.games, allPlayersForLookup, nextRoundNum);
          if (newGames.length === 0) return prev; // tournament over
          const playersRemaining = newGames.filter(g => g.whiteId !== "BYE" && g.blackId !== "BYE").length * 2;

          // ── 3rd-place consolation match ──────────────────────────────────
          // When advancing from the semi-finals (2 games → 1 final game),
          // generate a consolation game between the two semi-final losers.
          // The 3rd-place game is added to the same round as the Final.
          const isSemiFinalToFinal = lastRound.games.filter(g => g.whiteId !== "BYE" && g.blackId !== "BYE").length === 2 && newGames.length === 1;
          let gamesForNewRound = newGames;
          if (isSemiFinalToFinal) {
            const thirdPlaceGame = generateThirdPlaceGame(lastRound.games, allPlayersForLookup, nextRoundNum);
            if (thirdPlaceGame) {
              gamesForNewRound = [...newGames, thirdPlaceGame];
            }
          }

          const newRound: Round = { number: nextRoundNum, status: "in_progress", games: gamesForNewRound };
          result = { roundNum: nextRoundNum, games: gamesForNewRound, players: prev.players };
          return {
            ...prev,
            rounds: [...prev.rounds, newRound],
            currentRound: nextRoundNum,
            totalRounds: nextRoundNum + (newGames.length === 1 ? 0 : Math.ceil(Math.log2(playersRemaining))),
            elimRoundLabelText: elimRoundLabel(newGames.length * 2),
          };
        }

        return prev;
      }

      // ── Standard formats ───────────────────────────────────────────────
      if (nextRoundNum > prev.totalRounds) return prev;

      // Use the correct pairing engine based on format
      const newGames = prev.format === "doubleswiss"
        ? generateDoubleSwissPairings(prev.players, prev.rounds, nextRoundNum)
        : generateSwissPairings(prev.players, prev.rounds, nextRoundNum);
      const newRound: Round = {
        number: nextRoundNum,
        status: "in_progress",
        games: newGames,
      };

      result = { roundNum: nextRoundNum, games: newGames, players: prev.players };
      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        currentRound: nextRoundNum,
      };
    });
    return result;
  }, []);

  // Generate the elimination bracket with a director-chosen cutoff size (swiss_elim only)
  // Called when the Swiss phase is complete and the director confirms the cutoff in the modal
  const generateNextRoundWithCutoff = useCallback((cutoffSize: number): { roundNum: number; games: Game[]; players: Player[]; elimPhase: string; elimPlayers: Player[] } | null => {
    let result: { roundNum: number; games: Game[]; players: Player[]; elimPhase: string; elimPlayers: Player[] } | null = null;
    setState((prev) => {
      if (prev.format !== "swiss_elim" || prev.elimPhase !== "swiss") return prev;
      const currentRoundData = prev.rounds.find((r) => r.number === prev.currentRound);
      const allDone = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      if (!allDone) return prev;
      const nextRoundNum = prev.currentRound + 1;
      const standings = computeStandings(prev.players, prev.rounds)
        .filter((standing) => !standing.player.withdrawn);
      const effectiveCutoff = Math.min(cutoffSize, suggestElimCutoff(standings.length));
      const advancingPlayers = standings.slice(0, effectiveCutoff).map((s) => s.player);
      const elimGames = generateEliminationFirstRound(advancingPlayers, nextRoundNum);
      const newRound: Round = { number: nextRoundNum, status: "in_progress", games: elimGames };
      const elimRoundsCount = Math.ceil(Math.log2(effectiveCutoff));
      result = { roundNum: nextRoundNum, games: elimGames, players: prev.players, elimPhase: "elimination", elimPlayers: advancingPlayers };
      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        currentRound: nextRoundNum,
        totalRounds: prev.currentRound + elimRoundsCount,
        elimPhase: "elimination",
        elimCutoff: effectiveCutoff,
        elimPlayers: advancingPlayers,
        elimRoundLabelText: elimRoundLabel(effectiveCutoff),
      };
    });
    return result;
  }, []);

  // Reset/override the elimination bracket with a new cutoff size (swiss_elim only)
  // Safe to call when elimPhase === "elimination" AND no results have been entered yet
  const resetElimination = useCallback((cutoffSize: number) => {
    setState((prev) => {
      if (prev.format !== "swiss_elim" || prev.elimPhase !== "elimination") return prev;

      // Only allow reset if no elimination results have been entered yet
      const swissRoundCount = prev.swissRounds ?? 0;
      const elimRoundsInState = prev.rounds.filter((r) => r.number > swissRoundCount);
      const hasAnyResult = elimRoundsInState.some((r) =>
        r.games.some((g) => g.result !== "*" && g.whiteId !== "BYE" && g.blackId !== "BYE")
      );
      if (hasAnyResult) return prev; // refuse to reset if results already entered

      // Remove all elimination rounds from state
      const swissRoundsOnly = prev.rounds.filter((r) => r.number <= swissRoundCount);

      // Re-generate with new cutoff
      const standings = computeStandings(prev.players, swissRoundsOnly)
        .filter((standing) => !standing.player.withdrawn);
      const effectiveCutoff = Math.min(cutoffSize, suggestElimCutoff(standings.length));
      const advancingPlayers = standings.slice(0, effectiveCutoff).map((s) => s.player);
      const nextRoundNum = swissRoundCount + 1;
      const elimGames = generateEliminationFirstRound(advancingPlayers, nextRoundNum);
      const newRound: Round = { number: nextRoundNum, status: "in_progress", games: elimGames };
      const elimRoundsCount = Math.ceil(Math.log2(effectiveCutoff));

      return {
        ...prev,
        rounds: [...swissRoundsOnly, newRound],
        currentRound: nextRoundNum,
        totalRounds: swissRoundCount + elimRoundsCount,
        elimCutoff: effectiveCutoff,
        elimPlayers: advancingPlayers,
        elimRoundLabelText: elimRoundLabel(effectiveCutoff),
      };
    });
  }, []);

  // Advance from Swiss to Elimination phase (swiss_elim format only)
  const advanceToElimination = useCallback((cutoffSize: number) => {
    setState((prev) => {
      if (prev.format !== "swiss_elim" || prev.elimPhase !== "cutoff") return prev;

      // Get standings from the Swiss phase
      const standings = computeStandings(prev.players, prev.rounds)
        .filter((standing) => !standing.player.withdrawn);
      const effectiveCutoff = Math.min(cutoffSize, suggestElimCutoff(standings.length));
      const advancingPlayers = standings.slice(0, effectiveCutoff).map((s) => s.player);

      // Generate first elimination round
      const nextRoundNum = prev.currentRound + 1;
      const elimGames = generateEliminationFirstRound(advancingPlayers, nextRoundNum);
      const newRound: Round = { number: nextRoundNum, status: "in_progress", games: elimGames };

      // Calculate total rounds needed
      const elimRoundsCount = Math.ceil(Math.log2(effectiveCutoff));

      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        currentRound: nextRoundNum,
        totalRounds: prev.currentRound + elimRoundsCount,
        elimPhase: "elimination",
        elimCutoff: effectiveCutoff,
        elimPlayers: advancingPlayers,
        elimRoundLabelText: elimRoundLabel(effectiveCutoff),
      };
    });
  }, []);

  // Mark tournament as complete after final round results are in
  const completeTournament = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "completed",
      // Mark all rounds as completed so the public snapshot reflects the final state
      rounds: prev.rounds.map((r) => ({ ...r, status: "completed" as const })),
      // For Quads: mark all sections as completed
      ...(prev.quadSections
        ? {
            quadSections: prev.quadSections.map((s) => ({
              ...s,
              status: "completed" as const,
            })),
          }
        : {}),
    }));
  }, []);

  // Pause / resume tournament
  const togglePause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: prev.status === "paused" ? "in_progress" : "paused",
    }));
  }, []);

  // Swap two board pairings in the current round (by game id)
  const swapBoards = useCallback((gameIdA: string, gameIdB: string) => {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) => {
        if (r.number !== prev.currentRound) return r;
        const gA = r.games.find((g) => g.id === gameIdA);
        const gB = r.games.find((g) => g.id === gameIdB);
        if (!gA || !gB) return r;
        // Swap board numbers and player assignments; preserve results
        return {
          ...r,
          games: r.games.map((g) => {
            if (g.id === gameIdA) return { ...g, board: gB.board, whiteId: gB.whiteId, blackId: gB.blackId };
            if (g.id === gameIdB) return { ...g, board: gA.board, whiteId: gA.whiteId, blackId: gA.blackId };
            return g;
          }),
        };
      }),
    }));
  }, []);

  // Replace the games array for the current round (used by PairingSwapModal)
  const replaceRoundGames = useCallback((updatedGames: Game[]) => {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) =>
        r.number === prev.currentRound ? { ...r, games: updatedGames } : r
      ),
    }));
  }, []);

  // Update an existing player's mutable fields (name, elo, title) in the roster
  const updatePlayer = useCallback(
    (playerId: string, patch: Partial<Pick<Player, "name" | "elo" | "title" | "rapidElo" | "blitzElo" | "paymentStatus" | "manualPairingRating" | "pairingRating" | "ratingSource">>) => {
      setState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, ...patch } : p
        ),
      }));
    },
    []
  );

  // Assign a manual bye to a player in the current round
  // Creates a bye game (whiteId="BYE", blackId=playerId, result="½-½") and awards ½ point
  const assignBye = useCallback((playerId: string) => {
    setState((prev) => {
      if (prev.status === "registration" || prev.status === "completed") return prev;
      if (prev.players.find((player) => player.id === playerId)?.withdrawn) return prev;
      const currentRound = prev.rounds.find((r) => r.number === prev.currentRound);
      if (!currentRound) return prev;
      // Don't double-assign
      const alreadyBye = currentRound.games.some(
        (g) => g.whiteId === "BYE" && g.blackId === playerId
      );
      if (alreadyBye) return prev;
      const maxBoard = Math.max(0, ...currentRound.games.map((g) => g.board));
      const byeGame: import("@/lib/tournamentData").Game = {
        id: `bye-${playerId}-r${prev.currentRound}`,
        round: prev.currentRound,
        board: maxBoard + 1,
        whiteId: "BYE",
        blackId: playerId,
        result: "½-½",
      };
      return {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.number === prev.currentRound
            ? { ...r, games: [...r.games, byeGame] }
            : r
        ),
        players: prev.players.map((p) =>
          p.id === playerId
            ? { ...p, points: p.points + 0.5, draws: p.draws + 1 }
            : p
        ),
      };
    });
  }, []);

  // Revoke a manually assigned bye from a player in the current round
  const revokeBye = useCallback((playerId: string) => {
    setState((prev) => {
      const currentRound = prev.rounds.find((r) => r.number === prev.currentRound);
      if (!currentRound) return prev;
      const byeGame = currentRound.games.find(
        (g) => g.whiteId === "BYE" && g.blackId === playerId
      );
      if (!byeGame) return prev;
      return {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.number === prev.currentRound
            ? { ...r, games: r.games.filter((g) => g.id !== byeGame.id) }
            : r
        ),
        players: prev.players.map((p) =>
          p.id === playerId
            ? { ...p, points: Math.max(0, p.points - 0.5), draws: Math.max(0, p.draws - 1) }
            : p
        ),
      };
    });
  }, []);

  // Update mutable tournament settings from the Settings panel and pre-start Quads controls.
  const updateSettings = useCallback(
    (patch: { tournamentName?: string; totalRounds?: number; roundMinutes?: number; quadSettings?: QuadSettings }) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  // Swap two players between quad sections (director manual adjustment)
  const swapQuadPlayers = useCallback((playerIdA: string, playerIdB: string) => {
    setState((prev) => {
      if (!prev.quadSections || !prev.quadSettings) return prev;
      // Only allow swaps before any results are entered
      const allGames = prev.rounds.flatMap((r) => r.games);
      const hasResults = allGames.some((g) => g.result !== "*" && g.blackId !== "BYE");
      if (hasResults) return prev;
      const updatedSections = swapPlayersBetweenSections(
        prev.quadSections,
        playerIdA,
        playerIdB,
        prev.players,
        prev.quadSettings
      );
      return { ...prev, quadSections: updatedSections };
    });
  }, []);

  // Rename a quad section title
  const renameQuadSection = useCallback((sectionId: string, newName: string) => {
    setState((prev) => {
      if (!prev.quadSections) return prev;
      const updatedSections = prev.quadSections.map((s) =>
        s.id === sectionId ? { ...s, name: newName.trim() || s.name } : s
      );
      return { ...prev, quadSections: updatedSections };
    });
  }, []);

  // Reset tournament — clears localStorage and restores initial state
  const resetTournament = useCallback(() => {
    localStorage.removeItem(storageKey(tournamentId));
    const fresh = resolveInitialState(tournamentId);
    setState(fresh);
    setLastSaved(null);
  }, [tournamentId]);

  // Derived values
  const currentRoundData = state.rounds.find((r) => r.number === state.currentRound);
  const allResultsIn = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
  // For swiss_elim in cutoff phase, block normal "Next Round" — director must use advanceToElimination
  const isSwissElimCutoff = state.format === "swiss_elim" && state.elimPhase === "cutoff";
  const isSwissElimSwissPhaseComplete = state.format === "swiss_elim" && state.elimPhase === "swiss" && state.currentRound >= (state.swissRounds ?? state.totalRounds);
  // For swiss_elim in elimination phase, only allow generating the next round
  // if the bracket is NOT yet finished (currentRound < totalRounds).
  // This prevents the "Generate Round N" banner from appearing after the finals.
  const isElimBracketComplete = state.format === "swiss_elim" && state.elimPhase === "elimination" && state.currentRound >= state.totalRounds;
  const canGenerateNext = allResultsIn && state.status !== "registration" && !isSwissElimCutoff && !isSwissElimSwissPhaseComplete && !isElimBracketComplete
    && (state.format === "swiss_elim" ? state.elimPhase === "elimination" || state.currentRound < (state.swissRounds ?? state.totalRounds) : state.currentRound < state.totalRounds);
  const isRegistration = state.status === "registration";
  const canStart = isRegistration && isPlayerCountValid(state.format, state.players.length);

  // Quads rank independently per section with SB; other formats use Swiss standings.
  const liveStandings = computeDirectorLiveStandings(state);

  // ── Dev-only mock loader ──────────────────────────────────────────────────────
  const loadMockQuadsState = useCallback((scenario: "mid" | "complete" | "cochampion" = "mid") => {
    const mock =
      scenario === "complete" ? generateCompletedMockQuadsTournament() :
      scenario === "cochampion" ? generateCoChampionMockQuadsTournament() :
      generateMockQuadsTournament();

    const roundsMap = new Map<number, Round>();
    for (let r = 1; r <= mock.totalRounds; r++) {
      const rGames = mock.games.filter((g) => g.round === r);
      const allDone = rGames.length > 0 && rGames.every((g) => g.result !== "*");
      const anyDone = rGames.some((g) => g.result !== "*");
      roundsMap.set(r, {
        number: r,
        status: allDone ? "completed" : anyDone ? "in_progress" : r < mock.currentRound ? "completed" : r === mock.currentRound ? "in_progress" : "upcoming",
        games: rGames,
      });
    }

    const mockState: DirectorState = {
      tournamentId,
      tournamentName: "Mock Quads — Sat Night",
      totalRounds: mock.totalRounds,
      format: "quads",
      players: mock.players,
      rounds: Array.from(roundsMap.values()),
      currentRound: mock.currentRound,
      status: scenario === "complete" ? "completed" : "in_progress",
      roundMinutes: 25,
      quadSections: mock.sections,
      quadSettings: { ...DEFAULT_QUAD_SETTINGS, ratingType: "rapid" },
      resultHistory: [],
    };

    setState(mockState);
    saveToStorage(tournamentId, mockState);
  }, [tournamentId]);

  return {
    state,
    currentRoundData,
    allResultsIn,
    canGenerateNext,
    isRegistration,
    canStart,
    liveStandings,
    lastSaved,
    isSwissElimCutoff,
    isSwissElimSwissPhaseComplete,
    isElimBracketComplete,
    addPlayer,
    addLatePlayer,
    updatePlayer,
    removePlayer,
    removePlayerRound1,
    withdrawPlayer,
    reinstatePlayer,
    swapBoards,
    replaceRoundGames,
    assignBye,
    revokeBye,
    startTournament,
    enterResult,
    correctPreviousRound,
    generateNextRound,
    generateNextRoundWithCutoff,
    advanceToElimination,
    resetElimination,
    completeTournament,
    togglePause,
    resetTournament,
    swapQuadPlayers,
    renameQuadSection,
    updateSettings,
    flushStateToServer,
    loadMockQuadsState,
  };
}
