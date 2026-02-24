/**
 * OTB Chess — Director State Management
 * Manages mutable tournament state: results, pairings, standings
 * Uses the full Swiss engine from swiss.ts for pairing and tiebreaks
 * Persists all state to localStorage with versioned schema and graceful recovery
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { DEMO_TOURNAMENT, type Player, type Game, type Round, type Result } from "./tournamentData";
import { generateSwissPairings, applyResultToPlayers, computeStandings } from "./swiss";

// ─── Schema Version ───────────────────────────────────────────────────────────
// Bump this when the DirectorState shape changes to force a clean reset
const SCHEMA_VERSION = 2;
const STORAGE_KEY = "otb-director-state-v" + SCHEMA_VERSION;

// ─── Mutable State ────────────────────────────────────────────────────────────
export interface DirectorState {
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: "in_progress" | "completed" | "paused";
}

interface PersistedState {
  schemaVersion: number;
  savedAt: string;
  state: DirectorState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitialState(): DirectorState {
  return {
    players: DEMO_TOURNAMENT.players.map((p) => ({ ...p })),
    rounds: DEMO_TOURNAMENT.roundData.map((r) => ({
      ...r,
      games: r.games.map((g) => ({ ...g })),
    })),
    currentRound: DEMO_TOURNAMENT.currentRound,
    status: "in_progress",
  };
}

function loadFromStorage(): DirectorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed: PersistedState = JSON.parse(raw);
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      // Schema mismatch — clear old data and start fresh
      localStorage.removeItem(STORAGE_KEY);
      return getInitialState();
    }
    return parsed.state;
  } catch {
    // Corrupted JSON — silently fall back to initial state
    return getInitialState();
  }
}

function saveToStorage(state: DirectorState): void {
  try {
    const persisted: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

function getSavedAt(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    return parsed.savedAt ?? null;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDirectorState() {
  const [state, setState] = useState<DirectorState>(loadFromStorage);
  const [lastSaved, setLastSaved] = useState<string | null>(getSavedAt);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save to localStorage whenever state changes (debounced 300ms)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToStorage(state);
      setLastSaved(new Date().toISOString());
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // Enter a result for a game
  const enterResult = useCallback((gameId: string, result: Result) => {
    setState((prev) => {
      // Find the game being updated
      let targetGame: Game | undefined;
      for (const r of prev.rounds) {
        targetGame = r.games.find((g) => g.id === gameId);
        if (targetGame) break;
      }

      // Update rounds with the new result
      const rounds = prev.rounds.map((r) => ({
        ...r,
        games: r.games.map((g) => (g.id !== gameId ? g : { ...g, result })),
      }));

      // Update player scores using the Swiss engine
      const players = targetGame
        ? applyResultToPlayers(prev.players, { ...targetGame }, result)
        : prev.players;

      // Update Buchholz scores live
      const standings = computeStandings(players, rounds);
      const buchholzMap = new Map(standings.map((s) => [s.player.id, s.buchholz]));
      const playersWithBuchholz = players.map((p) => ({
        ...p,
        buchholz: buchholzMap.get(p.id) ?? p.buchholz,
      }));

      // Mark round as completed if all results are in
      const currentRoundData = rounds.find((r) => r.number === prev.currentRound);
      const roundComplete = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      const updatedRounds = rounds.map((r) =>
        r.number === prev.currentRound && roundComplete
          ? { ...r, status: "completed" as const }
          : r
      );

      return { ...prev, rounds: updatedRounds, players: playersWithBuchholz };
    });
  }, []);

  // Generate pairings for next round using the full Swiss engine
  const generateNextRound = useCallback(() => {
    setState((prev) => {
      const nextRoundNum = prev.currentRound + 1;
      const totalRounds = DEMO_TOURNAMENT.rounds;
      if (nextRoundNum > totalRounds) return prev;

      // Ensure current round is complete
      const currentRoundData = prev.rounds.find((r) => r.number === prev.currentRound);
      const allDone = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      if (!allDone) return prev;

      // Use the full Swiss engine
      const newGames = generateSwissPairings(prev.players, prev.rounds, nextRoundNum);
      const newRound: Round = {
        number: nextRoundNum,
        status: "in_progress",
        games: newGames,
      };

      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        currentRound: nextRoundNum,
      };
    });
  }, []);

  // Pause / resume tournament
  const togglePause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: prev.status === "paused" ? "in_progress" : "paused",
    }));
  }, []);

  // Reset tournament — clears localStorage and restores initial state
  const resetTournament = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = getInitialState();
    setState(fresh);
    setLastSaved(null);
  }, []);

  // Derived values
  const currentRoundData = state.rounds.find((r) => r.number === state.currentRound);
  const allResultsIn = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
  const canGenerateNext = allResultsIn && state.currentRound < DEMO_TOURNAMENT.rounds;

  // Live standings with Buchholz tiebreaks from the Swiss engine
  const liveStandings = computeStandings(state.players, state.rounds);

  return {
    state,
    currentRoundData,
    allResultsIn,
    canGenerateNext,
    liveStandings,
    lastSaved,
    enterResult,
    generateNextRound,
    togglePause,
    resetTournament,
  };
}
