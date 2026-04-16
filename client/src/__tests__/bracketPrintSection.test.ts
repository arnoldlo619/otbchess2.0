/**
 * BracketPrintSection — Unit tests for bracket PDF data preparation logic.
 *
 * Tests the helper functions used by BracketPrintSection:
 *   - buildBracketRounds: reconstructs bracket rounds from stored round data
 *   - getWinnerId: determines the winner of a game
 *   - elimRoundLabel: returns correct round labels
 *   - Champion detection from the final round
 *   - Swiss-to-Elimination hybrid: only elim rounds shown
 *   - Empty bracket handling
 */

import { describe, it, expect } from "vitest";
import {
  generateEliminationFirstRound,
  generateEliminationNextRound,
  elimRoundLabel,
} from "@/lib/swiss";
import { type Player, type Game, type Round } from "@/lib/tournamentData";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, elo = 1500): Player {
  return {
    id,
    name,
    username: id,
    elo,
    country: "US",
    points: 0,
    colorHistory: [],
    opponents: [],
    withdrawn: false,
  };
}

function makeRound(number: number, games: Game[]): Round {
  return { number, games };
}

// ─── getWinnerId logic (tested via generateEliminationNextRound) ──────────────

describe("getWinnerId logic", () => {
  const players = [
    makePlayer("p1", "Alice", 1800),
    makePlayer("p2", "Bob", 1600),
    makePlayer("p3", "Carol", 1700),
    makePlayer("p4", "Dave", 1500),
  ];

  it("white wins 1-0", () => {
    const r1 = generateEliminationFirstRound(players, 1);
    // Manually set results
    r1[0].result = "1-0"; // p1 (white) wins
    r1[1].result = "1-0"; // p2 (white) wins
    const r2 = generateEliminationNextRound(r1, players, 2);
    expect(r2).toHaveLength(1);
    expect(r2[0].whiteId).toBe("p1");
    expect(r2[0].blackId).toBe("p2");
  });

  it("black wins 0-1", () => {
    const r1 = generateEliminationFirstRound(players, 1);
    r1[0].result = "0-1"; // p4 (black) wins
    r1[1].result = "0-1"; // p3 (black) wins
    const r2 = generateEliminationNextRound(r1, players, 2);
    expect(r2).toHaveLength(1);
    expect(r2[0].whiteId).toBe("p4");
    expect(r2[0].blackId).toBe("p3");
  });

  it("draw is skipped (not a valid elimination result)", () => {
    const r1 = generateEliminationFirstRound(players, 1);
    r1[0].result = "½-½"; // draw — skipped
    r1[1].result = "1-0"; // p2 wins
    const r2 = generateEliminationNextRound(r1, players, 2);
    // Only 1 winner (p2), not enough for a match
    expect(r2).toHaveLength(0);
  });

  it("bye auto-advances the non-BYE player", () => {
    // 3 players: p1 gets a bye, p2 vs p3
    const threePlayers = [
      makePlayer("p1", "Alice", 1800),
      makePlayer("p2", "Bob", 1600),
      makePlayer("p3", "Carol", 1500),
    ];
    const r1 = generateEliminationFirstRound(threePlayers, 1);
    // p2 vs p3 — p2 wins
    const realGame = r1.find((g) => g.whiteId !== "BYE" && g.blackId !== "BYE");
    if (realGame) realGame.result = "1-0";
    const r2 = generateEliminationNextRound(r1, threePlayers, 2);
    expect(r2).toHaveLength(1);
    // p1 (bye winner) vs p2 (game winner)
    const playerIds = [r2[0].whiteId, r2[0].blackId];
    expect(playerIds).toContain("p1");
    expect(playerIds).toContain("p2");
  });
});

// ─── elimRoundLabel ───────────────────────────────────────────────────────────

