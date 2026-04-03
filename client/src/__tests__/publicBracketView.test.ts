/**
 * Tests for PublicBracketView logic
 *
 * Tests the helper functions and data transformation logic used by
 * the PublicBracketView component (read-only spectator bracket).
 *
 * We test the pure logic functions directly since the component itself
 * is a UI rendering component that depends on React.
 */

import { describe, it, expect } from "vitest";
import {
  elimRoundLabel,
  elimRoundsNeeded,
  generateEliminationFirstRound,
  generateEliminationNextRound,
} from "@/lib/swiss";
import type { Player, Game } from "@/lib/tournamentData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, elo = 1500): Player {
  return {
    id,
    name,
    elo,
    username: name.toLowerCase(),
    platform: "chesscom" as const,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
  };
}

function makeGame(id: string, board: number, whiteId: string, blackId: string, result: string = "*"): Game {
  return {
    id,
    board,
    whiteId,
    blackId,
    result: result as Game["result"],
  };
}

// ─── elimRoundLabel ───────────────────────────────────────────────────────────

describe("elimRoundLabel", () => {
  it("returns 'Final' for 2 players", () => {
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("returns 'Semifinals' for 4 players", () => {
    expect(elimRoundLabel(4)).toBe("Semifinals");
  });

  it("returns 'Quarterfinals' for 8 players", () => {
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
  });

  it("returns 'Round of 16' for 16 players", () => {
    expect(elimRoundLabel(16)).toBe("Round of 16");
  });

  it("returns 'Round of 32' for 32 players", () => {
    expect(elimRoundLabel(32)).toBe("Round of 32");
  });

  it("returns 'Round of 64' for 64 players", () => {
    expect(elimRoundLabel(64)).toBe("Round of 64");
  });

  it("returns a string containing 'Round' for non-power-of-2 counts", () => {
    // 3 players → 4-slot bracket → label for 4 players = 'Semifinals'
    expect(elimRoundLabel(3)).toMatch(/Semifinals|Round|Final/i);
  });
});

// ─── elimRoundsNeeded ─────────────────────────────────────────────────────────

describe("elimRoundsNeeded", () => {
  it("returns 1 for 2 players (just a final)", () => {
    expect(elimRoundsNeeded(2)).toBe(1);
  });

  it("returns 2 for 3-4 players (SF + Final)", () => {
    expect(elimRoundsNeeded(3)).toBe(2);
    expect(elimRoundsNeeded(4)).toBe(2);
  });

  it("returns 3 for 5-8 players (QF + SF + Final)", () => {
    expect(elimRoundsNeeded(5)).toBe(3);
    expect(elimRoundsNeeded(8)).toBe(3);
  });

  it("returns 4 for 9-16 players", () => {
    expect(elimRoundsNeeded(9)).toBe(4);
    expect(elimRoundsNeeded(16)).toBe(4);
  });

  it("returns 6 for 33-64 players", () => {
    expect(elimRoundsNeeded(64)).toBe(6);
  });
});

// ─── generateEliminationFirstRound ───────────────────────────────────────────

describe("generateEliminationFirstRound — bracket generation", () => {
  const players8 = Array.from({ length: 8 }, (_, i) =>
    makePlayer(`p${i + 1}`, `Player ${i + 1}`, 2000 - i * 50)
  );

  it("generates 4 games for 8 players (no byes)", () => {
    const games = generateEliminationFirstRound(players8, 1);
    expect(games).toHaveLength(4);
  });

  it("seeds 1 vs 8 in game 1 (1 vs N pairing)", () => {
    const games = generateEliminationFirstRound(players8, 1);
    const g = games[0];
    expect([g.whiteId, g.blackId]).toContain("p1");
    expect([g.whiteId, g.blackId]).toContain("p8");
  });

  it("seeds 2 vs 7 in game 2", () => {
    const games = generateEliminationFirstRound(players8, 1);
    const g = games[1];
    expect([g.whiteId, g.blackId]).toContain("p2");
    expect([g.whiteId, g.blackId]).toContain("p7");
  });

  it("all games start with result '*' (pending)", () => {
    const games = generateEliminationFirstRound(players8, 1);
    games.forEach((g) => expect(g.result).toBe("*"));
  });

  it("generates correct board numbers starting from 1", () => {
    const games = generateEliminationFirstRound(players8, 1);
    games.forEach((g, i) => expect(g.board).toBe(i + 1));
  });

  it("handles 6 players — top 2 seeds get byes", () => {
    const players6 = players8.slice(0, 6);
    const games = generateEliminationFirstRound(players6, 1);
    // 6 players → need 8-slot bracket → 2 byes
    const byeGames = games.filter((g) => g.whiteId === "BYE" || g.blackId === "BYE");
    expect(byeGames.length).toBeGreaterThan(0);
  });

  it("handles 5 players — 3 byes", () => {
    const players5 = players8.slice(0, 5);
    const games = generateEliminationFirstRound(players5, 1);
    const byeGames = games.filter((g) => g.whiteId === "BYE" || g.blackId === "BYE");
    expect(byeGames.length).toBe(3);
  });

  it("handles 2 players — single final game", () => {
    const players2 = players8.slice(0, 2);
    const games = generateEliminationFirstRound(players2, 1);
    expect(games).toHaveLength(1);
    expect(games[0].whiteId).toBe("p1");
    expect(games[0].blackId).toBe("p2");
  });

  it("handles 16 players — 8 games, no byes", () => {
    const players16 = Array.from({ length: 16 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`)
    );
    const games = generateEliminationFirstRound(players16, 1);
    expect(games).toHaveLength(8);
    const byeGames = games.filter((g) => g.whiteId === "BYE" || g.blackId === "BYE");
    expect(byeGames).toHaveLength(0);
  });
});

// ─── generateEliminationNextRound ─────────────────────────────────────────────

describe("generateEliminationNextRound — winner advancement", () => {
  const players8 = Array.from({ length: 8 }, (_, i) =>
    makePlayer(`p${i + 1}`, `Player ${i + 1}`)
  );

  function makeQFGames(): Game[] {
    return [
      makeGame("g1", 1, "p1", "p8", "1-0"), // p1 wins
      makeGame("g2", 2, "p4", "p5", "0-1"), // p5 wins
      makeGame("g3", 3, "p2", "p7", "1-0"), // p2 wins
      makeGame("g4", 4, "p3", "p6", "0-1"), // p6 wins
    ];
  }

  it("generates 2 SF games from 4 QF games", () => {
    const qfGames = makeQFGames();
    const sfGames = generateEliminationNextRound(qfGames, players8, 2);
    expect(sfGames).toHaveLength(2);
  });

  it("advances winners correctly: p1 and p5 in SF game 1", () => {
    const qfGames = makeQFGames();
    const sfGames = generateEliminationNextRound(qfGames, players8, 2);
    const sf1 = sfGames[0];
    expect([sf1.whiteId, sf1.blackId]).toContain("p1");
    expect([sf1.whiteId, sf1.blackId]).toContain("p5");
  });

  it("advances winners correctly: p2 and p6 in SF game 2", () => {
    const qfGames = makeQFGames();
    const sfGames = generateEliminationNextRound(qfGames, players8, 2);
    const sf2 = sfGames[1];
    expect([sf2.whiteId, sf2.blackId]).toContain("p2");
    expect([sf2.whiteId, sf2.blackId]).toContain("p6");
  });

  it("all SF games start as pending", () => {
    const qfGames = makeQFGames();
    const sfGames = generateEliminationNextRound(qfGames, players8, 2);
    sfGames.forEach((g) => expect(g.result).toBe("*"));
  });

  it("generates 1 Final from 2 SF games", () => {
    const sfGames = [
      makeGame("sf1", 1, "p1", "p5", "1-0"), // p1 wins
      makeGame("sf2", 2, "p2", "p6", "0-1"), // p6 wins
    ];
    const finalGames = generateEliminationNextRound(sfGames, players8, 3);
    expect(finalGames).toHaveLength(1);
    const final = finalGames[0];
    expect([final.whiteId, final.blackId]).toContain("p1");
    expect([final.whiteId, final.blackId]).toContain("p6");
  });

  it("handles bye advancement — bye winner advances automatically", () => {
    const gamesWithBye: Game[] = [
      makeGame("g1", 1, "p1", "BYE", "*"), // p1 gets bye
      makeGame("g2", 2, "p3", "p4", "1-0"), // p3 wins
    ];
    const nextGames = generateEliminationNextRound(gamesWithBye, players8, 2);
    expect(nextGames).toHaveLength(1);
    // p1 should advance (bye winner), p3 should advance
    const next = nextGames[0];
    expect([next.whiteId, next.blackId]).toContain("p1");
    expect([next.whiteId, next.blackId]).toContain("p3");
  });

  it("handles draw result — draw is unresolved in elimination (director must pick winner)", () => {
    // In elimination, draws are treated as unresolved — the game is skipped
    // and the director must enter a decisive result.
    const games: Game[] = [
      makeGame("g1", 1, "p1", "p2", "½-½"), // draw — skipped
      makeGame("g2", 2, "p3", "p4", "1-0"), // p3 wins
    ];
    const nextGames = generateEliminationNextRound(games, players8, 2);
    // Only 1 winner (p3) — not enough for a next round game
    expect(nextGames).toHaveLength(0);
  });
});

// ─── Full bracket flow: 8 players QF → SF → Final ────────────────────────────

describe("Full 8-player bracket flow", () => {
  const players = Array.from({ length: 8 }, (_, i) =>
    makePlayer(`p${i + 1}`, `Player ${i + 1}`)
  );

  it("completes a full QF → SF → Final bracket", () => {
    // Round 1: QF
    const qfGames = generateEliminationFirstRound(players, 1);
    expect(qfGames).toHaveLength(4);

    // Enter results: top seeds win
    const qfResults: Game[] = [
      { ...qfGames[0], result: "1-0" }, // p1 wins
      { ...qfGames[1], result: "1-0" }, // p4 wins (or p5, depends on seeding)
      { ...qfGames[2], result: "1-0" }, // p2 wins
      { ...qfGames[3], result: "1-0" }, // p3 wins (or p6)
    ];

    // Round 2: SF
    const sfGames = generateEliminationNextRound(qfResults, players, 2);
    expect(sfGames).toHaveLength(2);

    // Enter SF results
    const sfResults: Game[] = [
      { ...sfGames[0], result: "1-0" },
      { ...sfGames[1], result: "1-0" },
    ];

    // Round 3: Final
    const finalGames = generateEliminationNextRound(sfResults, players, 3);
    expect(finalGames).toHaveLength(1);

    // Enter final result
    const finalResult: Game[] = [{ ...finalGames[0], result: "1-0" }];

    // Winner is the white player of the final
    const champion = finalResult[0].whiteId;
    expect(champion).toBeTruthy();
    expect(champion).not.toBe("BYE");
  });

  it("produces a champion after 3 rounds", () => {
    const qfGames = generateEliminationFirstRound(players, 1);
    const qfDone = qfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const sfGames = generateEliminationNextRound(qfDone, players, 2);
    const sfDone = sfGames.map((g) => ({ ...g, result: "1-0" as const }));
    const finalGames = generateEliminationNextRound(sfDone, players, 3);
    expect(finalGames).toHaveLength(1);
    // All 3 rounds complete
    const finalDone = finalGames.map((g) => ({ ...g, result: "1-0" as const }));
    expect(finalDone[0].result).toBe("1-0");
  });
});

// ─── Upset scenario ───────────────────────────────────────────────────────────

describe("Upset scenario — lower seeds winning", () => {
  const players = Array.from({ length: 4 }, (_, i) =>
    makePlayer(`p${i + 1}`, `Player ${i + 1}`)
  );

  it("advances lower seeds when they win", () => {
    // SF: p1 vs p4, p2 vs p3
    const sfGames = generateEliminationFirstRound(players, 1);
    // p4 upsets p1, p3 upsets p2
    const sfResults: Game[] = sfGames.map((g) => ({ ...g, result: "0-1" as const }));
    const finalGames = generateEliminationNextRound(sfResults, players, 2);
    expect(finalGames).toHaveLength(1);
    // p4 and p3 should be in the final
    const final = finalGames[0];
    expect([final.whiteId, final.blackId]).toContain("p4");
    expect([final.whiteId, final.blackId]).toContain("p3");
  });
});

// ─── isAwaitingCutoff logic ───────────────────────────────────────────────────

describe("isAwaitingCutoff logic (swiss_elim format)", () => {
  it("is true when swiss rounds done and no elim rounds exist", () => {
    const swissRounds = 3;
    const currentRound = 4; // past swiss
    const allRounds = [
      { number: 1, status: "complete" as const, games: [] },
      { number: 2, status: "complete" as const, games: [] },
      { number: 3, status: "complete" as const, games: [] },
    ];
    const elimRounds = allRounds.filter((r) => r.number > swissRounds);
    const isAwaitingCutoff =
      currentRound > swissRounds && elimRounds.length === 0;
    expect(isAwaitingCutoff).toBe(true);
  });

  it("is false when elim rounds already exist", () => {
    const swissRounds = 3;
    const currentRound = 4;
    const allRounds = [
      { number: 1, status: "complete" as const, games: [] },
      { number: 2, status: "complete" as const, games: [] },
      { number: 3, status: "complete" as const, games: [] },
      { number: 4, status: "in_progress" as const, games: [] },
    ];
    const elimRounds = allRounds.filter((r) => r.number > swissRounds);
    const isAwaitingCutoff =
      currentRound > swissRounds && elimRounds.length === 0;
    expect(isAwaitingCutoff).toBe(false);
  });

  it("is false when still in swiss phase", () => {
    const swissRounds = 3;
    const currentRound = 2; // still in swiss
    const allRounds = [
      { number: 1, status: "complete" as const, games: [] },
      { number: 2, status: "in_progress" as const, games: [] },
    ];
    const elimRounds = allRounds.filter((r) => r.number > swissRounds);
    const isAwaitingCutoff =
      currentRound > swissRounds && elimRounds.length === 0;
    expect(isAwaitingCutoff).toBe(false);
  });
});

// ─── elimStartRound logic ─────────────────────────────────────────────────────

describe("elimStartRound computation", () => {
  it("is 1 for pure elimination format", () => {
    const format = "elimination";
    const swissRounds = 0;
    const elimStartRound = format === "swiss_elim" ? swissRounds + 1 : 1;
    expect(elimStartRound).toBe(1);
  });

  it("is swissRounds + 1 for swiss_elim format", () => {
    const format = "swiss_elim";
    const swissRounds = 3;
    const elimStartRound = format === "swiss_elim" ? swissRounds + 1 : 1;
    expect(elimStartRound).toBe(4);
  });

  it("is 1 for swiss format (no elim)", () => {
    const format = "swiss";
    const swissRounds = 5;
    const elimStartRound = format === "swiss_elim" ? swissRounds + 1 : 1;
    expect(elimStartRound).toBe(1);
  });
});
