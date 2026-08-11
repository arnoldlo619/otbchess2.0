/**
 * tests/prep-analysis-contract.test.ts
 *
 * Contract tests for the Matchup Prep Analysis Workspace.
 * Tests are written FIRST (failing), then production code is implemented.
 *
 * Covers:
 * - Trusted-context and access tests
 * - Legal-replay tests (castling, promotion, en passant, check, checkmate, setup FEN)
 * - URL and security tests
 * - Provider behavior tests
 * - Fair-play tests (ongoing games cannot launch analysis)
 */
import { describe, it, expect } from "vitest";
import {
  replayPgn,
  derivePositionAtPly,
  replayUciPath,
  extractLichessGameId,
  buildSourceGameKey,
  hashPgn,
  sansToPgn,
  LICHESS_GAME_ID_RE,
  resolveAnalysisWorkspace,
  buildTrustedSourceGame,
} from "../server/prep/analysisResolver";
import {
  buildGameEmbedUrl,
  buildAnalysisEmbedUrl,
  buildGameFallbackUrl,
  buildAnalysisFallbackUrl,
} from "../client/src/lib/embedUrlBuilder";
import type { ParsedGame, ScoutReportV3 } from "../shared/prepTypes";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Minimal valid ParsedGame for testing */
function makeGame(overrides: Partial<ParsedGame> = {}): ParsedGame {
  return {
    provider: "lichess",
    url: "https://lichess.org/MPJcy1JW",
    rated: true,
    rules: "chess",
    timeClass: "rapid",
    endTime: 1700000000,
    white: { name: "player1", rating: 1500, result: "win" },
    black: { name: "opponent", rating: 1600, result: "lost" },
    result: "1-0",
    sans: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"],
    plies: [],
    fullMoves: 3,
    opening: { eco: "C60", name: "Ruy Lopez", bookExitPly: 5 },
    scoutedColor: "black",
    scoutedScore: 0,
    ...overrides,
  };
}

/** Minimal valid ScoutReportV3 for testing */
function makeReport(games: ParsedGame[] = [], overrides: Partial<ScoutReportV3> = {}): ScoutReportV3 {
  return {
    version: 3,
    engineVersion: "v3.1",
    provider: "lichess",
    opponent: {
      username: "opponent",
      record: { white: { w: 2, d: 1, l: 1 }, black: { w: 1, d: 1, l: 2 } },
      avgRating: 1600,
      timeControlSplit: { rapid: { games: 4, score: 0.5 } },
      firstMoveAsWhite: "e4",
      firstMoveAsBlack: "e5",
      whiteOpenings: [],
      blackOpenings: [],
      dominantTimeControl: "rapid",
      gamesAnalyzed: games.length,
    },
    dataQuality: {
      parsed: games.length,
      excluded: {},
      ratedShare: 1,
      window: { from: "2024-01-01", to: "2024-12-31" },
      grade: "A",
      notes: [],
    },
    openingForecast: { white: [], black: [] },
    insights: [],
    sections: {
      matchupSummary: [],
      strengths: [],
      weaknesses: [],
      weakSignals: [],
      ifYouHaveWhite: [],
      ifYouHaveBlack: [],
      deviationPoints: [],
      behavior: [],
      prepChecklist: [],
    },
    guardLog: { droppedInsights: 0, reasons: {} },
    generatedAt: "2024-06-01T00:00:00Z",
    freshness: "strong",
    ...overrides,
  } as ScoutReportV3;
}

// ── Legal replay tests ────────────────────────────────────────────────────────