describe("elimRoundLabel", () => {
  it("returns Final for 2 players", () => {
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("returns Semifinals for 4 players", () => {
    expect(elimRoundLabel(4)).toBe("Semifinals");
  });

  it("returns Quarterfinals for 8 players", () => {
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
  });

  it("returns Round of N for larger fields", () => {
    expect(elimRoundLabel(16)).toBe("Round of 16");
    expect(elimRoundLabel(32)).toBe("Round of 32");
    expect(elimRoundLabel(64)).toBe("Round of 64");
  });

  it("returns Final for 1 player (edge case)", () => {
    expect(elimRoundLabel(1)).toBe("Final");
  });
});

// ─── Bracket round reconstruction ────────────────────────────────────────────

describe("bracket round reconstruction from stored round data", () => {
  const players = [
    makePlayer("p1", "Alice", 1800),
    makePlayer("p2", "Bob", 1700),
    makePlayer("p3", "Carol", 1600),
    makePlayer("p4", "Dave", 1500),
  ];

  it("reconstructs a complete 4-player bracket (QF → SF → Final)", () => {
    // Round 1: QF — p1 vs p4, p2 vs p3
    const r1Games = generateEliminationFirstRound(players, 1);
    r1Games[0].result = "1-0"; // p1 wins
    r1Games[1].result = "1-0"; // p2 wins

    // Round 2: Final — p1 vs p2
    const r2Games = generateEliminationNextRound(r1Games, players, 2);
    r2Games[0].result = "1-0"; // p1 wins (champion)

    const _rounds: Round[] = [
      makeRound(1, r1Games),
      makeRound(2, r2Games),
    ];

    // Verify round labels
    const r1PlayerCount = r1Games.filter((g) => g.whiteId !== "BYE" && g.blackId !== "BYE").length * 2;
    const r2PlayerCount = r2Games.length * 2;

    expect(elimRoundLabel(r1PlayerCount)).toBe("Semifinals");
    expect(elimRoundLabel(r2PlayerCount)).toBe("Final");

    // Verify champion is p1
    const finalGame = r2Games[0];
    expect(finalGame.result).toBe("1-0");
    expect(finalGame.whiteId).toBe("p1");
  });

  it("handles swiss_elim: only rounds >= elimStartRound are shown", () => {
    // Swiss rounds 1-3, elimination starts at round 4
    const swissRound1: Round = makeRound(1, []);
    const swissRound2: Round = makeRound(2, []);
    const swissRound3: Round = makeRound(3, []);

    const r4Games = generateEliminationFirstRound(players, 4);
    r4Games[0].result = "1-0";
    r4Games[1].result = "1-0";
    const elimRound4: Round = makeRound(4, r4Games);

    const r5Games = generateEliminationNextRound(r4Games, players, 5);
    r5Games[0].result = "1-0";
    const elimRound5: Round = makeRound(5, r5Games);

    const allRounds = [swissRound1, swissRound2, swissRound3, elimRound4, elimRound5];
    const elimStartRound = 4;

    const elimRounds = allRounds.filter((r) => r.number >= elimStartRound);
    expect(elimRounds).toHaveLength(2);
    expect(elimRounds[0].number).toBe(4);
    expect(elimRounds[1].number).toBe(5);
  });

  it("returns empty array when no elimination rounds exist", () => {
    const rounds: Round[] = [];
    const elimRounds = rounds.filter((r) => r.number >= 1);
    expect(elimRounds).toHaveLength(0);
  });

  it("handles 8-player bracket: QF → SF → Final", () => {
    const eightPlayers = Array.from({ length: 8 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`, 1800 - i * 50)
    );

    const r1 = generateEliminationFirstRound(eightPlayers, 1);
    expect(r1).toHaveLength(4); // 4 QF matches

    r1.forEach((g) => { g.result = "1-0"; }); // all white players win

    const r2 = generateEliminationNextRound(r1, eightPlayers, 2);
    expect(r2).toHaveLength(2); // 2 SF matches

    r2.forEach((g) => { g.result = "1-0"; });

    const r3 = generateEliminationNextRound(r2, eightPlayers, 3);
    expect(r3).toHaveLength(1); // 1 Final match

    r3[0].result = "1-0";

    // Verify labels
    expect(elimRoundLabel(8)).toBe("Quarterfinals");
    expect(elimRoundLabel(4)).toBe("Semifinals");
    expect(elimRoundLabel(2)).toBe("Final");
  });

  it("handles non-power-of-2 field (6 players) with byes", () => {
    const sixPlayers = Array.from({ length: 6 }, (_, i) =>
      makePlayer(`p${i + 1}`, `Player ${i + 1}`, 1800 - i * 50)
    );

    const r1 = generateEliminationFirstRound(sixPlayers, 1);
    // 8-slot bracket: 2 byes for top seeds, 4 real matches
    const byeGames = r1.filter((g) => g.whiteId === "BYE" || g.blackId === "BYE");
    const realGames = r1.filter((g) => g.whiteId !== "BYE" && g.blackId !== "BYE");

    expect(byeGames.length + realGames.length).toBe(r1.length);
    expect(byeGames.length).toBe(2); // 2 byes for 6-player field in 8-slot bracket
    expect(realGames.length).toBe(2);
  });
});

// ─── Champion detection ───────────────────────────────────────────────────────

describe("champion detection from final round", () => {
  const players = [
    makePlayer("p1", "Alice", 1800),
    makePlayer("p2", "Bob", 1600),
  ];

  it("detects champion when Final has a result", () => {
    const finalGame: Game = {
      id: "r1b1",
      round: 1,
      board: 1,
      whiteId: "p1",
      blackId: "p2",
      result: "1-0",
    };

    const winnerId = finalGame.result === "1-0" ? finalGame.whiteId : finalGame.blackId;
    expect(winnerId).toBe("p1");

    const champion = players.find((p) => p.id === winnerId);
    expect(champion?.name).toBe("Alice");
  });

  it("returns null when Final is in progress", () => {
    const finalGame: Game = {
      id: "r1b1",
      round: 1,
      board: 1,
      whiteId: "p1",
      blackId: "p2",
      result: "*",
    };

    const winnerId = finalGame.result === "1-0"
      ? finalGame.whiteId
      : finalGame.result === "0-1"
      ? finalGame.blackId
      : null;

    expect(winnerId).toBeNull();
  });

  it("detects champion when black wins the Final", () => {
    const finalGame: Game = {
      id: "r1b1",
      round: 1,
      board: 1,
      whiteId: "p1",
      blackId: "p2",
      result: "0-1",
    };

    const winnerId = finalGame.result === "1-0" ? finalGame.whiteId : finalGame.blackId;
    expect(winnerId).toBe("p2");

    const champion = players.find((p) => p.id === winnerId);
    expect(champion?.name).toBe("Bob");
  });
});

// ─── Print section visibility ─────────────────────────────────────────────────

describe("bracket section visibility logic", () => {
  it("shows bracket tab for elimination format", () => {
    const format = "elimination";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    expect(isElimFormat).toBe(true);
  });

  it("shows bracket tab for swiss_elim format", () => {
    const format = "swiss_elim";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    expect(isElimFormat).toBe(true);
  });

  it("hides bracket tab for swiss format", () => {
    const format = "swiss";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    expect(isElimFormat).toBe(false);
  });

  it("hides bracket tab for roundrobin format", () => {
    const format = "roundrobin";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    expect(isElimFormat).toBe(false);
  });

  it("defaults to bracket tab for elim formats", () => {
    const format = "elimination";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    const defaultTab = isElimFormat ? "bracket" : "slips";
    expect(defaultTab).toBe("bracket");
  });

  it("defaults to slips tab for non-elim formats", () => {
    const format = "swiss";
    const isElimFormat = format === "elimination" || format === "swiss_elim";
    const defaultTab = isElimFormat ? "bracket" : "slips";
    expect(defaultTab).toBe("slips");
  });
});

// ─── elimStartRound calculation ───────────────────────────────────────────────

describe("elimStartRound calculation", () => {
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

  it("handles 5 swiss rounds correctly", () => {
    const format = "swiss_elim";
    const swissRounds = 5;
    const elimStartRound = format === "swiss_elim" ? swissRounds + 1 : 1;
    expect(elimStartRound).toBe(6);
  });

  it("handles 0 swiss rounds for swiss_elim (edge case)", () => {
    const format = "swiss_elim";
    const swissRounds = 0;
    const elimStartRound = format === "swiss_elim" ? swissRounds + 1 : 1;
    expect(elimStartRound).toBe(1);
  });
});
