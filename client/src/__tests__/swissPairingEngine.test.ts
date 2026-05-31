/**
 * Swiss Pairing Engine — Comprehensive Tests
 *
 * Covers all acceptance criteria from the pairing engine upgrade spec:
 *   1. Round 1: top-half vs bottom-half seeding
 *   2. Rounds 2+: score-group Dutch pairing
 *   3. Bye assignment (lowest-ranked, no repeat bye, 1 full point)
 *   4. Color balancing
 *   5. Repeat-opponent avoidance
 *   6. Rating fallback chain (resolvePairingRating)
 *   7. validatePairings
 *   8. computeStandings: bye = 1 full point
 */

import { describe, it, expect } from "vitest";
import {
  generateSwissPairings,
  computeStandings,
  resolvePairingRating,
  validatePairings,
} from "../lib/swiss";
import type { Player, Round, Game, Result } from "../lib/tournamentData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, elo = 1200, points = 0, colorHistory: ("W" | "B")[] = []): Player {
  return {
    id,
    name: id,
    username: id,
    elo,
    pairingRating: elo,
    country: "US",
    points,
    wins: 0,
    draws: 0,
    losses: 0,
    colorHistory,
    seed: 0,
  };
}

function makeGame(id: string, round: number, board: number, whiteId: string, blackId: string, result: Result = "*"): Game {
  return { id, round, board, whiteId, blackId, result };
}

function makeRound(roundNum: number, games: Game[]): Round {
  return { roundNumber: roundNum, games };
}

// ─── Round 1: Top-Half vs Bottom-Half ─────────────────────────────────────────

describe("Round 1: top-half vs bottom-half seeding", () => {
  it("pairs seed 1 vs seed N/2+1 for 8 players", () => {
    // Seeds by rating: p1(2000) p2(1900) p3(1800) p4(1700) | p5(1600) p6(1500) p7(1400) p8(1300)
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1900),
      makePlayer("p3", 1800),
      makePlayer("p4", 1700),
      makePlayer("p5", 1600),
      makePlayer("p6", 1500),
      makePlayer("p7", 1400),
      makePlayer("p8", 1300),
    ];
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(4);

    // Board 1: p1 vs p5
    const b1 = games.find(g => g.board === 1)!;
    expect([b1.whiteId, b1.blackId]).toContain("p1");
    expect([b1.whiteId, b1.blackId]).toContain("p5");

    // Board 2: p2 vs p6
    const b2 = games.find(g => g.board === 2)!;
    expect([b2.whiteId, b2.blackId]).toContain("p2");
    expect([b2.whiteId, b2.blackId]).toContain("p6");

    // Board 3: p3 vs p7
    const b3 = games.find(g => g.board === 3)!;
    expect([b3.whiteId, b3.blackId]).toContain("p3");
    expect([b3.whiteId, b3.blackId]).toContain("p7");

    // Board 4: p4 vs p8
    const b4 = games.find(g => g.board === 4)!;
    expect([b4.whiteId, b4.blackId]).toContain("p4");
    expect([b4.whiteId, b4.blackId]).toContain("p8");
  });

  it("pairs seed 1 vs seed N/2+1 for 6 players", () => {
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1800),
      makePlayer("p3", 1600),
      makePlayer("p4", 1400),
      makePlayer("p5", 1200),
      makePlayer("p6", 1000),
    ];
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(3);

    const b1 = games.find(g => g.board === 1)!;
    expect([b1.whiteId, b1.blackId]).toContain("p1");
    expect([b1.whiteId, b1.blackId]).toContain("p4");

    const b2 = games.find(g => g.board === 2)!;
    expect([b2.whiteId, b2.blackId]).toContain("p2");
    expect([b2.whiteId, b2.blackId]).toContain("p5");
  });

  it("does NOT use score-group logic in Round 1 (all players at 0 pts)", () => {
    // With 4 players all at 0 pts, old engine would do 1v2, 3v4
    // New engine should do 1v3, 2v4 (top-half vs bottom-half)
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1800),
      makePlayer("p3", 1600),
      makePlayer("p4", 1400),
    ];
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(2);

    const b1 = games.find(g => g.board === 1)!;
    // p1 should be paired with p3, not p2
    expect([b1.whiteId, b1.blackId]).toContain("p1");
    expect([b1.whiteId, b1.blackId]).toContain("p3");
    expect([b1.whiteId, b1.blackId]).not.toContain("p2");
  });
});

// ─── Rounds 2+: Score-Group Pairing ───────────────────────────────────────────

