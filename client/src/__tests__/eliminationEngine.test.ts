/**
 * OTB Chess — Elimination Bracket Engine Tests
 *
 * Tests for:
 *  - generateEliminationFirstRound (seeding, byes, power-of-2 and non-power-of-2)
 *  - generateEliminationNextRound (winner advancement, bracket order)
 *  - elimRoundsNeeded (bracket size → round count)
 *  - elimRoundLabel (remaining players → label)
 *  - suggestElimCutoff (player count → best cutoff)
 *  - getSwissCutoffPlayers (standings → seeded players)
 */
import { describe, it, expect } from "vitest";
import {
  generateEliminationFirstRound,
  generateEliminationNextRound,
  elimRoundsNeeded,
  elimRoundLabel,
  suggestElimCutoff,
  getSwissCutoffPlayers,
  computeStandings,
} from "../lib/swiss";
import type { Player, Game } from "../lib/tournamentData";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    username: `player${i + 1}`,
    elo: 2000 - i * 10,
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
  }));
}

// ─── elimRoundsNeeded ────────────────────────────────────────────────────────

describe("elimRoundsNeeded", () => {
  it("returns 0 for 1 player", () => {
    expect(elimRoundsNeeded(1)).toBe(0);
  });

  it("returns 1 for 2 players", () => {
    expect(elimRoundsNeeded(2)).toBe(1);
  });

  it("returns 2 for 4 players", () => {
    expect(elimRoundsNeeded(4)).toBe(2);
  });

  it("returns 3 for 8 players", () => {
    expect(elimRoundsNeeded(8)).toBe(3);
  });

  it("returns 4 for 16 players", () => {
    expect(elimRoundsNeeded(16)).toBe(4);
  });

  it("returns 6 for 64 players", () => {
    expect(elimRoundsNeeded(64)).toBe(6);
  });

  it("returns 7 for 128 players", () => {
    expect(elimRoundsNeeded(128)).toBe(7);
  });
});

// ─── elimRoundLabel ──────────────────────────────────────────────────────────

