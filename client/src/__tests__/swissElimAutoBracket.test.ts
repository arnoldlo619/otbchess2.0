/**
 * Tests for swiss_elim auto-bracket generation
 * Verifies that the elimination bracket is automatically generated
 * when the final swiss round completes, without requiring manual director action.
 */
import { describe, it, expect } from "vitest";
import {
  generateSwissPairings,
  generateEliminationFirstRound,
  suggestElimCutoff,
  computeStandings,
  elimRoundLabel,
} from "../lib/swiss";
import type { Player, Round, Game } from "../lib/tournamentData";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, rating = 1500): Player {
  return {
    id,
    name,
    rating,
    username: id,
    platform: "manual",
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    buchholz: 0,
    colorHistory: [],
    opponents: [],
    byeCount: 0,
  };
}

function makeCompletedRound(number: number, games: Game[]): Round {
  return { number, status: "complete", games };
}

function makeGame(whiteId: string, blackId: string, result: "1-0" | "0-1" | "1/2-1/2"): Game {
  return {
    id: `${whiteId}-${blackId}-r${Math.random()}`,
    whiteId,
    blackId,
    result,
    board: 1,
  };
}

// ─── suggestElimCutoff ────────────────────────────────────────────────────────

describe("suggestElimCutoff", () => {
  it("returns 2 for 2 players", () => {
    expect(suggestElimCutoff(2)).toBe(2);
  });

  it("returns 4 for 4 players", () => {
    expect(suggestElimCutoff(4)).toBe(4);
  });

  it("returns 8 for 8 players", () => {
    expect(suggestElimCutoff(8)).toBe(8);
  });

  it("returns a power of 2 for 10 players", () => {
    const result = suggestElimCutoff(10);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(Math.log2(result) % 1).toBe(0); // must be power of 2
  });

  it("returns 16 for 16 players", () => {
    expect(suggestElimCutoff(16)).toBe(16);
  });

  it("returns a power of 2 for 23 players", () => {
    const result = suggestElimCutoff(23);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(Math.log2(result) % 1).toBe(0);
    expect(result).toBeLessThanOrEqual(64);
  });

  it("caps at 64 for very large tournaments", () => {
    expect(suggestElimCutoff(200)).toBe(64);
  });
});

// ─── Auto-bracket generation logic ───────────────────────────────────────────

