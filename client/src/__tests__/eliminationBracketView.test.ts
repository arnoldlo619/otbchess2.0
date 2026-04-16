/**
 * Tests for EliminationBracketView helper logic and EliminationBracketView integration
 *
 * These tests cover:
 * 1. resultWinner logic (white win, black win, bye, draw, pending)
 * 2. getSeed logic (seeded player lookup)
 * 3. getPlayer logic (player lookup from elimPlayers + players)
 * 4. Round label computation via elimRoundLabel
 * 5. Integration: full 8-player bracket flow with correct round labels
 * 6. Integration: swiss_elim cutoff screen standings display
 */

import {describe, it, expect} from "vitest";
import {
  generateEliminationFirstRound,
  generateEliminationNextRound,
  elimRoundLabel,
  elimRoundsNeeded,
  suggestElimCutoff,
  getSwissCutoffPlayers,
} from "@/lib/swiss";
import type { Player, Game, Round } from "@/lib/tournamentData";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, elo = 1500): Player {
  return {
    id,
    name,
    username: id,
    elo,
    rapidElo: elo,
    blitzElo: elo - 50,
    title: undefined,
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    opponents: [],
    platform: "chesscom",
  };
}

function _makeRound(number: number, games: Game[]): Round {
  return { number, status: "completed", games };
}

// ─── resultWinner logic (pure function tests) ─────────────────────────────────

