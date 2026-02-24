/**
 * OTB Chess — Director State Management
 * Manages mutable tournament state: results, pairings, standings
 * Uses the full Swiss engine from swiss.ts for pairing and tiebreaks
 */
import { useState, useCallback } from "react";
import { DEMO_TOURNAMENT, type Player, type Game, type Round, type Result } from "./tournamentData";
import { generateSwissPairings, applyResultToPlayers, computeStandings } from "./swiss";

// ─── Mutable State ────────────────────────────────────────────────────────────
export interface DirectorState {
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: "in_progress" | "completed" | "paused";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDirectorState() {
  const [state, setState] = useState<DirectorState>(() => ({
    players: DEMO_TOURNAMENT.players.map((p) => ({ ...p })),
    rounds: DEMO_TOURNAMENT.roundData.map((r) => ({
      ...r,
      games: r.games.map((g) => ({ ...g })),
    })),
    currentRound: DEMO_TOURNAMENT.currentRound,
    status: "in_progress",
  }));

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
    enterResult,
    generateNextRound,
    togglePause,
  };
}
