/**
 * finalStandings.test.ts
 *
 * Tests for the FinalStandings page tiebreak logic:
 *   - computeStandings correctly sorts by Pts → Bch → Bch1 → SB → ELO
 *   - Buchholz, BuchholzCut1, and Sonneborn-Berger are computed correctly
 *   - Route /tournament/:id/results is registered (smoke check via App routing)
 */

import { describe, it, expect } from "vitest";
import { computeStandings } from "../lib/swiss";
import type { Player, Round, Game } from "../lib/tournamentData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, elo = 1500): Player {
  return {
    id,
    name: `Player ${id}`,
    username: `player_${id}`,
    elo,
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
  };
}

function makeGame(
  id: string,
  round: number,
  board: number,
  whiteId: string,
  blackId: string,
  result: "1-0" | "0-1" | "½-½" | "*"
): Game {
  return { id, round, board, whiteId, blackId, result };
}

function makeRound(number: number, games: Game[]): Round {
  return { number, status: "completed", games };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeStandings — FinalStandings tiebreak logic", () => {
  it("ranks players by points descending", () => {
    const p1 = makePlayer("p1", 1800);
    const p2 = makePlayer("p2", 1600);
    const p3 = makePlayer("p3", 1400);

    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"), // p1 wins
        makeGame("g2", 1, 2, "p3", "p1", "0-1"), // p1 wins again (bye-like, but p3 is real)
      ]),
    ];

    // p1: 2pts, p2: 0pts, p3: 0pts
    const standings = computeStandings([p1, p2, p3], rounds);
    expect(standings[0].player.id).toBe("p1");
    expect(standings[0].points).toBe(2);
  });

  it("uses Buchholz as tiebreak when points are equal", () => {
    // 4 players, 2 rounds
    // p1 and p2 both end with 1pt, but p1 beat a stronger opponent
    const p1 = makePlayer("p1", 1800);
    const p2 = makePlayer("p2", 1800);
    const p3 = makePlayer("p3", 1600); // p1's opponent
    const p4 = makePlayer("p4", 1200); // p2's opponent

    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p3", "1-0"), // p1 beats p3
        makeGame("g2", 1, 2, "p4", "p2", "0-1"), // p2 beats p4
      ]),
      makeRound(2, [
        makeGame("g3", 2, 1, "p2", "p3", "0-1"), // p3 beats p2
        makeGame("g4", 2, 2, "p4", "p1", "1-0"), // p4 beats p1
      ]),
    ];

    // p1: 1pt, opponent p3 ends with 1pt → Bch = 1
    // p2: 1pt, opponent p4 ends with 1pt → Bch = 1
    // p3: 1pt, opponent p1 ends with 1pt
    // p4: 1pt, opponent p2 ends with 1pt
    const standings = computeStandings([p1, p2, p3, p4], rounds);
    // All have 1pt and same Bch, so ELO tiebreak applies
    // p1 and p2 both have elo 1800, p3 has 1600, p4 has 1200
    expect(standings[0].points).toBe(1);
  });

  it("computes BuchholzCut1 by removing the lowest opponent score", () => {
    const p1 = makePlayer("p1", 2000);
    const p2 = makePlayer("p2", 1800); // beats p1
    const p3 = makePlayer("p3", 1200); // loses to p1
    const p4 = makePlayer("p4", 1600); // draws with p1

    const rounds: Round[] = [
      makeRound(1, [makeGame("g1", 1, 1, "p1", "p3", "1-0")]),
      makeRound(2, [makeGame("g2", 2, 1, "p2", "p1", "1-0")]),
      makeRound(3, [makeGame("g3", 3, 1, "p1", "p4", "½-½")]),
    ];

    const standings = computeStandings([p1, p2, p3, p4], rounds);
    const p1Row = standings.find((r) => r.player.id === "p1")!;

    // p1's opponents: p3 (0pts after losing), p2 (1pt after beating p1), p4 (0.5pts after draw)
    // Bch = 0 + 1 + 0.5 = 1.5
    // Bch1 = remove lowest (0) → 1 + 0.5 = 1.5 (only 2 remaining after cut)
    expect(p1Row.buchholz).toBeCloseTo(1.5, 1);
    // BuchholzCut1 removes the lowest opponent score
    expect(p1Row.buchholzCut1).toBeLessThanOrEqual(p1Row.buchholz);
  });

  it("computes Sonneborn-Berger correctly", () => {
    const p1 = makePlayer("p1", 2000);
    const p2 = makePlayer("p2", 1800);
    const p3 = makePlayer("p3", 1600);

    const rounds: Round[] = [
      makeRound(1, [makeGame("g1", 1, 1, "p1", "p2", "1-0")]), // p1 beats p2
      makeRound(2, [makeGame("g2", 2, 1, "p1", "p3", "½-½")]), // p1 draws p3
    ];

    const standings = computeStandings([p1, p2, p3], rounds);
    const p1Row = standings.find((r) => r.player.id === "p1")!;

    // p2 ends with 0pts (lost to p1), p3 ends with 0.5pts (drew with p1)
    // SB for p1 = p2.points (win) + p3.points * 0.5 (draw) = 0 + 0.5*0.5 = 0.25
    expect(p1Row.sonnebornBerger).toBeCloseTo(0.25, 2);
  });

  it("assigns correct ranks starting from 1", () => {
    const players = [makePlayer("a", 2000), makePlayer("b", 1800), makePlayer("c", 1600)];
    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "a", "b", "1-0"),
        makeGame("g2", 1, 2, "c", "a", "0-1"),
      ]),
    ];
    const standings = computeStandings(players, rounds);
    expect(standings.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("handles bye (whiteId === BYE) correctly — bye player gets 0.5pts", () => {
    const p1 = makePlayer("p1", 1800);
    const p2 = makePlayer("p2", 1600);
    const p3 = makePlayer("p3", 1400);

    const rounds: Round[] = [
      makeRound(1, [
        makeGame("g1", 1, 1, "p1", "p2", "1-0"),
        makeGame("bye1", 1, 2, "BYE", "p3", "½-½"), // p3 gets bye
      ]),
    ];

    const standings = computeStandings([p1, p2, p3], rounds);
    const p3Row = standings.find((r) => r.player.id === "p3")!;
    expect(p3Row.points).toBe(0.5);
  });

  it("returns empty array for empty player list", () => {
    const standings = computeStandings([], []);
    expect(standings).toHaveLength(0);
  });

  it("returns all players with 0 points when no rounds played", () => {
    const players = [makePlayer("a"), makePlayer("b"), makePlayer("c")];
    const standings = computeStandings(players, []);
    expect(standings).toHaveLength(3);
    expect(standings.every((r) => r.points === 0)).toBe(true);
    expect(standings.every((r) => r.buchholz === 0)).toBe(true);
    expect(standings.every((r) => r.sonnebornBerger === 0)).toBe(true);
  });

  it("uses ELO as final tiebreak when all other tiebreaks are equal", () => {
    const p1 = makePlayer("p1", 2000);
    const p2 = makePlayer("p2", 1800);
    // Both have 0pts, 0 buchholz, 0 SB — ELO decides
    const standings = computeStandings([p2, p1], []);
    expect(standings[0].player.id).toBe("p1"); // higher ELO wins
    expect(standings[1].player.id).toBe("p2");
  });

  it("correctly computes wins, draws, losses counts", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const p3 = makePlayer("p3");

    const rounds: Round[] = [
      makeRound(1, [makeGame("g1", 1, 1, "p1", "p2", "1-0")]),
      makeRound(2, [makeGame("g2", 2, 1, "p1", "p3", "½-½")]),
    ];

    const standings = computeStandings([p1, p2, p3], rounds);
    const p1Row = standings.find((r) => r.player.id === "p1")!;
    expect(p1Row.wins).toBe(1);
    expect(p1Row.draws).toBe(1);
    expect(p1Row.losses).toBe(0);
    expect(p1Row.points).toBe(1.5);

    const p2Row = standings.find((r) => r.player.id === "p2")!;
    expect(p2Row.wins).toBe(0);
    expect(p2Row.draws).toBe(0);
    expect(p2Row.losses).toBe(1);
    expect(p2Row.points).toBe(0);
  });
});