describe("Rounds 2+: score-group Dutch pairing", () => {
  it("pairs players within same score group in Round 2", () => {
    const players = [
      makePlayer("p1", 2000, 1),
      makePlayer("p2", 1800, 1),
      makePlayer("p3", 1600, 0),
      makePlayer("p4", 1400, 0),
    ];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p3", "1-0"),
        makeGame("g2", 1, 2, "p2", "p4", "1-0"),
      ]),
    ];
    const games = generateSwissPairings(players, rounds, 2);
    expect(games).toHaveLength(2);

    // p1 and p2 should be paired (both 1 pt)
    const b1 = games.find(g => g.board === 1)!;
    expect([b1.whiteId, b1.blackId]).toContain("p1");
    expect([b1.whiteId, b1.blackId]).toContain("p2");

    // p3 and p4 should be paired (both 0 pts)
    const b2 = games.find(g => g.board === 2)!;
    expect([b2.whiteId, b2.blackId]).toContain("p3");
    expect([b2.whiteId, b2.blackId]).toContain("p4");
  });

  it("avoids repeat opponents when possible", () => {
    const players = [
      makePlayer("p1", 2000, 1),
      makePlayer("p2", 1800, 0),
      makePlayer("p3", 1600, 1),
      makePlayer("p4", 1400, 0),
    ];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"),
        makeGame("g2", 1, 2, "p3", "p4", "1-0"),
      ]),
    ];
    const games = generateSwissPairings(players, rounds, 2);
    expect(games).toHaveLength(2);

    // p1 should NOT be paired with p2 again
    for (const g of games) {
      const pair = [g.whiteId, g.blackId].sort().join("|");
      expect(pair).not.toBe("p1|p2");
      expect(pair).not.toBe("p3|p4");
    }
  });
});

// ─── Bye Assignment ───────────────────────────────────────────────────────────

describe("Bye assignment", () => {
  it("assigns bye to lowest-ranked player in odd-player tournament", () => {
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1800),
      makePlayer("p3", 1600),
    ];
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(2); // 1 game + 1 bye

    const byeGame = games.find(g => g.whiteId === "BYE")!;
    expect(byeGame).toBeDefined();
    expect(byeGame.blackId).toBe("p3"); // lowest rated gets bye
  });

  it("bye result is 1-0 (full point for bye recipient)", () => {
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1800),
      makePlayer("p3", 1600),
    ];
    const games = generateSwissPairings(players, [], 1);
    const byeGame = games.find(g => g.whiteId === "BYE")!;
    expect(byeGame.result).toBe("1-0");
  });

  it("does not give bye to same player twice", () => {
    const players = [
      makePlayer("p1", 2000, 1),
      makePlayer("p2", 1800, 1),
      makePlayer("p3", 1600, 1), // p3 got bye in round 1
    ];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"),
        makeGame("bye1", 1, 2, "BYE", "p3", "1-0"),
      ]),
    ];
    const games = generateSwissPairings(players, rounds, 2);
    const byeGame = games.find(g => g.whiteId === "BYE");
    // p3 should NOT get bye again if possible
    if (byeGame) {
      expect(byeGame.blackId).not.toBe("p3");
    }
  });

  it("computeStandings: bye recipient gets 1 full point", () => {
    const players = [
      makePlayer("p1", 2000),
      makePlayer("p2", 1800),
      makePlayer("p3", 1600),
    ];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"),
        makeGame("bye1", 1, 2, "BYE", "p3", "1-0"),
      ]),
    ];
    const standings = computeStandings(players, rounds);
    const p3Row = standings.find(r => r.player.id === "p3")!;
    expect(p3Row.points).toBe(1);
    expect(p3Row.wins).toBe(1);
  });
});

// ─── Color Balancing ──────────────────────────────────────────────────────────

describe("Color balancing", () => {
  it("does not assign same color 3 times in a row", () => {
    // p1 has played W W — must get Black next
    const p1 = makePlayer("p1", 2000, 2, ["W", "W"]);
    const p2 = makePlayer("p2", 1800, 2, ["B", "B"]);
    const p3 = makePlayer("p3", 1600, 0);
    const p4 = makePlayer("p4", 1400, 0);

    const rounds: Round[] = [
      makeRound(1, [makeGame("g1", 1, 1, "p1", "p3", "1-0"), makeGame("g2", 1, 2, "p2", "p4", "0-1")]),
      makeRound(2, [makeGame("g3", 2, 1, "p1", "p4", "1-0"), makeGame("g4", 2, 2, "p2", "p3", "0-1")]),
    ];

    const games = generateSwissPairings([p1, p2, p3, p4], rounds, 3);
    const p1Game = games.find(g => g.whiteId === "p1" || g.blackId === "p1")!;
    // p1 must be Black (had W W)
    expect(p1Game.blackId).toBe("p1");
  });

  it("assigns White to player with more Black games", () => {
    const p1 = makePlayer("p1", 2000, 0, ["B", "B"]);
    const p2 = makePlayer("p2", 1800, 0, ["W", "W"]);
    const games = generateSwissPairings([p1, p2], [], 3);
    const g = games[0];
    expect(g.whiteId).toBe("p1"); // p1 had more Black, gets White
    expect(g.blackId).toBe("p2");
  });
});

// ─── Rating Fallback Chain ────────────────────────────────────────────────────

