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
import { generateSwissPairings, generateDoubleSwissPairings, applyResultToPlayers, computeStandings } from "./swiss";
import { getTournamentConfig, type TournamentConfig } from "./tournamentRegistry";
import { useVisibilitySync } from "./useVisibilitySync";

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
  format: "swiss" | "doubleswiss" | "roundrobin" | "elimination";
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: "registration" | "in_progress" | "completed" | "paused";
}

interface PersistedState {
  schemaVersion: number;
  savedAt: string;
  state: DirectorState;
}

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
  };
}

function getNewTournamentState(config: TournamentConfig): DirectorState {
  return {
    tournamentId: config.id,
    tournamentName: config.name,
    totalRounds: config.rounds,
    format: config.format ?? "swiss",
    players: [],
    rounds: [],
    currentRound: 0,
    status: "registration",
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
  | { success: false; reason: "duplicate" | "full" | "unknown" };

export function addPlayerToTournament(tournamentId: string, player: Player): AddPlayerResult {
  try {
    let existing = loadFromStorage(tournamentId);
    // If no persisted state yet, try to bootstrap from registry config
    if (!existing) {
      const config = getTournamentConfig(tournamentId);
      if (!config) return { success: false, reason: "unknown" };
      existing = getNewTournamentState(config);
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

  // 4. Unknown ID — fall back to demo
  return getDemoInitialState();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDirectorState(tournamentId: string = "otb-demo-2026") {
  const [state, setState] = useState<DirectorState>(() => resolveInitialState(tournamentId));
  const [lastSaved, setLastSaved] = useState<string | null>(() => getSavedAt(tournamentId));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDemo = tournamentId === "otb-demo-2026";

  // Hydrate from server on first mount (recovers from page refresh / device switch)
  useEffect(() => {
    if (isDemo) return;
    fetch(`/api/tournament/${tournamentId}/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.state) return;
        const serverState = data.state as DirectorState;
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
      fetch(`/api/tournament/${tournamentId}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }).catch(() => { /* fire-and-forget — localStorage is the fallback */ });
    }, 1500);
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    };
  }, [state, tournamentId, isDemo]);

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

  // Remove a player from the registration list (only during registration phase)
  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => {
      if (prev.status !== "registration") return prev;
      return { ...prev, players: prev.players.filter((p) => p.id !== playerId) };
    });
  }, []);

  // Start the tournament — transition from registration to Round 1
  const startTournament = useCallback(() => {
    setState((prev) => {
      if (prev.players.length < 2) return prev;
      const games = prev.format === "doubleswiss"
        ? generateDoubleSwissPairings(prev.players, [], 1)
        : generateSwissPairings(prev.players, [], 1);
      const round1: Round = { number: 1, status: "in_progress", games };
      return { ...prev, rounds: [round1], currentRound: 1, status: "in_progress" };
    });
  }, []);

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
      if (nextRoundNum > prev.totalRounds) return prev;

      // Ensure current round is complete
      const currentRoundData = prev.rounds.find((r) => r.number === prev.currentRound);
      const allDone = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      if (!allDone) return prev;

      // Use the correct pairing engine based on format
      const newGames = prev.format === "doubleswiss"
        ? generateDoubleSwissPairings(prev.players, prev.rounds, nextRoundNum)
        : generateSwissPairings(prev.players, prev.rounds, nextRoundNum);
      const newRound: Round = {
        number: nextRoundNum,
        status: "in_progress",
        games: newGames,
      };

      // Mark tournament complete if this was the last round
      const isLastRound = nextRoundNum === prev.totalRounds;

      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
        currentRound: nextRoundNum,
        status: isLastRound ? "in_progress" : "in_progress",
      };
    });
  }, []);

  // Mark tournament as complete after final round results are in
  const completeTournament = useCallback(() => {
    setState((prev) => ({ ...prev, status: "completed" }));
  }, []);

  // Pause / resume tournament
  const togglePause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: prev.status === "paused" ? "in_progress" : "paused",
    }));
  }, []);

  // Update mutable tournament settings (name, totalRounds) from the Settings panel
  const updateSettings = useCallback(
    (patch: { tournamentName?: string; totalRounds?: number }) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

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
  const canGenerateNext = allResultsIn && state.currentRound < state.totalRounds && state.status !== "registration";
  const isRegistration = state.status === "registration";
  const canStart = isRegistration && state.players.length >= 2;

  // Live standings with Buchholz tiebreaks from the Swiss engine
  const liveStandings = computeStandings(state.players, state.rounds);

  return {
    state,
    currentRoundData,
    allResultsIn,
    canGenerateNext,
    isRegistration,
    canStart,
    liveStandings,
    lastSaved,
    addPlayer,
    removePlayer,
    startTournament,
    enterResult,
    generateNextRound,
    completeTournament,
    togglePause,
    resetTournament,
    updateSettings,
  };
}