describe("elimRoundLabel", () => {
  it("returns 'Final' for 2 remaining", () => {
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("returns 'Final' for 1 remaining", () => {
    expect(elimRoundLabel(1)).toBe("Final");
  });

  it("returns 'Semifinals' for 4 remaining", () => {
    expect(elimRoundLabel(4)).toBe("Semifinals");
  });

  it("returns 'Semifinals' for 3 remaining", () => {
    expect(elimRoundLabel(3)).toBe("Semifinals");
  });

  it("returns 'Quarterfinals' for 8 remaining", () => {
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
  });

  it("returns 'Round of 16' for 16 remaining", () => {
    expect(elimRoundLabel(16)).toBe("Round of 16");
  });

  it("returns 'Round of 32' for 32 remaining", () => {
    expect(elimRoundLabel(32)).toBe("Round of 32");
  });

  it("returns 'Round of 64' for 64 remaining", () => {
    expect(elimRoundLabel(64)).toBe("Round of 64");
  });
});

// ─── suggestElimCutoff ───────────────────────────────────────────────────────

describe("suggestElimCutoff", () => {
  it("returns 2 for 2 players", () => {
    expect(suggestElimCutoff(2)).toBe(2);
  });

  it("returns 4 for 4 players", () => {
    expect(suggestElimCutoff(4)).toBe(4);
  });

  it("returns 4 for 5 players", () => {
    expect(suggestElimCutoff(5)).toBe(4);
  });

  it("returns 8 for 10 players", () => {
    expect(suggestElimCutoff(10)).toBe(8);
  });

  it("returns 16 for 20 players", () => {
    expect(suggestElimCutoff(20)).toBe(16);
  });

  it("returns 32 for 40 players", () => {
    expect(suggestElimCutoff(40)).toBe(32);
  });

  it("returns 64 for 100 players (capped at 64)", () => {
    expect(suggestElimCutoff(100)).toBe(64);
  });

  it("returns 64 for 200 players (capped at 64)", () => {
    expect(suggestElimCutoff(200)).toBe(64);
  });

  it("returns 4 for 3 players (rounds up to next power of 2)", () => {
    expect(suggestElimCutoff(3)).toBe(4);
  });
});

// ─── generateEliminationFirstRound ───────────────────────────────────────────

describe("generateEliminationFirstRound", () => {
  it("returns empty array for fewer than 2 players", () => {
    const players = makePlayers(1);
    expect(generateEliminationFirstRound(players, 1)).toHaveLength(0);
  });

  it("generates 1 game for 2 players", () => {
    const players = makePlayers(2);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(1);
    expect(games[0].whiteId).toBe("p1");
    expect(games[0].blackId).toBe("p2");
    expect(games[0].result).toBe("*");
  });

  it("generates 2 games for 4 players (seed 1v4, seed 2v3)", () => {
    const players = makePlayers(4);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(2);
    expect(games[0].whiteId).toBe("p1");
    expect(games[0].blackId).toBe("p4");
    expect(games[1].whiteId).toBe("p2");
    expect(games[1].blackId).toBe("p3");
  });

  it("generates 4 games for 8 players", () => {
    const players = makePlayers(8);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(4);
    expect(games[0].whiteId).toBe("p1");
    expect(games[0].blackId).toBe("p8");
    expect(games[1].whiteId).toBe("p2");
    expect(games[1].blackId).toBe("p7");
    expect(games[2].whiteId).toBe("p3");
    expect(games[2].blackId).toBe("p6");
    expect(games[3].whiteId).toBe("p4");
    expect(games[3].blackId).toBe("p5");
  });

  it("handles non-power-of-2: 6 players → 4 games with 2 byes", () => {
    const players = makePlayers(6);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(4);
    const byeGames = games.filter(g => g.whiteId === "BYE");
    expect(byeGames).toHaveLength(2);
    const byePlayerIds = byeGames.map(g => g.blackId);
    expect(byePlayerIds).toContain("p1");
    expect(byePlayerIds).toContain("p2");
  });

  it("handles non-power-of-2: 5 players → 4 games with 3 byes", () => {
    const players = makePlayers(5);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(4);
    const byeGames = games.filter(g => g.whiteId === "BYE");
    expect(byeGames).toHaveLength(3);
  });

  it("handles non-power-of-2: 12 players → 8 games with 4 byes", () => {
    const players = makePlayers(12);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(8);
    const byeGames = games.filter(g => g.whiteId === "BYE");
    expect(byeGames).toHaveLength(4);
  });

  it("assigns correct round number", () => {
    const players = makePlayers(4);
    const games = generateEliminationFirstRound(players, 5);
    expect(games.every(g => g.round === 5)).toBe(true);
  });

  it("assigns sequential board numbers", () => {
    const players = makePlayers(8);
    const games = generateEliminationFirstRound(players, 1);
    const boards = games.map(g => g.board);
    expect(boards).toEqual([1, 2, 3, 4]);
  });

  it("all non-bye games have result '*'", () => {
    const players = makePlayers(8);
    const games = generateEliminationFirstRound(players, 1);
    const nonByeGames = games.filter(g => g.whiteId !== "BYE" && g.blackId !== "BYE");
    expect(nonByeGames.every(g => g.result === "*")).toBe(true);
  });

  it("generates 32 games for 64 players (no byes)", () => {
    const players = makePlayers(64);
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(32);
    const byeGames = games.filter(g => g.whiteId === "BYE");
    expect(byeGames).toHaveLength(0);
  });
});

// ─── generateEliminationNextRound ────────────────────────────────────────────

describe("generateEliminationNextRound", () => {
  it("advances white winners correctly", () => {
    const players = makePlayers(4);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "1-0" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].whiteId).toBe("p1");
    expect(round2[0].blackId).toBe("p2");
    expect(round2[0].round).toBe(2);
  });

  it("advances black winners correctly", () => {
    const players = makePlayers(4);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "0-1" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "0-1" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].whiteId).toBe("p4");
    expect(round2[0].blackId).toBe("p3");
  });

  it("advances bye players automatically", () => {
    const players = makePlayers(3);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "BYE", blackId: "p1", result: "½-½" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].whiteId).toBe("p1");
    expect(round2[0].blackId).toBe("p2");
  });

  it("returns empty array when only 1 winner (tournament over)", () => {
    const players = makePlayers(2);
    const finalGame: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
    ];
    const next = generateEliminationNextRound(finalGame, players, 2);
    expect(next).toHaveLength(0);
  });

  it("skips draws (unresolved games)", () => {
    const players = makePlayers(4);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "½-½" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(0);
  });

  it("preserves bracket order: winner of board 1 vs winner of board 2", () => {
    const players = makePlayers(8);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p8", result: "1-0" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p7", result: "0-1" },
      { id: "r1b3", round: 1, board: 3, whiteId: "p3", blackId: "p6", result: "1-0" },
      { id: "r1b4", round: 1, board: 4, whiteId: "p4", blackId: "p5", result: "0-1" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(2);
    expect(round2[0].whiteId).toBe("p1");
    expect(round2[0].blackId).toBe("p7");
    expect(round2[1].whiteId).toBe("p3");
    expect(round2[1].blackId).toBe("p5");
  });

  it("handles odd number of winners with a bye", () => {
    const players = makePlayers(6);
    const round1: Game[] = [
      { id: "r1b1", round: 1, board: 1, whiteId: "BYE", blackId: "p1", result: "½-½" },
      { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p5", result: "1-0" },
      { id: "r1b3", round: 1, board: 3, whiteId: "p3", blackId: "p4", result: "1-0" },
    ];
    const round2 = generateEliminationNextRound(round1, players, 2);
    expect(round2).toHaveLength(2);
    expect(round2[0].whiteId).toBe("p1");
    expect(round2[0].blackId).toBe("p2");
    expect(round2[1].whiteId).toBe("BYE");
    expect(round2[1].blackId).toBe("p3");
  });
});