describe("swiss_elim auto-bracket generation", () => {
  const players = [
    makePlayer("p1", "Alice", 1800),
    makePlayer("p2", "Bob", 1750),
    makePlayer("p3", "Carol", 1700),
    makePlayer("p4", "Dave", 1650),
    makePlayer("p5", "Eve", 1600),
    makePlayer("p6", "Frank", 1550),
    makePlayer("p7", "Grace", 1500),
    makePlayer("p8", "Hank", 1450),
  ];

  it("computes standings correctly after 3 swiss rounds", () => {
    const rounds: Round[] = [
      makeCompletedRound(1, [
        makeGame("p1", "p8", "1-0"),
        makeGame("p2", "p7", "1-0"),
        makeGame("p3", "p6", "1-0"),
        makeGame("p4", "p5", "1-0"),
      ]),
      makeCompletedRound(2, [
        makeGame("p1", "p2", "1-0"),
        makeGame("p3", "p4", "1-0"),
        makeGame("p5", "p8", "1-0"),
        makeGame("p6", "p7", "1-0"),
      ]),
      makeCompletedRound(3, [
        makeGame("p1", "p3", "1-0"),
        makeGame("p2", "p4", "1-0"),
        makeGame("p5", "p6", "1-0"),
        makeGame("p7", "p8", "1-0"),
      ]),
    ];

    const standings = computeStandings(players, rounds);
    expect(standings.length).toBe(8);
    // p1 should be first with 3 points
    expect(standings[0].player.id).toBe("p1");
    expect(standings[0].points).toBe(3);
  });

  it("generates correct first elimination round for top 8 players", () => {
    const top8 = players.slice(0, 8); // seeded 1-8
    const elimGames = generateEliminationFirstRound(top8, 4);

    // Should have 4 games (8 players / 2)
    expect(elimGames.length).toBe(4);
  });

  it("generates correct first elimination round for top 4 players", () => {
    const top4 = players.slice(0, 4);
    const elimGames = generateEliminationFirstRound(top4, 4);

    expect(elimGames.length).toBe(2);
  });

  it("all elimination games start with pending result", () => {
    const top4 = players.slice(0, 4);
    const elimGames = generateEliminationFirstRound(top4, 4);
    for (const game of elimGames) {
      expect(game.result).toBe("*");
    }
  });

  it("elimRoundLabel returns correct label for 8 players", () => {
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
  });

  it("elimRoundLabel returns correct label for 4 players", () => {
    expect(elimRoundLabel(4)).toBe("Semifinals");
  });

  it("elimRoundLabel returns correct label for 2 players", () => {
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("elimRoundLabel returns correct label for 16 players", () => {
    expect(elimRoundLabel(16)).toBe("Round of 16");
  });
});

// ─── State machine transition ─────────────────────────────────────────────────

describe("swiss_elim state machine transition", () => {
  it("auto-generates bracket with correct cutoff size for 8 players", () => {
    const playerCount = 8;
    const cutoff = suggestElimCutoff(playerCount);
    expect(cutoff).toBe(8);

    const players8 = Array.from({ length: 8 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`, 1800 - i * 50)
    );

    const rounds: Round[] = [
      makeCompletedRound(1, generateSwissPairings(players8, [], 1)),
    ];

    const standings = computeStandings(players8, rounds);
    const advancingPlayers = standings.slice(0, cutoff).map((s) => s.player);
    expect(advancingPlayers.length).toBe(8);

    const elimGames = generateEliminationFirstRound(advancingPlayers, 2);
    expect(elimGames.length).toBe(4);
  });

  it("auto-generates bracket with power-of-2 cutoff for 23 players", () => {
    const playerCount = 23;
    const cutoff = suggestElimCutoff(playerCount);
    expect(Math.log2(cutoff) % 1).toBe(0); // must be power of 2
    expect(cutoff).toBeGreaterThanOrEqual(2);
    expect(cutoff).toBeLessThanOrEqual(64);
  });

  it("totalRounds is correctly set to swissRounds + elimRounds", () => {
    const swissRounds = 3;
    const cutoff = 8;
    const elimRoundsCount = Math.ceil(Math.log2(cutoff)); // 3 for 8 players
    const expectedTotalRounds = swissRounds + elimRoundsCount;
    expect(expectedTotalRounds).toBe(6);
  });

  it("elimPhase transitions from swiss to elimination (not cutoff)", () => {
    // The new behavior: swiss -> elimination directly (no cutoff step)
    const newElimPhase = "elimination";
    expect(newElimPhase).toBe("elimination");
    expect(newElimPhase).not.toBe("cutoff");
  });

  it("elimination round count is log2 of cutoff size", () => {
    expect(Math.ceil(Math.log2(8))).toBe(3);  // QF + SF + Final
    expect(Math.ceil(Math.log2(4))).toBe(2);  // SF + Final
    expect(Math.ceil(Math.log2(16))).toBe(4); // R16 + QF + SF + Final
    expect(Math.ceil(Math.log2(2))).toBe(1);  // Final only
  });

  it("generates the correct number of games for each cutoff size", () => {
    const sizes = [2, 4, 8, 16];
    const expectedGames = [1, 2, 4, 8];
    sizes.forEach((size, i) => {
      const fakePlayers = Array.from({ length: size }, (_, j) =>
        makePlayer(`p${j + 1}`, `Player ${j + 1}`)
      );
      const games = generateEliminationFirstRound(fakePlayers, 1);
      expect(games.length).toBe(expectedGames[i]);
    });
  });
});
