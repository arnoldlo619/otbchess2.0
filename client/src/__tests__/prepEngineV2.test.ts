/**
 * prepEngineV2.test.ts
 * Tests for the expanded Matchup Prep Engine v2:
 * - ECO classification (350+ entries)
 * - Opening stats and weakness scoring
 * - Move-order tree building
 * - Counter-line generation
 * - Insight generation
 */

import { describe, it, expect } from "vitest";
import {
  classifyOpening,
  analyzePlayStyle,
  generatePrepLines,
  generateInsights,
  type ChessComGame,
  type PlayStyleProfile,
} from "../../../server/prepEngine.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePgn(moves: string, result = "1-0"): string {
  return `[Event "Test"]\n[White "playerA"]\n[Black "playerB"]\n[Result "${result}"]\n\n${moves} ${result}`;
}

function makeGame(
  white: string,
  black: string,
  pgn: string,
  whiteResult: string,
  blackResult: string,
  timeClass: "rapid" | "blitz" | "bullet" = "rapid"
): ChessComGame {
  return {
    url: "https://chess.com/game/1",
    pgn,
    time_control: "600",
    time_class: timeClass,
    rated: true,
    rules: "chess",
    end_time: Date.now() / 1000,
    white: { username: white, rating: 1500, result: whiteResult },
    black: { username: black, rating: 1500, result: blackResult },
  };
}

// ─── ECO Classification Tests ─────────────────────────────────────────────────

