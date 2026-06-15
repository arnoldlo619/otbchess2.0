// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { addPlayerToTournament, loadTournamentState } from "../directorState";
import type { Game, Player, Result, Round } from "../tournamentData";
import { registerTournament, clearRegistry, type TournamentConfig } from "../tournamentRegistry";
import {
  applyResultToPlayers,
  computeStandings,
  generateSwissPairings,
  validatePairings,
} from "../swiss";
import { buildSnapshot } from "../../../../server/publicSnapshot";

function makePlayer(index: number, overrides: Partial<Player> = {}): Player {
  const id = `p${index}`;
  return {
    id,
    name: `Player ${index}`,
    username: `player${index}`,
    elo: 1800 - index * 10,
    pairingRating: 1800 - index * 10,
    ratingSource: "manual",
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    platform: "chesscom",
    ...overrides,
  };
}

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => makePlayer(index + 1));
}

function resultForBoard(board: number): Result {
  if (board % 3 === 0) return "½-½";
  return board % 2 === 0 ? "0-1" : "1-0";
}

function completeRound(players: Player[], round: Round): { playersWithColorHistory: Player[]; round: Round } {
  let updatedPlayers = players;
  const completedGames = round.games.map((game) => {
    if (game.whiteId === "BYE" || game.blackId === "BYE") {
      return game;
    }

    const result = resultForBoard(game.board);
    updatedPlayers = applyResultToPlayers(updatedPlayers, game, result);
    return { ...game, result };
  });

  return {
    playersWithColorHistory: updatedPlayers,
    round: { ...round, status: "completed", games: completedGames },
  };
}

function playerIdsInRound(games: Game[]): string[] {
  return games.flatMap((game) => [game.whiteId, game.blackId]).filter((id) => id !== "BYE");
}

function byeRecipients(rounds: Round[]): string[] {
  return rounds.flatMap((round) =>
    round.games.flatMap((game) => {
      if (game.whiteId === "BYE") return [game.blackId];
      if (game.blackId === "BYE") return [game.whiteId];
      return [];
    })
  );
}

function pairKey(game: Game): string | null {
  if (game.whiteId === "BYE" || game.blackId === "BYE") return null;
  return [game.whiteId, game.blackId].sort().join("|");
}

function syncPlayersFromStandings(players: Player[], rounds: Round[]): Player[] {
  const standings = computeStandings(players, rounds);
  const rowsByPlayerId = new Map(standings.map((row) => [row.player.id, row]));

  return players.map((player) => {
    const row = rowsByPlayerId.get(player.id);
    if (!row) return player;
    return {
      ...player,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      buchholz: row.buchholz,
    };
  });
}

function simulateSwissTournament(playerCount: number, roundsToPlay: number): {
  players: Player[];
  rounds: Round[];
} {
  let players = makePlayers(playerCount);
  const rounds: Round[] = [];

  for (let roundNumber = 1; roundNumber <= roundsToPlay; roundNumber += 1) {
    const games = generateSwissPairings(players, rounds, roundNumber);
    const validation = validatePairings(games, players, rounds, roundNumber);
    expect(validation.errors).toEqual([]);

    const round: Round = { number: roundNumber, status: "in_progress", games };
    const completed = completeRound(players, round);
    rounds.push(completed.round);
    players = syncPlayersFromStandings(completed.playersWithColorHistory, rounds);
  }

  return { players, rounds };
}

function makeTournamentConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: "safety-open-2026",
    inviteCode: "SAFE2026",
    directorCode: "DIR-SAFE26",
    name: "Safety Open 2026",
    venue: "ChessOTB Club",
    date: "2026-06-15",
    description: "Focused lifecycle test event",
    format: "swiss",
    rounds: 3,
    maxPlayers: 32,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    ratingType: "rapid",
    createdAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  clearRegistry();
});