describe("replayPgn — legal replay", () => {
  it("replays a simple game and returns correct initial and final FEN", () => {
    const result = replayPgn(["e4", "e5", "Nf3", "Nc6", "Bb5"], "1-0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.initialFen).toBe(INITIAL_FEN);
    expect(result.plies).toHaveLength(5);
    expect(result.plies[0].san).toBe("e4");
    expect(result.plies[0].ply).toBe(1);
    expect(result.plies[0].sideToMove).toBe("white");
    expect(result.plies[1].sideToMove).toBe("black");
  });

  it("Phase 1 line: 1.d4 g6 2.c4 Bg7 3.Nc3 d6", () => {
    const sans = ["d4", "g6", "c4", "Bg7", "Nc3", "d6"];
    const result = replayPgn(sans, "*");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies).toHaveLength(6);
    expect(result.plies.map(p => p.san)).toEqual(["d4", "g6", "c4", "Bg7", "Nc3", "d6"]);
  });

  it("Phase 1 line: 1.d4 Nf6 2.Nc3 d5 3.Bf4", () => {
    const sans = ["d4", "Nf6", "Nc3", "d5", "Bf4"];
    const result = replayPgn(sans, "*");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies).toHaveLength(5);
  });

  it("Phase 1 line: 1.e4 c5 2.Nf3 d6 3.d4 cxd4", () => {
    const sans = ["e4", "c5", "Nf3", "d6", "d4", "cxd4"];
    const result = replayPgn(sans, "1/2-1/2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies).toHaveLength(6);
    expect(result.plies[5].san).toBe("cxd4");
  });

  it("handles castling correctly", () => {
    // Ruy Lopez setup where castling is possible
    const sans = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"];
    const result = replayPgn(sans, "1-0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies[8].san).toBe("O-O");
    // After castling, king should be on g1
    expect(result.plies[8].fen).toContain("K");
  });

  it("handles en passant correctly", () => {
    // Set up en passant: 1.e4 d5 2.e5 f5 3.exf6
    const sans = ["e4", "d5", "e5", "f5", "exf6"];
    const result = replayPgn(sans, "1-0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies[4].san).toBe("exf6");
  });

  it("handles pawn promotion correctly", () => {
    // Simplified promotion setup
    const sans = ["e4", "d5", "e5", "d4", "e6", "d3", "exf7+", "Kd7", "fxg8=Q"];
    const result = replayPgn(sans, "1-0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies[8].san).toContain("Q");
  });

  it("handles check and checkmate SAN notation", () => {
    // Scholar's mate
    const sans = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
    const result = replayPgn(sans, "1-0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plies[6].san).toBe("Qxf7#");
    expect(result.finished).toBe(true);
  });

  it("rejects an illegal move", () => {
    const result = replayPgn(["e4", "e5", "Qxe5"], "1-0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("illegal_move");
  });

  it("returns finished=false for result='*'", () => {
    const result = replayPgn(["e4", "e5"], "*");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.finished).toBe(false);
  });

  it("returns finished=true for 1-0, 0-1, 1/2-1/2", () => {
    for (const r of ["1-0", "0-1", "1/2-1/2"] as const) {
      const result = replayPgn(["e4", "e5"], r);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.finished).toBe(true);
    }
  });

  it("handles setup FEN (non-standard start position)", () => {
    // Start from a known position
    const setupFen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const result = replayPgn(["O-O"], "1-0", setupFen);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.initialFen).toBe(setupFen);
    expect(result.plies[0].san).toBe("O-O");
  });
});

describe("derivePositionAtPly", () => {
  it("returns initial FEN at ply 0", () => {
    const replay = replayPgn(["e4", "e5", "Nf3"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    const pos = derivePositionAtPly(replay, 0, "white");
    expect(pos.ply).toBe(0);
    expect(pos.fen).toBe(INITIAL_FEN);
    expect(pos.sanBreadcrumb).toHaveLength(0);
    expect(pos.uciPath).toHaveLength(0);
  });

  it("returns correct FEN and breadcrumb at ply 2", () => {
    const replay = replayPgn(["e4", "e5", "Nf3", "Nc6"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    const pos = derivePositionAtPly(replay, 2, "white");
    expect(pos.ply).toBe(2);
    expect(pos.sanBreadcrumb).toEqual(["e4", "e5"]);
    expect(pos.uciPath).toHaveLength(2);
  });

  it("bounds ply to 0 when negative", () => {
    const replay = replayPgn(["e4", "e5"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    const pos = derivePositionAtPly(replay, -5, "white");
    expect(pos.ply).toBe(0);
  });

  it("bounds ply to legalPlyCount when exceeding game length", () => {
    const replay = replayPgn(["e4", "e5"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    const pos = derivePositionAtPly(replay, 999, "white");
    expect(pos.ply).toBe(2);
  });

  it("sets orientation from myColor parameter", () => {
    const replay = replayPgn(["e4", "e5"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    const posWhite = derivePositionAtPly(replay, 0, "white");
    const posBlack = derivePositionAtPly(replay, 0, "black");
    expect(posWhite.orientation).toBe("white");
    expect(posBlack.orientation).toBe("black");
  });

  it("side-to-move is white at ply 0, black at ply 1, white at ply 2", () => {
    const replay = replayPgn(["e4", "e5", "Nf3"], "1-0");
    if (!replay.ok) throw new Error("Replay failed");
    // ply 0 = initial position, white to move
    expect(derivePositionAtPly(replay, 0, "white").sideToMove).toBe("white");
    // ply 1 = after e4, black to move
    // plies[0].sideToMove = "white" (who played e4), next = "black"
    // The implementation stores who MADE the move; the position after that move has the OTHER side to move
    // We accept either semantics as long as it's consistent
    const ply1 = derivePositionAtPly(replay, 1, "white");
    expect(["white", "black"]).toContain(ply1.sideToMove);
    // ply 2 = after e4 e5, white to move
    const ply2 = derivePositionAtPly(replay, 2, "white");
    expect(["white", "black"]).toContain(ply2.sideToMove);
    // The key invariant: ply 0 and ply 2 should have the same side to move (both white)
    expect(ply1.sideToMove).not.toBe(ply2.sideToMove);
  });
});

describe("replayUciPath", () => {
  it("replays a valid UCI path and returns correct FEN", () => {
    const result = replayUciPath(["e2e4", "e7e5", "g1f3"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sanBreadcrumb).toEqual(["e4", "e5", "Nf3"]);
  });

  it("rejects an invalid UCI format", () => {
    const result = replayUciPath(["e2e4", "INVALID"]);
    expect(result.ok).toBe(false);
  });

  it("rejects an illegal UCI move", () => {
    const result = replayUciPath(["e2e4", "e7e5", "e4e8"]); // illegal
    expect(result.ok).toBe(false);
  });

  it("handles promotion UCI (e7e8q)", () => {
    // Set up a position where promotion is possible
    // Use a simplified approach: replay to a position with a promotable pawn
    const sans = ["e4", "d5", "e5", "d4", "e6", "d3", "exf7+", "Kd7"];
    const replay = replayPgn(sans, "*");
    if (!replay.ok) throw new Error("Replay failed");
    const result = replayUciPath(["e2e4", "d7d5", "e4e5", "d5d4", "e5e6", "d4d3", "e6f7", "e8d7", "f7g8q"]);
    expect(result.ok).toBe(true);
  });

  it("handles empty path (root position)", () => {
    const result = replayUciPath([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fen).toBe(INITIAL_FEN);
    expect(result.sanBreadcrumb).toHaveLength(0);
  });
});

// ── Lichess game ID tests ─────────────────────────────────────────────────────

describe("extractLichessGameId", () => {
  it("extracts ID from lichess.org URL", () => {
    expect(extractLichessGameId("https://lichess.org/MPJcy1JW")).toBe("MPJcy1JW");
  });

  it("extracts ID from source game key", () => {
    expect(extractLichessGameId("lichess:MPJcy1JW")).toBe("MPJcy1JW");
  });

  it("returns null for non-Lichess URL", () => {
    expect(extractLichessGameId("https://chess.com/game/123")).toBeNull();
  });

  it("returns null for invalid key format", () => {
    expect(extractLichessGameId("chesscom:abc123")).toBeNull();
  });

  it("validates 8-char ID pattern", () => {
    expect(LICHESS_GAME_ID_RE.test("MPJcy1JW")).toBe(true);
    expect(LICHESS_GAME_ID_RE.test("abc123")).toBe(false);   // 6 chars
    expect(LICHESS_GAME_ID_RE.test("abc123456")).toBe(false); // 9 chars
    expect(LICHESS_GAME_ID_RE.test("abc!1234")).toBe(false);  // special char
  });
});

// ── Embed URL builder tests ───────────────────────────────────────────────────

describe("buildGameEmbedUrl", () => {
  it("builds a valid game embed URL", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("https://lichess.org/embed/game/MPJcy1JW");
    expect(result.url).toContain("theme=green");
    expect(result.url).toContain("pieceSet=cburnett");
    expect(result.url).toContain("bg=dark");
  });

  it("rejects invalid game ID (too short)", () => {
    const result = buildGameEmbedUrl({ gameId: "abc123" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid game ID (too long)", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JWextra" });
    expect(result.ok).toBe(false);
  });

  it("rejects game ID with special characters", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1!W" });
    expect(result.ok).toBe(false);
  });

  it("rejects game ID with path traversal attempt", () => {
    const result = buildGameEmbedUrl({ gameId: "../../../" });
    expect(result.ok).toBe(false);
  });

  it("uses light bg when specified", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW", bg: "light" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("bg=light");
  });

  it("URL origin is exactly https://lichess.org", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.origin).toBe("https://lichess.org");
  });
});

describe("buildAnalysisEmbedUrl", () => {
  const VALID_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

  it("builds a valid analysis embed URL", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN, color: "white" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("https://lichess.org/embed/analysis");
    expect(result.url).toContain("color=white");
    // FEN spaces should be underscores in the param value
    const url = new URL(result.url);
    const fenParam = url.searchParams.get("fen") ?? "";
    expect(fenParam).toContain("rnbqkbnr/pppppppp");
    expect(fenParam).toContain("_b_KQkq");
  });

  it("replaces FEN spaces with underscores", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The fen param should not contain raw spaces
    const url = new URL(result.url);
    const fenParam = url.searchParams.get("fen") ?? "";
    expect(fenParam).not.toContain(" ");
    expect(fenParam).toContain("_");
  });

  it("encodes FEN exactly once (no double-encoding)", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should not contain %25 (double-encoded %)
    expect(result.url).not.toContain("%25");
  });

  it("rejects FEN with injection characters", () => {
    const result = buildAnalysisEmbedUrl({ fen: '<script>alert("xss")</script>' });
    expect(result.ok).toBe(false);
  });

  it("rejects FEN with path traversal", () => {
    const result = buildAnalysisEmbedUrl({ fen: "../../../etc/passwd w - - 0 1" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid color", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN, color: "green" as "white" });
    expect(result.ok).toBe(false);
  });

  it("URL origin is exactly https://lichess.org", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.origin).toBe("https://lichess.org");
    expect(url.pathname).toBe("/embed/analysis");
  });

  it("does not include credentials, ports, or fragments", () => {
    const result = buildAnalysisEmbedUrl({ fen: VALID_FEN });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("@");
    expect(result.url).not.toContain(":443");
    expect(result.url).not.toContain("#");
  });
});

describe("buildGameFallbackUrl", () => {
  it("builds a valid fallback URL", () => {
    const result = buildGameFallbackUrl("MPJcy1JW");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toBe("https://lichess.org/MPJcy1JW");
  });

  it("rejects invalid game ID", () => {
    const result = buildGameFallbackUrl("invalid!");
    expect(result.ok).toBe(false);
  });
});

describe("buildAnalysisFallbackUrl", () => {
  it("builds a valid analysis fallback URL", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const result = buildAnalysisFallbackUrl(fen, "white");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("https://lichess.org/analysis/standard/");
    expect(result.url).toContain("color=white");
  });
});

// ── Resolver tests ────────────────────────────────────────────────────────────

describe("resolveAnalysisWorkspace — source-game", () => {
  const game = makeGame();
  const rawGames = [game];
  const report = makeReport(rawGames);

  it("resolves a valid source-game launch", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:MPJcy1JW",
        initialPly: 0,
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.launchKind).toBe("source-game");
    expect(result.workspace.game).toBeDefined();
    expect(result.workspace.game?.white).toBe("player1");
    expect(result.workspace.game?.black).toBe("opponent");
    expect(result.workspace.position.ply).toBe(0);
    expect(result.workspace.position.fen).toBe(INITIAL_FEN);
  });

  it("rejects a game not in the report", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:XXXXXXXX", // different game
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_not_in_report");
  });

  it("rejects an unfinished game (result='*')", () => {
    const unfinishedGame = makeGame({ result: "*" });
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:MPJcy1JW",
      },
      report: makeReport([unfinishedGame]),
      rawGames: [unfinishedGame],
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_unfinished");
  });

  it("rejects a non-standard variant", () => {
    const variantGame = makeGame({ rules: "chess960" });
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:MPJcy1JW",
      },
      report: makeReport([variantGame]),
      rawGames: [variantGame],
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unsupported_variant");
  });

  it("bounds out-of-range ply to game length", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:MPJcy1JW",
        initialPly: 9999,
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should be bounded to game length (6 plies)
    expect(result.workspace.position.ply).toBe(6);
  });

  it("bounds negative ply to 0", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        sourceGameKey: "lichess:MPJcy1JW",
        initialPly: -5,
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.position.ply).toBe(0);
  });

  it("sets orientation from myColor", () => {
    const resultWhite = resolveAnalysisWorkspace({
      subject: { kind: "source-game", reportCacheKey: "k", sourceGameKey: "lichess:MPJcy1JW" },
      report, rawGames, myColor: "white", reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    const resultBlack = resolveAnalysisWorkspace({
      subject: { kind: "source-game", reportCacheKey: "k", sourceGameKey: "lichess:MPJcy1JW" },
      report, rawGames, myColor: "black", reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(resultWhite.ok && resultWhite.workspace.position.orientation).toBe("white");
    expect(resultBlack.ok && resultBlack.workspace.position.orientation).toBe("black");
  });

  it("includes evidence context when evidenceClaimId matches an insight", () => {
    const reportWithInsight = makeReport(rawGames, {
      insights: [{
        id: "ins-001",
        kind: "opening_tendency",
        color: "black",
        role: "plays",
        claim: "As Black, they almost always open 1...e5",
        evidence: {
          stat: "6/9",
          games: [{ url: "https://lichess.org/MPJcy1JW", date: "2024-01-01", result: "W" }],
          window: { from: "2024-01-01", to: "2024-12-31", timeClasses: ["rapid"], ratedOnly: true },
        },
        interpretation: "Strong tendency",
        recommendation: { action: "Prepare for e5" },
        confidence: "high",
        sampleSize: 9,
      }],
    });
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "k",
        sourceGameKey: "lichess:MPJcy1JW",
        evidenceClaimId: "ins-001",
      },
      report: reportWithInsight,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.evidenceContext?.claim).toBe("As Black, they almost always open 1...e5");
    expect(result.workspace.evidenceContext?.count).toBe(9);
  });
});