describe("resolvePairingRating fallback chain", () => {
  it("uses manualPairingRating when set (highest priority)", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: 1500, blitzElo: 1400, bulletElo: 1300, manualPairingRating: 1750 },
      "rapid"
    );
    expect(pairingRating).toBe(1750);
    expect(ratingSource).toBe("manual");
  });

  it("uses rapidElo when ratingType is rapid and no manual override", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: 1500, blitzElo: 1400, manualPairingRating: undefined },
      "rapid"
    );
    expect(pairingRating).toBe(1500);
    expect(ratingSource).toBe("rapid");
  });

  it("falls back to blitzElo when rapidElo is missing", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: undefined, blitzElo: 1400, manualPairingRating: undefined },
      "rapid"
    );
    expect(pairingRating).toBe(1400);
    expect(ratingSource).toBe("blitz");
  });

  it("falls back to bulletElo when rapid and blitz are missing", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: undefined, blitzElo: undefined, bulletElo: 1350, manualPairingRating: undefined },
      "rapid"
    );
    expect(pairingRating).toBe(1350);
    expect(ratingSource).toBe("bullet");
  });

  it("falls back to default 1200 when all ratings are missing", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: undefined, blitzElo: undefined, bulletElo: undefined, manualPairingRating: undefined },
      "rapid"
    );
    expect(pairingRating).toBe(1200);
    expect(ratingSource).toBe("default");
  });

  it("uses blitzElo when ratingType is blitz", () => {
    const { pairingRating, ratingSource } = resolvePairingRating(
      { elo: 1200, rapidElo: 1500, blitzElo: 1400, manualPairingRating: undefined },
      "blitz"
    );
    expect(pairingRating).toBe(1400);
    expect(ratingSource).toBe("blitz");
  });
});

// ─── validatePairings ─────────────────────────────────────────────────────────

describe("validatePairings", () => {
  it("returns valid=true for a clean set of pairings", () => {
    const players = [makePlayer("p1"), makePlayer("p2"), makePlayer("p3"), makePlayer("p4")];
    const games: Game[] = [
      makeGame("r1b1", 1, 1, "p1", "p2"),
      makeGame("r1b2", 1, 2, "p3", "p4"),
    ];
    const result = validatePairings(games, players, [], 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when a player is paired twice in the same round", () => {
    const players = [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")];
    const games: Game[] = [
      makeGame("r1b1", 1, 1, "p1", "p2"),
      makeGame("r1b2", 1, 2, "p1", "p3"), // p1 paired twice
    ];
    const result = validatePairings(games, players, [], 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("p1") && e.includes("more than once"))).toBe(true);
  });

  it("errors when a player is paired against themselves", () => {
    const players = [makePlayer("p1"), makePlayer("p2")];
    const games: Game[] = [makeGame("r1b1", 1, 1, "p1", "p1")];
    const result = validatePairings(games, players, [], 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("themselves"))).toBe(true);
  });

  it("errors when player not in player list is paired", () => {
    const players = [makePlayer("p1"), makePlayer("p2")];
    const games: Game[] = [makeGame("r1b1", 1, 1, "p1", "unknown")];
    const result = validatePairings(games, players, [], 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("unknown"))).toBe(true);
  });

  it("warns on repeat opponent pairing", () => {
    const players = [makePlayer("p1"), makePlayer("p2"), makePlayer("p3"), makePlayer("p4")];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"),
        makeGame("g2", 1, 2, "p3", "p4", "1-0"),
      ]),
    ];
    const games: Game[] = [
      makeGame("r2b1", 2, 1, "p1", "p2"), // repeat!
      makeGame("r2b2", 2, 2, "p3", "p4"),
    ];
    const result = validatePairings(games, players, rounds, 2);
    expect(result.warnings.some(w => w.includes("Repeat pairing"))).toBe(true);
  });

  it("errors on more than one bye in a round", () => {
    const players = [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")];
    const games: Game[] = [
      makeGame("r1b1", 1, 1, "BYE", "p1"),
      makeGame("r1b2", 1, 2, "BYE", "p2"),
    ];
    const result = validatePairings(games, players, [], 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("More than one bye"))).toBe(true);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("handles 2 players in Round 1", () => {
    const players = [makePlayer("p1", 2000), makePlayer("p2", 1800)];
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(1);
    expect([games[0].whiteId, games[0].blackId]).toContain("p1");
    expect([games[0].whiteId, games[0].blackId]).toContain("p2");
  });

  it("handles 1 player (returns empty)", () => {
    const players = [makePlayer("p1", 2000)];
    const games = generateSwissPairings(players, [], 1);
    // 1 player = 1 bye game only
    expect(games.every(g => g.whiteId === "BYE" || g.blackId === "BYE")).toBe(true);
  });

  it("all games have correct round number", () => {
    const players = [makePlayer("p1", 2000), makePlayer("p2", 1800), makePlayer("p3", 1600), makePlayer("p4", 1400)];
    const games = generateSwissPairings(players, [], 3);
    expect(games.every(g => g.round === 3)).toBe(true);
  });

  it("board numbers are sequential starting from 1", () => {
    const players = [makePlayer("p1", 2000), makePlayer("p2", 1800), makePlayer("p3", 1600), makePlayer("p4", 1400)];
    const games = generateSwissPairings(players, [], 1);
    const boards = games.map(g => g.board).sort((a, b) => a - b);
    expect(boards).toEqual([1, 2]);
  });
});