describe("tournament lifecycle safety coverage", () => {
  it("simulates an 8-player Swiss event through three completed rounds without duplicate pairings", () => {
    const { players, rounds } = simulateSwissTournament(8, 3);
    const playedPairs = new Set<string>();

    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.games).toHaveLength(4);
      expect(playerIdsInRound(round.games).sort()).toEqual(players.map((p) => p.id).sort());

      for (const game of round.games) {
        const key = pairKey(game);
        if (!key) continue;
        expect(playedPairs.has(key)).toBe(false);
        playedPairs.add(key);
      }
    }

    const standings = computeStandings(players, rounds);
    expect(standings).toHaveLength(8);
    expect(standings[0].points).toBeGreaterThanOrEqual(standings[1].points);
    expect(standings.reduce((total, row) => total + row.points, 0)).toBe(12);
  });

  it("simulates a 9-player Swiss event with one bye per round and no repeat bye recipient", () => {
    const { players, rounds } = simulateSwissTournament(9, 3);
    const byes = byeRecipients(rounds);

    expect(rounds).toHaveLength(3);
    expect(byes).toHaveLength(3);
    expect(new Set(byes).size).toBe(3);

    for (const round of rounds) {
      expect(round.games.filter((game) => game.whiteId === "BYE" || game.blackId === "BYE")).toHaveLength(1);
      expect(playerIdsInRound(round.games).sort()).toEqual(players.map((p) => p.id).sort());
    }

    const standings = computeStandings(players, rounds);
    for (const playerId of byes) {
      const row = standings.find((standing) => standing.player.id === playerId);
      expect(row?.points).toBeGreaterThanOrEqual(1);
      expect(row?.wins).toBeGreaterThanOrEqual(1);
    }
  });

  it("generates and validates first-round pairings for a 32-player event", () => {
    const players = makePlayers(32);
    const games = generateSwissPairings(players, [], 1);
    const validation = validatePairings(games, players, [], 1);

    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
    expect(games).toHaveLength(16);
    expect(playerIdsInRound(games).sort()).toEqual(players.map((p) => p.id).sort());
  });

  it("blocks duplicate local registrations with the same player id or exact username", () => {
    registerTournament(makeTournamentConfig({ maxPlayers: 4 }));

    expect(addPlayerToTournament("safety-open-2026", makePlayer(1, { username: "sameName" }))).toEqual({
      success: true,
      reason: "ok",
    });
    expect(addPlayerToTournament("safety-open-2026", makePlayer(1, { username: "differentName" }))).toEqual({
      success: false,
      reason: "duplicate",
    });
    expect(addPlayerToTournament("safety-open-2026", makePlayer(2, { username: "sameName" }))).toEqual({
      success: false,
      reason: "duplicate",
    });

    const state = loadTournamentState("safety-open-2026");
    expect(state?.players).toHaveLength(1);
  });

  it("keeps result corrections reversible for standings and public snapshots", () => {
    const players = makePlayers(2);
    const initialGame: Game = {
      id: "r1b1",
      round: 1,
      board: 1,
      whiteId: "p1",
      blackId: "p2",
      result: "*",
    };

    const afterWhiteWin = applyResultToPlayers(players, initialGame, "1-0");
    const correctedGame = { ...initialGame, result: "1-0" as Result };
    const afterCorrection = applyResultToPlayers(afterWhiteWin, correctedGame, "0-1");
    const round: Round = {
      number: 1,
      status: "completed",
      games: [{ ...correctedGame, result: "0-1" }],
    };

    const standings = computeStandings(afterCorrection, [round]);
    expect(standings[0].player.id).toBe("p2");
    expect(standings[0].points).toBe(1);
    expect(standings[1].points).toBe(0);

    const snapshot = buildSnapshot({
      tournamentId: "safety-open-2026",
      tournamentName: "Safety Open 2026",
      status: "in_progress",
      currentRound: 1,
      totalRounds: 1,
      format: "swiss",
      venue: "ChessOTB Club",
      date: "2026-06-15",
      players: afterCorrection,
      rounds: [round],
      updatedAt: "2026-06-15T12:00:00.000Z",
    });

    expect(snapshot.rounds[0].games[0].result).toBe("0-1");
    expect(snapshot.standings[0].playerId).toBe("p2");
    expect(snapshot.standings[0].points).toBe(1);
  });
});
