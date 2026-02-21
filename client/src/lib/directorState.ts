/*
 * OTB Chess — Director State Management
 * Manages mutable tournament state: results, pairings, standings
 * Uses React state (no backend) — persisted in sessionStorage for demo
 */

import { useState, useCallback } from "react";
import { DEMO_TOURNAMENT, type Player, type Game, type Round, type Result } from "./tournamentData";

// ─── Mutable State ────────────────────────────────────────────────────────────
export interface DirectorState {
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: "in_progress" | "completed" | "paused";
}

// ─── Swiss Pairing Algorithm (simplified) ────────────────────────────────────
// Groups players by score, pairs highest vs second-highest within each group.
// Avoids repeat pairings and balances colors.
function generateSwissPairings(
  players: Player[],
  rounds: Round[],
  nextRound: number
): Game[] {
  // Build set of already-played pairs
  const played = new Set<string>();
  for (const round of rounds) {
    for (const game of round.games) {
      const key = [game.whiteId, game.blackId].sort().join("|");
      played.add(key);
    }
  }

  // Sort by points desc, then ELO desc
  const sorted = [...players].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.elo - a.elo
  );

  const paired: string[] = [];
  const games: Game[] = [];
  let board = 1;

  for (let i = 0; i < sorted.length; i++) {
    const p1 = sorted[i];
    if (paired.includes(p1.id)) continue;

    // Find best available opponent
    for (let j = i + 1; j < sorted.length; j++) {
      const p2 = sorted[j];
      if (paired.includes(p2.id)) continue;

      const key = [p1.id, p2.id].sort().join("|");
      if (played.has(key)) continue; // avoid rematch if possible

      // Assign colors based on history
      const p1whites = p1.colorHistory.filter((c) => c === "W").length;
      const p2whites = p2.colorHistory.filter((c) => c === "W").length;

      let whiteId: string, blackId: string;
      if (p1whites <= p2whites) {
        whiteId = p1.id;
        blackId = p2.id;
      } else {
        whiteId = p2.id;
        blackId = p1.id;
      }

      games.push({
        id: `r${nextRound}b${board}`,
        round: nextRound,
        board,
        whiteId,
        blackId,
        result: "*",
      });

      paired.push(p1.id, p2.id);
      board++;
      break;
    }

    // If no non-repeat opponent found, pair with next available (allow repeat)
    if (!paired.includes(p1.id)) {
      for (let j = i + 1; j < sorted.length; j++) {
        const p2 = sorted[j];
        if (paired.includes(p2.id)) continue;

        const p1whites = p1.colorHistory.filter((c) => c === "W").length;
        const p2whites = p2.colorHistory.filter((c) => c === "W").length;
        let whiteId: string, blackId: string;
        if (p1whites <= p2whites) { whiteId = p1.id; blackId = p2.id; }
        else { whiteId = p2.id; blackId = p1.id; }

        games.push({ id: `r${nextRound}b${board}`, round: nextRound, board, whiteId, blackId, result: "*" });
        paired.push(p1.id, p2.id);
        board++;
        break;
      }
    }
  }

  return games;
}

// ─── Update player scores after a result ─────────────────────────────────────
function applyResult(
  players: Player[],
  game: Game,
  newResult: Result
): Player[] {
  return players.map((p) => {
    if (p.id !== game.whiteId && p.id !== game.blackId) return p;

    const isWhite = p.id === game.whiteId;
    let pointsDelta = 0;
    let winsDelta = 0;
    let drawsDelta = 0;
    let lossesDelta = 0;
    let colorAdd: "W" | "B" = isWhite ? "W" : "B";

    // Reverse old result if it was already set
    if (game.result !== "*") {
      if (game.result === "½-½") { pointsDelta -= 0.5; drawsDelta -= 1; }
      else if ((game.result === "1-0" && isWhite) || (game.result === "0-1" && !isWhite)) {
        pointsDelta -= 1; winsDelta -= 1;
      } else {
        lossesDelta -= 1;
      }
    }

    // Apply new result
    if (newResult === "½-½") { pointsDelta += 0.5; drawsDelta += 1; }
    else if ((newResult === "1-0" && isWhite) || (newResult === "0-1" && !isWhite)) {
      pointsDelta += 1; winsDelta += 1;
    } else if (newResult !== "*") {
      lossesDelta += 1;
    }

    const newColorHistory = game.result === "*"
      ? [...p.colorHistory, colorAdd]
      : p.colorHistory;

    return {
      ...p,
      points: Math.max(0, p.points + pointsDelta),
      wins: Math.max(0, p.wins + winsDelta),
      draws: Math.max(0, p.draws + drawsDelta),
      losses: Math.max(0, p.losses + lossesDelta),
      colorHistory: newColorHistory,
    };
  });
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
      const rounds = prev.rounds.map((r) => ({
        ...r,
        games: r.games.map((g) => {
          if (g.id !== gameId) return g;
          return { ...g, result };
        }),
      }));

      // Find the game to update player scores
      let targetGame: Game | undefined;
      for (const r of prev.rounds) {
        targetGame = r.games.find((g) => g.id === gameId);
        if (targetGame) break;
      }

      const players = targetGame
        ? applyResult(prev.players, { ...targetGame, result: targetGame.result }, result)
        : prev.players;

      // Check if round is complete
      const currentRoundData = rounds.find((r) => r.number === prev.currentRound);
      const roundComplete = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      const updatedRounds = rounds.map((r) =>
        r.number === prev.currentRound && roundComplete
          ? { ...r, status: "completed" as const }
          : r
      );

      return { ...prev, rounds: updatedRounds, players };
    });
  }, []);

  // Generate pairings for next round
  const generateNextRound = useCallback(() => {
    setState((prev) => {
      const nextRoundNum = prev.currentRound + 1;
      const totalRounds = DEMO_TOURNAMENT.rounds;
      if (nextRoundNum > totalRounds) return prev;

      // Check current round is complete
      const currentRoundData = prev.rounds.find((r) => r.number === prev.currentRound);
      const allDone = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
      if (!allDone) return prev;

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

  // Get current round data
  const currentRoundData = state.rounds.find((r) => r.number === state.currentRound);
  const allResultsIn = currentRoundData?.games.every((g) => g.result !== "*") ?? false;
  const canGenerateNext = allResultsIn && state.currentRound < DEMO_TOURNAMENT.rounds;

  return {
    state,
    currentRoundData,
    allResultsIn,
    canGenerateNext,
    enterResult,
    generateNextRound,
    togglePause,
  };
}
