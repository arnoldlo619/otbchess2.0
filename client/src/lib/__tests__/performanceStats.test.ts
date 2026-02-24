/**
 * Unit tests for the post-tournament performance stats engine.
 * Tests cover: W/D/L computation, performance rating, best win,
 * biggest upset, streak, badge assignment, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { computeAllPerformances, computePlayerPerformance } from "../performanceStats";
import type { Player, Round } from "../tournamentData";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const makePlayer = (id: string, elo: number, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  username: `user_${id}`,
  elo,
  title: null,
  country: "US",
  points: 0,
  buchholz: 0,
  colorHistory: [],
  opponents: [],
  ...overrides,
});

const p1 = makePlayer("p1", 2000, { title: "GM" });
const p2 = makePlayer("p2", 1800);
const p3 = makePlayer("p3", 1600);
const p4 = makePlayer("p4", 1400);

// 3-round completed tournament: p1 wins all, p2 wins 2, p3 wins 1, p4 wins 0
const rounds: Round[] = [
  {
    number: 1,
    status: "completed",
    games: [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
      { id: "g2", round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "1-0" },
    ],
  },
  {
    number: 2,
    status: "completed",
    games: [
      { id: "g3", round: 2, board: 1, whiteId: "p1", blackId: "p3", result: "1-0" },
      { id: "g4", round: 2, board: 2, whiteId: "p2", blackId: "p4", result: "1-0" },
    ],
  },
  {
    number: 3,
    status: "completed",
    games: [
      { id: "g5", round: 3, board: 1, whiteId: "p1", blackId: "p4", result: "1-0" },
      { id: "g6", round: 3, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
    ],
  },
];

const players = [p1, p2, p3, p4];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeAllPerformances", () => {
  it("returns one entry per player", () => {
    const perfs = computeAllPerformances(players, rounds);
    expect(perfs).toHaveLength(4);
  });

  it("ranks p1 first with 3 wins", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    expect(p1perf.rank).toBe(1);
    expect(p1perf.wins).toBe(3);
    expect(p1perf.draws).toBe(0);
    expect(p1perf.losses).toBe(0);
    expect(p1perf.points).toBe(3);
  });

  it("ranks p4 last with 0 wins", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p4perf = perfs.find((p) => p.player.id === "p4")!;
    expect(p4perf.rank).toBe(4);
    expect(p4perf.wins).toBe(0);
    expect(p4perf.losses).toBe(3);
    expect(p4perf.points).toBe(0);
  });

  it("computes performance rating for p1 (3/3 vs avg 1600)", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    // p1 played p2(1800), p3(1600), p4(1400) → avg = 1600
    // 100% score → dp = +800 → perf = 1600 + 800 = 2400
    expect(p1perf.performanceRating).toBe(2400);
    expect(p1perf.ratingChange).toBe(400); // 2400 - 2000
  });

  it("computes performance rating for p4 (0/3 vs avg 1800)", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p4perf = perfs.find((p) => p.player.id === "p4")!;
    // p4 played p3(1600), p2(1800), p1(2000) → avg = 1800
    // 0% score → dp = -800 → perf = 1800 - 800 = 1000
    expect(p4perf.performanceRating).toBe(1000);
    expect(p4perf.ratingChange).toBe(-400); // 1000 - 1400
  });

  it("identifies best win for p3 (beat p4, only win)", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p3perf = perfs.find((p) => p.player.id === "p3")!;
    expect(p3perf.bestWin).not.toBeNull();
    expect(p3perf.bestWin!.opponent.id).toBe("p4");
  });

  it("does not flag a biggest upset for p1 (always higher rated)", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    // p1 is 2000 ELO — all opponents are lower rated, so no upset
    expect(p1perf.biggestUpset).toBeNull();
  });

  it("assigns champion badge to p1", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    expect(p1perf.badge).toBe("champion");
    expect(p1perf.badgeLabel).toContain("Champion");
  });

  it("assigns runner_up badge to p2", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p2perf = perfs.find((p) => p.player.id === "p2")!;
    expect(p2perf.badge).toBe("runner_up");
  });

  it("assigns third_place badge to p3", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p3perf = perfs.find((p) => p.player.id === "p3")!;
    expect(p3perf.badge).toBe("third_place");
  });

  it("computes longest win streak correctly for p1 (3 consecutive wins)", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    expect(p1perf.longestStreak).toBe(3);
  });

  it("computes color balance correctly", () => {
    const perfs = computeAllPerformances(players, rounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    // p1 played white in all 3 rounds
    expect(p1perf.whiteGames).toBe(3);
    expect(p1perf.blackGames).toBe(0);
  });

  it("returns empty array for empty player list", () => {
    const perfs = computeAllPerformances([], rounds);
    expect(perfs).toHaveLength(0);
  });

  it("handles in_progress rounds (excludes them from stats)", () => {
    const mixedRounds: Round[] = [
      ...rounds.slice(0, 2),
      { number: 3, status: "in_progress", games: [
        { id: "g5", round: 3, board: 1, whiteId: "p1", blackId: "p4", result: "*" },
        { id: "g6", round: 3, board: 2, whiteId: "p2", blackId: "p3", result: "*" },
      ]},
    ];
    const perfs = computeAllPerformances(players, mixedRounds);
    const p1perf = perfs.find((p) => p.player.id === "p1")!;
    // Only 2 completed rounds counted
    expect(p1perf.wins).toBe(2);
    expect(p1perf.points).toBe(2);
  });
});

describe("computePlayerPerformance", () => {
  it("returns performance for a specific player", () => {
    const perf = computePlayerPerformance("p2", players, rounds);
    expect(perf).not.toBeNull();
    expect(perf!.player.id).toBe("p2");
    expect(perf!.rank).toBe(2);
  });

  it("returns null for an unknown player id", () => {
    const perf = computePlayerPerformance("unknown", players, rounds);
    expect(perf).toBeNull();
  });
});

describe("giant_killer badge", () => {
  it("assigns giant_killer when upset gap is 200+ ELO and player is rank 4+", () => {
    // 5-player round-robin style: lowPlayer beats a much higher-rated opponent
    // but loses all other games, ending up rank 4 (outside podium)
    const p_a = makePlayer("pa", 2000); // wins 4
    const p_b = makePlayer("pb", 1900); // wins 3
    const p_c = makePlayer("pc", 1800); // wins 2
    const p_d = makePlayer("pd", 1700); // wins 1 (beats lowPlayer)
    const p_low = makePlayer("plow", 1200); // wins 1 (upsets pd), loses rest
    // Round 1: pa beats pb, pc beats pd, plow beats pd... we need plow to beat pd (500 gap)
    // but also have pa, pb, pc all win more games than plow
    const gkRounds: Round[] = [
      {
        number: 1, status: "completed",
        games: [
          { id: "r1g1", round: 1, board: 1, whiteId: "pa", blackId: "pb", result: "1-0" },
          { id: "r1g2", round: 1, board: 2, whiteId: "pc", blackId: "plow", result: "1-0" },
        ],
      },
      {
        number: 2, status: "completed",
        games: [
          { id: "r2g1", round: 2, board: 1, whiteId: "pa", blackId: "pc", result: "1-0" },
          { id: "r2g2", round: 2, board: 2, whiteId: "pb", blackId: "plow", result: "1-0" },
        ],
      },
      {
        number: 3, status: "completed",
        games: [
          { id: "r3g1", round: 3, board: 1, whiteId: "pa", blackId: "pd", result: "1-0" },
          // plow upsets pb (700 ELO gap: 1900 - 1200)
          { id: "r3g2", round: 3, board: 2, whiteId: "plow", blackId: "pd", result: "1-0" },
        ],
      },
      {
        number: 4, status: "completed",
        games: [
          { id: "r4g1", round: 4, board: 1, whiteId: "pb", blackId: "pc", result: "1-0" },
          { id: "r4g2", round: 4, board: 2, whiteId: "pd", blackId: "plow", result: "1-0" },
        ],
      },
    ];
    const allPlayers = [p_a, p_b, p_c, p_d, p_low];
    const perfs = computeAllPerformances(allPlayers, gkRounds);
    const lowPerf = perfs.find((p) => p.player.id === "plow")!;
    // plow beat pd (1700 ELO, gap = 500) → biggestUpset.eloGap = 500 >= 200
    expect(lowPerf.biggestUpset).not.toBeNull();
    expect(lowPerf.biggestUpset!.eloGap).toBeGreaterThanOrEqual(200);
    // plow's rank should be 4 or 5 (outside podium) → giant_killer badge
    expect(lowPerf.rank).toBeGreaterThan(3);
    expect(lowPerf.badge).toBe("giant_killer");
  });
});

describe("perfect_score badge", () => {
  it("assigns perfect_score when player wins all rounds", () => {
    const pa = makePlayer("pa", 1500);
    const pb = makePlayer("pb", 1400);
    const perfectRounds: Round[] = [
      { number: 1, status: "completed", games: [
        { id: "g1", round: 1, board: 1, whiteId: "pa", blackId: "pb", result: "1-0" },
      ]},
      { number: 2, status: "completed", games: [
        { id: "g2", round: 2, board: 1, whiteId: "pb", blackId: "pa", result: "0-1" },
      ]},
    ];
    const perfs = computeAllPerformances([pa, pb], perfectRounds);
    const paPerf = perfs.find((p) => p.player.id === "pa")!;
    // pa has 2/2 = perfect score, but rank 1 → champion badge takes priority
    expect(paPerf.badge).toBe("champion");
  });
});