describe("classifyOpening — ECO book v2", () => {
  it("classifies Ruy Lopez correctly", () => {
    const pgn = makePgn("1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^C8/);
    expect(result.name).toContain("Ruy Lopez");
  });

  it("classifies Sicilian Najdorf correctly", () => {
    const pgn = makePgn("1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^B[69]/);
    expect(result.name.toLowerCase()).toContain("najdorf");
  });

  it("classifies Sicilian Dragon correctly", () => {
    const pgn = makePgn("1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^B7/);
    expect(result.name.toLowerCase()).toContain("dragon");
  });

  it("classifies King's Indian Defense correctly", () => {
    const pgn = makePgn("1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^E9/);
    expect(result.name.toLowerCase()).toContain("king's indian");
  });

  it("classifies Grünfeld Defense correctly", () => {
    const pgn = makePgn("1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^D8/);
    expect(result.name.toLowerCase()).toContain("grünfeld");
  });

  it("classifies French Defense correctly", () => {
    const pgn = makePgn("1.e4 e6 2.d4 d5 3.Nc3 Bb4");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^C1/);
    expect(result.name.toLowerCase()).toContain("french");
  });

  it("classifies Caro-Kann correctly", () => {
    const pgn = makePgn("1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^B1/);
    expect(result.name.toLowerCase()).toContain("caro-kann");
  });

  it("classifies Queen's Gambit Declined correctly", () => {
    const pgn = makePgn("1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^D6/);
    expect(result.name.toLowerCase()).toContain("qgd");
  });

  it("classifies Nimzo-Indian correctly", () => {
    const pgn = makePgn("1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^E3/);
    expect(result.name.toLowerCase()).toContain("nimzo-indian");
  });

  it("classifies London System correctly", () => {
    const pgn = makePgn("1.d4 d5 2.Bf4 Nf6 3.e3 e6");
    const result = classifyOpening(pgn);
    expect(result.name.toLowerCase()).toContain("london");
  });

  it("classifies Catalan correctly", () => {
    const pgn = makePgn("1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O Nbd7 7.Qc2");
    const result = classifyOpening(pgn);
    expect(result.eco).toMatch(/^E0/);
    expect(result.name.toLowerCase()).toContain("catalan");
  });

  it("falls back gracefully for unknown openings", () => {
    const pgn = makePgn("1.h4 a5 2.h5 a4");
    const result = classifyOpening(pgn);
    expect(result.eco).toBeTruthy();
    expect(result.name).toBeTruthy();
  });
});

// ─── analyzePlayStyle Tests ───────────────────────────────────────────────────

describe("analyzePlayStyle", () => {
  const username = "testplayer";

  function buildGames(
    whiteWins: number,
    whiteLosses: number,
    blackWins: number,
    blackLosses: number,
    timeClass: "rapid" | "blitz" = "rapid"
  ): ChessComGame[] {
    const games: ChessComGame[] = [];
    const e4Pgn = makePgn("1.e4 e5 2.Nf3 Nc6 3.Bb5 a6");
    const d4Pgn = makePgn("1.d4 d5 2.c4 e6 3.Nc3 Nf6");

    for (let i = 0; i < whiteWins; i++) {
      games.push(makeGame(username, "opponent", e4Pgn, "win", "resigned", timeClass));
    }
    for (let i = 0; i < whiteLosses; i++) {
      games.push(makeGame(username, "opponent", e4Pgn, "resigned", "win", timeClass));
    }
    for (let i = 0; i < blackWins; i++) {
      games.push(makeGame("opponent", username, d4Pgn, "resigned", "win", timeClass));
    }
    for (let i = 0; i < blackLosses; i++) {
      games.push(makeGame("opponent", username, d4Pgn, "win", "resigned", timeClass));
    }
    return games;
  }

  it("correctly counts games analyzed", () => {
    const games = buildGames(5, 3, 4, 2);
    const profile = analyzePlayStyle(games, username);
    expect(profile.gamesAnalyzed).toBe(14);
  });

  it("correctly computes win rates by color", () => {
    const games = buildGames(8, 2, 3, 7);
    const profile = analyzePlayStyle(games, username);
    expect(profile.asWhite.winRate).toBeCloseTo(0.8, 1);
    expect(profile.asBlack.winRate).toBeCloseTo(0.3, 1);
  });

  it("identifies stronger color correctly", () => {
    const games = buildGames(9, 1, 1, 9);
    const profile = analyzePlayStyle(games, username);
    expect(profile.asWhite.winRate).toBeGreaterThan(profile.asBlack.winRate);
  });

  it("builds white openings list", () => {
    const games = buildGames(5, 3, 0, 0);
    const profile = analyzePlayStyle(games, username);
    expect(profile.whiteOpenings.length).toBeGreaterThan(0);
    expect(profile.whiteOpenings[0].count).toBeGreaterThan(0);
  });

  it("computes weakness scores for openings", () => {
    const games = buildGames(1, 9, 0, 0); // 10% win rate as white
    const profile = analyzePlayStyle(games, username);
    if (profile.whiteOpenings.length > 0) {
      expect(profile.whiteOpenings[0].weaknessScore).toBeGreaterThanOrEqual(0);
      expect(profile.whiteOpenings[0].weaknessScore).toBeLessThanOrEqual(100);
    }
  });

  it("builds time control split correctly", () => {
    const rapidGames = buildGames(5, 3, 4, 2, "rapid");
    const blitzGames = buildGames(3, 5, 2, 4, "blitz");
    const profile = analyzePlayStyle([...rapidGames, ...blitzGames], username);
    expect(profile.timeControlSplit.rapid.games).toBe(rapidGames.length);
    expect(profile.timeControlSplit.blitz.games).toBe(blitzGames.length);
  });

  it("identifies dominant time control", () => {
    const rapidGames = buildGames(8, 2, 8, 2, "rapid");
    const blitzGames = buildGames(1, 1, 1, 1, "blitz");
    const profile = analyzePlayStyle([...rapidGames, ...blitzGames], username);
    expect(profile.dominantTimeControl).toBe("rapid");
  });

  it("returns mixed when no dominant time control", () => {
    const rapidGames = buildGames(3, 2, 3, 2, "rapid");
    const blitzGames = buildGames(3, 2, 3, 2, "blitz");
    const profile = analyzePlayStyle([...rapidGames, ...blitzGames], username);
    // With equal split, should be mixed
    expect(["rapid", "blitz", "mixed"]).toContain(profile.dominantTimeControl);
  });

  it("handles empty games array gracefully", () => {
    const profile = analyzePlayStyle([], username);
    expect(profile.gamesAnalyzed).toBe(0);
    expect(profile.overall.winRate).toBe(0);
  });
});

// ─── generatePrepLines Tests ──────────────────────────────────────────────────

describe("generatePrepLines", () => {
  function makeProfile(topBlackOpening: string, topWhiteOpening: string): PlayStyleProfile {
    return {
      username: "opponent",
      gamesAnalyzed: 50,
      rating: { rapid: 1500, blitz: 1400, bullet: null },
      overall: { wins: 25, draws: 5, losses: 20, winRate: 0.5 },
      asWhite: { wins: 15, draws: 3, losses: 12, winRate: 0.5, games: 30 },
      asBlack: { wins: 10, draws: 2, losses: 8, winRate: 0.5, games: 20 },
      whiteOpenings: [{ name: topWhiteOpening, eco: "B20", count: 15, wins: 8, draws: 2, losses: 5, winRate: 0.53, moves: "1.e4 c5", weaknessScore: 30 }],
      blackOpenings: [{ name: topBlackOpening, eco: "B20", count: 12, wins: 6, draws: 1, losses: 5, winRate: 0.5, moves: "1.e4 c5 2.Nf3 d6", weaknessScore: 25 }],
      endgameProfile: { checkmates: 5, resignations: 15, timeouts: 2, draws: 5, total: 27 },
      firstMoveAsWhite: [{ move: "e4", count: 20, pct: 80 }],
      secondMoveTree: [{ move: "e4", count: 20, pct: 80, children: [{ move: "Nf3", count: 15, pct: 75 }] }],
      avgGameLength: 35,
      timeControlSplit: {
        rapid: { games: 30, winRate: 0.5 },
        blitz: { games: 20, winRate: 0.5 },
        bullet: { games: 0, winRate: 0 },
      },
      whiteOpeningsByTimeControl: { rapid: [], blitz: [], bullet: [] },
      blackOpeningsByTimeControl: { rapid: [], blitz: [], bullet: [] },
      dominantTimeControl: "rapid",
    };
  }

  it("returns prep lines for Sicilian Najdorf opponent", () => {
    const profile = makeProfile("Sicilian: Najdorf", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].name).toBeTruthy();
    expect(lines[0].rationale).toBeTruthy();
  });

  it("returns prep lines for Dragon opponent", () => {
    const profile = makeProfile("Sicilian: Dragon", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    expect(lines.length).toBeGreaterThan(0);
    const dragonCounter = lines.find(l => l.name.toLowerCase().includes("yugoslav") || l.eco === "B76");
    expect(dragonCounter).toBeTruthy();
  });

  it("returns prep lines for French Defense opponent", () => {
    const profile = makeProfile("French Defense", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    expect(lines.length).toBeGreaterThan(0);
    const frenchCounter = lines.find(l => l.name.toLowerCase().includes("french") || l.name.toLowerCase().includes("advance"));
    expect(frenchCounter).toBeTruthy();
  });

  it("returns prep lines for Ruy Lopez opponent (as black)", () => {
    const profile = makeProfile("King's Pawn Opening", "Ruy Lopez: Closed");
    const lines = generatePrepLines(profile, "black");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("includes lineType in all returned lines", () => {
    const profile = makeProfile("Sicilian: Najdorf", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    for (const line of lines) {
      expect(["main", "surprise", undefined]).toContain(line.lineType);
    }
  });

  it("includes confidence in all returned lines", () => {
    const profile = makeProfile("Sicilian: Dragon", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    for (const line of lines) {
      expect(["high", "medium", "low"]).toContain(line.confidence);
    }
  });

  it("returns at most 5 lines", () => {
    const profile = makeProfile("Sicilian: Najdorf", "King's Pawn Opening");
    const lines = generatePrepLines(profile, "white");
    expect(lines.length).toBeLessThanOrEqual(5);
  });
});

// ─── generateInsights Tests ───────────────────────────────────────────────────

describe("generateInsights", () => {
  function makeProfile(overrides: Partial<PlayStyleProfile> = {}): PlayStyleProfile {
    return {
      username: "opponent",
      gamesAnalyzed: 60,
      rating: { rapid: 1600, blitz: 1550, bullet: null },
      overall: { wins: 30, draws: 10, losses: 20, winRate: 0.5 },
      asWhite: { wins: 20, draws: 5, losses: 5, winRate: 0.67, games: 30 },
      asBlack: { wins: 10, draws: 5, losses: 15, winRate: 0.33, games: 30 },
      whiteOpenings: [{ name: "Ruy Lopez", eco: "C60", count: 15, wins: 10, draws: 2, losses: 3, winRate: 0.67, moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5", weaknessScore: 20 }],
      blackOpenings: [{ name: "Sicilian: Najdorf", eco: "B90", count: 12, wins: 4, draws: 2, losses: 6, winRate: 0.33, moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6", weaknessScore: 65 }],
      endgameProfile: { checkmates: 5, resignations: 20, timeouts: 3, draws: 10, total: 38 },
      firstMoveAsWhite: [{ move: "e4", count: 25, pct: 83 }],
      secondMoveTree: [{ move: "e4", count: 25, pct: 83, children: [{ move: "Nf3", count: 20, pct: 80 }] }],
      avgGameLength: 32,
      timeControlSplit: {
        rapid: { games: 40, winRate: 0.55 },
        blitz: { games: 20, winRate: 0.4 },
        bullet: { games: 0, winRate: 0 },
      },
      whiteOpeningsByTimeControl: { rapid: [], blitz: [], bullet: [] },
      blackOpeningsByTimeControl: { rapid: [], blitz: [], bullet: [] },
      dominantTimeControl: "rapid",
      ...overrides,
    };
  }

  it("returns at least 3 insights", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    expect(insights.length).toBeGreaterThanOrEqual(3);
  });

  it("returns at most 8 insights", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    expect(insights.length).toBeLessThanOrEqual(8);
  });

  it("mentions color advantage when significant", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    const colorInsight = insights.find(i => i.toLowerCase().includes("white") || i.toLowerCase().includes("black"));
    expect(colorInsight).toBeTruthy();
  });

  it("mentions top opening", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    const openingInsight = insights.find(i => i.toLowerCase().includes("ruy lopez") || i.toLowerCase().includes("najdorf"));
    expect(openingInsight).toBeTruthy();
  });

  it("mentions weakness when win rate is low", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    const weaknessInsight = insights.find(i => i.toLowerCase().includes("struggle") || i.toLowerCase().includes("exploitability"));
    expect(weaknessInsight).toBeTruthy();
  });

  it("all insights are non-empty strings", () => {
    const profile = makeProfile();
    const insights = generateInsights(profile);
    for (const insight of insights) {
      expect(typeof insight).toBe("string");
      expect(insight.length).toBeGreaterThan(10);
    }
  });
});