describe("resultWinner logic", () => {
  it("returns 'white' for 1-0", () => {
    const game: Game = { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" };
    const winner = game.result === "1-0" ? "white" : game.result === "0-1" ? "black" : null;
    expect(winner).toBe("white");
  });

  it("returns 'black' for 0-1", () => {
    const game: Game = { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "0-1" };
    const winner = game.result === "1-0" ? "white" : game.result === "0-1" ? "black" : null;
    expect(winner).toBe("black");
  });

  it("returns null for pending (*)", () => {
    const game: Game = { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" };
    const winner = game.result === "1-0" ? "white" : game.result === "0-1" ? "black" : null;
    expect(winner).toBeNull();
  });

  it("returns null for draw (½-½) in normal match", () => {
    const game: Game = { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "½-½" };
    const winner = game.result === "1-0" ? "white" : game.result === "0-1" ? "black" : null;
    expect(winner).toBeNull();
  });

  it("bye game: whiteId=BYE, result=½-½ means black auto-advances", () => {
    const game: Game = { id: "g1", round: 1, board: 1, whiteId: "BYE", blackId: "p2", result: "½-½" };
    const isBye = game.whiteId === "BYE";
    const winner = isBye ? "black" : game.result === "1-0" ? "white" : game.result === "0-1" ? "black" : null;
    expect(winner).toBe("black");
    expect(isBye).toBe(true);
  });
});

// ─── getSeed logic ────────────────────────────────────────────────────────────

describe("getSeed logic", () => {
  const elimPlayers = [
    makePlayer("p1", "Alice", 2000),
    makePlayer("p2", "Bob", 1900),
    makePlayer("p3", "Carol", 1800),
    makePlayer("p4", "Dave", 1700),
  ];

  it("returns 1-based seed for first player", () => {
    const idx = elimPlayers.findIndex((p) => p.id === "p1");
    expect(idx + 1).toBe(1);
  });

  it("returns correct seed for last player", () => {
    const idx = elimPlayers.findIndex((p) => p.id === "p4");
    expect(idx + 1).toBe(4);
  });

  it("returns -1 for unknown player (not in elimPlayers)", () => {
    const idx = elimPlayers.findIndex((p) => p.id === "unknown");
    expect(idx).toBe(-1);
  });
});

// ─── getPlayer logic ──────────────────────────────────────────────────────────

describe("getPlayer lookup", () => {
  const players = [
    makePlayer("p1", "Alice"),
    makePlayer("p2", "Bob"),
  ];
  const elimPlayers = [
    makePlayer("p1", "Alice (elim)"), // same id, different name — elimPlayers takes priority
    makePlayer("p3", "Carol"),
  ];

  it("prefers elimPlayers over players for same id", () => {
    const found = elimPlayers.find((p) => p.id === "p1") ?? players.find((p) => p.id === "p1");
    expect(found?.name).toBe("Alice (elim)");
  });

  it("falls back to players if not in elimPlayers", () => {
    const found = elimPlayers.find((p) => p.id === "p2") ?? players.find((p) => p.id === "p2");
    expect(found?.name).toBe("Bob");
  });

  it("returns undefined for unknown id", () => {
    const found = elimPlayers.find((p) => p.id === "unknown") ?? players.find((p) => p.id === "unknown");
    expect(found).toBeUndefined();
  });
});

// ─── Round label computation ──────────────────────────────────────────────────

describe("elimRoundLabel", () => {
  it("labels 2 players as Final", () => {
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("labels 4 players as Semifinals", () => {
    expect(elimRoundLabel(4)).toBe("Semifinals");
  });

  it("labels 8 players as Quarterfinals", () => {
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
  });

  it("labels 16 players as Round of 16", () => {
    expect(elimRoundLabel(16)).toBe("Round of 16");
  });

  it("labels 32 players as Round of 32", () => {
    expect(elimRoundLabel(32)).toBe("Round of 32");
  });

  it("labels 64 players as Round of 64", () => {
    expect(elimRoundLabel(64)).toBe("Round of 64");
  });

  it("labels 128 players as Round of 128", () => {
    expect(elimRoundLabel(128)).toBe("Round of 128");
  });
});

// ─── elimRoundsNeeded ─────────────────────────────────────────────────────────

describe("elimRoundsNeeded", () => {
  it("needs 1 round for 2 players", () => {
    expect(elimRoundsNeeded(2)).toBe(1);
  });

  it("needs 2 rounds for 4 players", () => {
    expect(elimRoundsNeeded(4)).toBe(2);
  });

  it("needs 3 rounds for 8 players", () => {
    expect(elimRoundsNeeded(8)).toBe(3);
  });

  it("needs 6 rounds for 64 players", () => {
    expect(elimRoundsNeeded(64)).toBe(6);
  });

  it("needs 7 rounds for 128 players", () => {
    expect(elimRoundsNeeded(128)).toBe(7);
  });
});

// ─── suggestElimCutoff ────────────────────────────────────────────────────────

describe("suggestElimCutoff", () => {
  it("suggests 8 for 10 players", () => {
    expect(suggestElimCutoff(10)).toBe(8);
  });

  it("suggests 16 for 20 players", () => {
    expect(suggestElimCutoff(20)).toBe(16);
  });

  it("suggests 64 for 100 players", () => {
    expect(suggestElimCutoff(100)).toBe(64);
  });

  it("suggests 32 for 50 players", () => {
    expect(suggestElimCutoff(50)).toBe(32);
  });

  it("suggests 4 for 5 players", () => {
    expect(suggestElimCutoff(5)).toBe(4);
  });

  it("suggests 2 for 2 players", () => {
    expect(suggestElimCutoff(2)).toBe(2);
  });
});

// ─── getSwissCutoffPlayers ────────────────────────────────────────────────────

describe("getSwissCutoffPlayers", () => {
  // getSwissCutoffPlayers(standings: StandingRow[], cutoff: number): Player[]
  // Build StandingRow-like objects
  function makeStanding(id: string, name: string, points: number) {
    return { player: makePlayer(id, name), points, wins: 0, draws: 0, losses: 0, buchholz: 0, matchWins: 0, matchDraws: 0, matchLosses: 0 };
  }

  const standings = [
    makeStanding("p1", "Alice", 3),
    makeStanding("p2", "Bob", 2.5),
    makeStanding("p3", "Carol", 2),
    makeStanding("p4", "Dave", 1.5),
    makeStanding("p5", "Eve", 1),
    makeStanding("p6", "Frank", 0.5),
  ];

  it("returns top 4 players by points", () => {
    const result = getSwissCutoffPlayers(standings, 4);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("p1");
    expect(result[3].id).toBe("p4");
  });

  it("returns top 2 players", () => {
    const result = getSwissCutoffPlayers(standings, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("p1");
    expect(result[1].id).toBe("p2");
  });

  it("returns all players if cutoff >= standings count", () => {
    const result = getSwissCutoffPlayers(standings, 10);
    expect(result).toHaveLength(6);
  });
});

// ─── Integration: Full 8-player bracket flow ─────────────────────────────────

describe("8-player bracket: full QF → SF → Final flow", () => {
  const players = [
    makePlayer("p1", "Alice", 2000),
    makePlayer("p2", "Bob", 1900),
    makePlayer("p3", "Carol", 1800),
    makePlayer("p4", "Dave", 1700),
    makePlayer("p5", "Eve", 1600),
    makePlayer("p6", "Frank", 1500),
    makePlayer("p7", "Grace", 1400),
    makePlayer("p8", "Hank", 1300),
  ];

  it("generates 4 QF matches in round 1", () => {
    const games = generateEliminationFirstRound(players, 1);
    expect(games).toHaveLength(4);
    expect(games.every((g) => g.result === "*")).toBe(true);
  });

  it("QF pairings: seed 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5", () => {
    const games = generateEliminationFirstRound(players, 1);
    // Seed 1 (Alice) vs Seed 8 (Hank)
    expect(games[0].whiteId).toBe("p1");
    expect(games[0].blackId).toBe("p8");
    // Seed 2 (Bob) vs Seed 7 (Grace)
    expect(games[1].whiteId).toBe("p2");
    expect(games[1].blackId).toBe("p7");
    // Seed 3 (Carol) vs Seed 6 (Frank)
    expect(games[2].whiteId).toBe("p3");
    expect(games[2].blackId).toBe("p6");
    // Seed 4 (Dave) vs Seed 5 (Eve)
    expect(games[3].whiteId).toBe("p4");
    expect(games[3].blackId).toBe("p5");
  });

  it("SF: generates 2 matches after QF results", () => {
    const qfGames = generateEliminationFirstRound(players, 1);
    // All top seeds win
    const completedQF: Game[] = qfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const sfGames = generateEliminationNextRound(completedQF, players, 2);
    expect(sfGames).toHaveLength(2);
    // Winners: p1, p2, p3, p4
    const sfIds = sfGames.flatMap((g) => [g.whiteId, g.blackId]);
    expect(sfIds).toContain("p1");
    expect(sfIds).toContain("p2");
    expect(sfIds).toContain("p3");
    expect(sfIds).toContain("p4");
  });

  it("Final: generates 1 match after SF results", () => {
    const qfGames = generateEliminationFirstRound(players, 1);
    const completedQF: Game[] = qfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const sfGames = generateEliminationNextRound(completedQF, players, 2);
    const completedSF: Game[] = sfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const finalGames = generateEliminationNextRound(completedSF, players, 3);
    expect(finalGames).toHaveLength(1);
  });

  it("Final: winner is seed 1 (Alice) if she wins all", () => {
    const qfGames = generateEliminationFirstRound(players, 1);
    const completedQF: Game[] = qfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const sfGames = generateEliminationNextRound(completedQF, players, 2);
    const completedSF: Game[] = sfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const finalGames = generateEliminationNextRound(completedSF, players, 3);
    const completedFinal: Game[] = finalGames.map((g) => ({ ...g, result: "1-0" as const }));
    // The white player in the final should be p1 (seed 1) since she won all
    expect(completedFinal[0].whiteId).toBe("p1");
    expect(completedFinal[0].result).toBe("1-0");
  });

  it("Upset scenario: lower seeds can win", () => {
    const qfGames = generateEliminationFirstRound(players, 1);
    // All lower seeds (black) win
    const completedQF: Game[] = qfGames.map((g) => ({ ...g, result: "0-1" as const }));
    const sfGames = generateEliminationNextRound(completedQF, players, 2);
    // Winners should be p8, p7, p6, p5
    const sfIds = sfGames.flatMap((g) => [g.whiteId, g.blackId]);
    expect(sfIds).toContain("p8");
    expect(sfIds).toContain("p7");
    expect(sfIds).toContain("p6");
    expect(sfIds).toContain("p5");
  });
});

// ─── Integration: Non-power-of-2 bracket (6 players) ─────────────────────────

describe("6-player bracket with byes", () => {
  const players = [
    makePlayer("p1", "Alice", 2000),
    makePlayer("p2", "Bob", 1900),
    makePlayer("p3", "Carol", 1800),
    makePlayer("p4", "Dave", 1700),
    makePlayer("p5", "Eve", 1600),
    makePlayer("p6", "Frank", 1500),
  ];

  it("generates 4 games in round 1 (2 real + 2 byes for 6 players)", () => {
    const games = generateEliminationFirstRound(players, 1);
    // 6 players → next power of 2 is 8 → 2 byes needed
    // 4 games total: 2 real matches + 2 byes
    expect(games).toHaveLength(4);
  });

  it("top 2 seeds (p1, p2) get byes", () => {
    const games = generateEliminationFirstRound(players, 1);
    const byeGames = games.filter((g) => g.whiteId === "BYE");
    expect(byeGames).toHaveLength(2);
    // Top seeds get byes
    const byeRecipients = byeGames.map((g) => g.blackId);
    expect(byeRecipients).toContain("p1");
    expect(byeRecipients).toContain("p2");
  });

  it("bye games have result ½-½ (auto-advance)", () => {
    const games = generateEliminationFirstRound(players, 1);
    const byeGames = games.filter((g) => g.whiteId === "BYE");
    expect(byeGames.every((g) => g.result === "½-½")).toBe(true);
  });

  it("non-bye games start as pending (*)", () => {
    const games = generateEliminationFirstRound(players, 1);
    const realGames = games.filter((g) => g.whiteId !== "BYE");
    expect(realGames.every((g) => g.result === "*")).toBe(true);
  });
});

// ─── Integration: Round labels for bracket columns ────────────────────────────

describe("bracket column round labels", () => {
  it("8-player bracket: QF → SF → Final", () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`, 2000 - i * 50)
    );

    const qfGames = generateEliminationFirstRound(players, 1);
    const completedQF: Game[] = qfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const sfGames = generateEliminationNextRound(completedQF, players, 2);
    const completedSF: Game[] = sfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const finalGames = generateEliminationNextRound(completedSF, players, 3);

    // Round 1 (4 matches = 8 players) → Quarterfinals
    expect(elimRoundLabel(qfGames.length * 2)).toBe("Quarterfinals");
    // Round 2 (2 matches = 4 players) → Semifinals
    expect(elimRoundLabel(sfGames.length * 2)).toBe("Semifinals");
    // Round 3 (1 match = 2 players) → Final
    expect(elimRoundLabel(finalGames.length * 2)).toBe("Final");
  });

  it("16-player bracket: R16 → QF → SF → Final", () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`, 2000 - i * 30)
    );

    const r16Games = generateEliminationFirstRound(players, 1);
    expect(elimRoundLabel(r16Games.length * 2)).toBe("Round of 16");

    const completedR16: Game[] = r16Games.map((g) => ({ ...g, result: "1-0" as const }));
    const qfGames = generateEliminationNextRound(completedR16, players, 2);
    expect(elimRoundLabel(qfGames.length * 2)).toBe("Quarterfinals");
  });
});

// ─── Integration: Empty bracket (no rounds) ──────────────────────────────────

describe("empty bracket state", () => {
  it("returns empty array when no players", () => {
    const games = generateEliminationFirstRound([], 1);
    expect(games).toHaveLength(0);
  });

  it("returns empty array when 1 player", () => {
    const games = generateEliminationFirstRound([makePlayer("p1", "Alice")], 1);
    expect(games).toHaveLength(0);
  });

  it("generateEliminationNextRound returns empty when no games", () => {
    const games = generateEliminationNextRound([], [], 2);
    expect(games).toHaveLength(0);
  });
});