// ─── getSwissCutoffPlayers ───────────────────────────────────────────────────

describe("getSwissCutoffPlayers", () => {
  it("returns top N players from standings", () => {
    const players = makePlayers(10);
    players[0].points = 3;
    players[1].points = 2.5;
    players[2].points = 2;
    const standings = computeStandings(players, []);
    const cutoff = getSwissCutoffPlayers(standings, 4);
    expect(cutoff).toHaveLength(4);
    expect(cutoff[0].id).toBe("p1");
    expect(cutoff[1].id).toBe("p2");
    expect(cutoff[2].id).toBe("p3");
  });

  it("returns all players when cutoff >= player count", () => {
    const players = makePlayers(4);
    const standings = computeStandings(players, []);
    const cutoff = getSwissCutoffPlayers(standings, 8);
    expect(cutoff).toHaveLength(4);
  });

  it("returns empty array when standings are empty", () => {
    const standings = computeStandings([], []);
    const cutoff = getSwissCutoffPlayers(standings, 4);
    expect(cutoff).toHaveLength(0);
  });
});

// ─── Full integration flow ───────────────────────────────────────────────────

describe("Swiss → Elimination integration", () => {
  it("full flow: 8 players → QF → SF → Final", () => {
    const players = makePlayers(8);

    const qf = generateEliminationFirstRound(players, 1);
    expect(qf).toHaveLength(4);
    expect(elimRoundLabel(8)).toBe("Quarterfinals");

    const qfResults: Game[] = qf.map(g => ({ ...g, result: "1-0" as const }));

    const sf = generateEliminationNextRound(qfResults, players, 2);
    expect(sf).toHaveLength(2);
    expect(elimRoundLabel(4)).toBe("Semifinals");

    const sfResults: Game[] = sf.map(g => ({ ...g, result: "1-0" as const }));

    const final = generateEliminationNextRound(sfResults, players, 3);
    expect(final).toHaveLength(1);
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("upset scenario: lower seed wins", () => {
    const players = makePlayers(4);
    const round1 = generateEliminationFirstRound(players, 1);

    const results: Game[] = round1.map(g => ({ ...g, result: "0-1" as const }));

    const final = generateEliminationNextRound(results, players, 2);
    expect(final).toHaveLength(1);
    expect(final[0].whiteId).toBe("p4");
    expect(final[0].blackId).toBe("p3");
  });

  it("non-power-of-2: 6 players → byes → SF → Final", () => {
    const players = makePlayers(6);
    const round1 = generateEliminationFirstRound(players, 1);

    const byeGames = round1.filter(g => g.whiteId === "BYE");
    const realGames = round1.filter(g => g.whiteId !== "BYE");
    expect(byeGames.length).toBe(2);
    expect(realGames.length).toBe(2);

    const round1Results: Game[] = round1.map(g => {
      if (g.whiteId === "BYE") return g;
      return { ...g, result: "1-0" as const };
    });

    const round2 = generateEliminationNextRound(round1Results, players, 2);
    expect(round2.length).toBeGreaterThanOrEqual(1);
  });

  it("64-player bracket: correct number of rounds", () => {
    const players = makePlayers(64);
    expect(elimRoundsNeeded(64)).toBe(6);
    expect(suggestElimCutoff(64)).toBe(64);

    const round1 = generateEliminationFirstRound(players, 1);
    expect(round1).toHaveLength(32);
    expect(round1.filter(g => g.whiteId === "BYE")).toHaveLength(0);
  });
});