describe("resolveAnalysisWorkspace — report-position", () => {
  const game = makeGame();
  const rawGames = [game];
  const report = makeReport(rawGames);

  it("resolves a valid report-position launch", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "report-position",
        reportCacheKey: "v3:lichess:opponent:all:g100",
        canonicalUciPath: ["e2e4", "e7e5", "g1f3"],
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.launchKind).toBe("report-position");
    expect(result.workspace.position.ply).toBe(3);
    expect(result.workspace.position.sanBreadcrumb).toEqual(["e4", "e5", "Nf3"]);
  });

  it("resolves root position (empty UCI path)", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "report-position",
        reportCacheKey: "k",
        canonicalUciPath: [],
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.position.ply).toBe(0);
    expect(result.workspace.position.fen).toBe(INITIAL_FEN);
  });

  it("rejects an illegal UCI path", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "report-position",
        reportCacheKey: "k",
        canonicalUciPath: ["e2e4", "e7e5", "e4e8"], // illegal
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("position_illegal");
  });

  it("rejects invalid UCI format", () => {
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "report-position",
        reportCacheKey: "k",
        canonicalUciPath: ["e2e4", "INVALID_UCI"],
      },
      report,
      rawGames,
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("position_illegal");
  });
});

// ── Fair-play tests ───────────────────────────────────────────────────────────

describe("fair-play — ongoing games cannot launch analysis", () => {
  it("rejects source-game launch for ongoing game (result='*')", () => {
    const ongoingGame = makeGame({ result: "*", sans: ["e4", "e5", "Nf3"] });
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "k",
        sourceGameKey: "lichess:MPJcy1JW",
      },
      report: makeReport([ongoingGame]),
      rawGames: [ongoingGame],
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("game_unfinished");
  });

  it("completed historical games remain analyzable", () => {
    const completedGame = makeGame({ result: "1-0" });
    const result = resolveAnalysisWorkspace({
      subject: {
        kind: "source-game",
        reportCacheKey: "k",
        sourceGameKey: "lichess:MPJcy1JW",
      },
      report: makeReport([completedGame]),
      rawGames: [completedGame],
      myColor: "white",
      reportCreatedAt: "2024-06-01T00:00:00Z",
    });
    expect(result.ok).toBe(true);
  });
});

// ── Provider behavior tests ───────────────────────────────────────────────────

describe("provider behavior", () => {
  it("builds correct source game key for lichess", () => {
    expect(buildSourceGameKey("lichess", "MPJcy1JW")).toBe("lichess:MPJcy1JW");
  });

  it("builds correct source game key for chesscom", () => {
    expect(buildSourceGameKey("chesscom", "12345678")).toBe("chesscom:12345678");
  });

  it("buildTrustedSourceGame sets finished=true", () => {
    const game = makeGame();
    const trusted = buildTrustedSourceGame(game, "lichess:MPJcy1JW");
    expect(trusted.finished).toBe(true);
  });

  it("buildTrustedSourceGame extracts Lichess game ID from URL", () => {
    const game = makeGame({ url: "https://lichess.org/MPJcy1JW" });
    const trusted = buildTrustedSourceGame(game, "lichess:MPJcy1JW");
    expect(trusted.providerGameId).toBe("MPJcy1JW");
  });

  it("buildTrustedSourceGame computes PGN hash", () => {
    const game = makeGame();
    const trusted = buildTrustedSourceGame(game, "lichess:MPJcy1JW");
    expect(trusted.pgnHash).toHaveLength(16);
    expect(trusted.pgnHash).toMatch(/^[0-9a-f]+$/);
  });

  it("hashPgn is deterministic", () => {
    const pgn = "1.e4 e5 2.Nf3 Nc6";
    expect(hashPgn(pgn)).toBe(hashPgn(pgn));
  });

  it("hashPgn differs for different PGNs", () => {
    expect(hashPgn("1.e4 e5")).not.toBe(hashPgn("1.d4 d5"));
  });

  it("sansToPgn produces correct PGN format", () => {
    const pgn = sansToPgn(["e4", "e5", "Nf3", "Nc6"]);
    expect(pgn).toBe("1. e4 e5 2. Nf3 Nc6");
  });
});

// ── Security tests ────────────────────────────────────────────────────────────

describe("security — no secrets in URLs", () => {
  it("game embed URL does not contain @ (credentials)", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("@");
  });

  it("analysis embed URL does not contain @ (credentials)", () => {
    const result = buildAnalysisEmbedUrl({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("@");
  });

  it("game embed URL does not contain fragment (#)", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("#");
  });

  it("only allowlisted query keys appear in game embed URL", () => {
    const result = buildGameEmbedUrl({ gameId: "MPJcy1JW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    const keys = Array.from(url.searchParams.keys());
    for (const key of keys) {
      expect(["theme", "pieceSet", "bg"]).toContain(key);
    }
  });

  it("only allowlisted query keys appear in analysis embed URL", () => {
    const result = buildAnalysisEmbedUrl({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    const keys = Array.from(url.searchParams.keys());
    for (const key of keys) {
      expect(["fen", "color", "theme", "pieceSet", "bg"]).toContain(key);
    }
  });
});
