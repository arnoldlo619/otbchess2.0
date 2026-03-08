/**
 * Tests for the PGN export utility (client/src/lib/exportPgn.ts)
 *
 * Covers:
 *   - classificationToNag: maps classification strings to PGN NAG symbols
 *   - evalCpToString: formats centipawn evaluations and mate scores
 *   - buildMoveComment: builds inline { [%eval] [%cal] } comment blocks
 *   - pgnHeader: formats individual PGN header tags
 *   - buildPgnHeaders: builds the full header block
 *   - buildMoveText: assembles the annotated move text section
 *   - wrapAt80: wraps token lists at 80 characters
 *   - buildAnnotatedPgn: integration test for the full PGN output
 */
import { describe, it, expect } from "vitest";
import {
  classificationToNag,
  evalCpToString,
  buildMoveComment,
  pgnHeader,
  buildPgnHeaders,
  buildMoveText,
  wrapAt80,
  buildAnnotatedPgn,
  type MoveAnalysisForExport,
  type GameDataForExport,
} from "../exportPgn";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const SAMPLE_GAME: GameDataForExport = {
  whitePlayer: "Kasparov",
  blackPlayer: "Karpov",
  result: "1-0",
  event: "World Championship",
  date: "1985-11-09",
  openingName: "Ruy Lopez",
  openingEco: "C65",
};

const SAMPLE_ANALYSES: MoveAnalysisForExport[] = [
  { moveNumber: 1, color: "w", san: "e4", eval: 20, bestMove: null, classification: "best" },
  { moveNumber: 1, color: "b", san: "e5", eval: 0, bestMove: null, classification: "good" },
  { moveNumber: 2, color: "w", san: "Nf3", eval: 25, bestMove: null, classification: "best" },
  { moveNumber: 2, color: "b", san: "Nc6", eval: 5, bestMove: null, classification: "good" },
  { moveNumber: 3, color: "w", san: "Bb5", eval: 30, bestMove: null, classification: "best" },
  { moveNumber: 3, color: "b", san: "a6", eval: 10, bestMove: null, classification: "inaccuracy" },
  { moveNumber: 4, color: "w", san: "Ba4", eval: 35, bestMove: null, classification: "best" },
  { moveNumber: 4, color: "b", san: "Nf6", eval: 15, bestMove: null, classification: "good" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// classificationToNag
// ═══════════════════════════════════════════════════════════════════════════════

describe("classificationToNag", () => {
  it("maps best to !", () => {
    expect(classificationToNag("best")).toBe("!");
  });

  it("maps good to empty string (no annotation)", () => {
    expect(classificationToNag("good")).toBe("");
  });

  it("maps inaccuracy to !?", () => {
    expect(classificationToNag("inaccuracy")).toBe("!?");
  });

  it("maps mistake to ?", () => {
    expect(classificationToNag("mistake")).toBe("?");
  });

  it("maps blunder to ??", () => {
    expect(classificationToNag("blunder")).toBe("??");
  });

  it("maps null to empty string", () => {
    expect(classificationToNag(null)).toBe("");
  });

  it("maps unknown classification to empty string", () => {
    expect(classificationToNag("unknown")).toBe("");
  });

  it("maps empty string to empty string", () => {
    expect(classificationToNag("")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// evalCpToString
// ═══════════════════════════════════════════════════════════════════════════════

describe("evalCpToString", () => {
  it("formats 0 as 0.00", () => {
    expect(evalCpToString(0)).toBe("0.00");
  });

  it("formats 23 cp as 0.23", () => {
    expect(evalCpToString(23)).toBe("0.23");
  });

  it("formats -150 cp as -1.50", () => {
    expect(evalCpToString(-150)).toBe("-1.50");
  });

  it("formats 300 cp as 3.00", () => {
    expect(evalCpToString(300)).toBe("3.00");
  });

  it("formats -50 cp as -0.50", () => {
    expect(evalCpToString(-50)).toBe("-0.50");
  });

  it("formats 100 cp as 1.00", () => {
    expect(evalCpToString(100)).toBe("1.00");
  });

  it("formats mate in 3 (white) as #3", () => {
    // 10000 + 3*100 = 10300
    expect(evalCpToString(10300)).toBe("#3");
  });

  it("formats mate in 1 (white) as #1", () => {
    expect(evalCpToString(10100)).toBe("#1");
  });

  it("formats mate in 5 (black) as #-5", () => {
    expect(evalCpToString(-10500)).toBe("#-5");
  });

  it("formats mate in 2 (black) as #-2", () => {
    expect(evalCpToString(-10200)).toBe("#-2");
  });

  it("formats 10000 exactly as #0", () => {
    expect(evalCpToString(10000)).toBe("#0");
  });

  it("formats large non-mate value correctly", () => {
    expect(evalCpToString(999)).toBe("9.99");
  });

  it("formats -999 cp correctly", () => {
    expect(evalCpToString(-999)).toBe("-9.99");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildMoveComment
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildMoveComment", () => {
  it("returns empty string when eval is null and no best move", () => {
    expect(buildMoveComment(null, null, null)).toBe("");
  });

  it("includes eval annotation when eval is provided", () => {
    const comment = buildMoveComment(23, null, "best");
    expect(comment).toContain("[%eval 0.23]");
  });

  it("wraps annotation in curly braces", () => {
    const comment = buildMoveComment(23, null, "best");
    expect(comment).toMatch(/^\{.*\}$/);
  });

  it("does NOT include best-move arrow for best moves", () => {
    const comment = buildMoveComment(30, "e2e4", "best");
    expect(comment).not.toContain("[%cal");
  });

  it("does NOT include best-move arrow for good moves", () => {
    const comment = buildMoveComment(30, "e2e4", "good");
    expect(comment).not.toContain("[%cal");
  });

  it("includes best-move arrow for inaccuracies", () => {
    const comment = buildMoveComment(-50, "g1f3", "inaccuracy");
    expect(comment).toContain("[%cal Gg1f3]");
  });

  it("includes best-move arrow for mistakes", () => {
    const comment = buildMoveComment(-150, "d1h5", "mistake");
    expect(comment).toContain("[%cal Gd1h5]");
  });

  it("includes best-move arrow for blunders", () => {
    const comment = buildMoveComment(-300, "e1g1", "blunder");
    expect(comment).toContain("[%cal Ge1g1]");
  });

  it("includes both eval and arrow for a blunder", () => {
    const comment = buildMoveComment(-300, "e1g1", "blunder");
    expect(comment).toContain("[%eval -3.00]");
    expect(comment).toContain("[%cal Ge1g1]");
  });

  it("skips arrow when bestMove is null", () => {
    const comment = buildMoveComment(-300, null, "blunder");
    expect(comment).not.toContain("[%cal");
    expect(comment).toContain("[%eval -3.00]");
  });

  it("skips arrow when bestMove is too short (< 4 chars)", () => {
    const comment = buildMoveComment(-300, "e4", "blunder");
    expect(comment).not.toContain("[%cal");
  });

  it("returns empty string when eval is null even with classification", () => {
    const comment = buildMoveComment(null, null, "best");
    expect(comment).toBe("");
  });

  it("formats mate eval correctly in comment", () => {
    const comment = buildMoveComment(10300, null, "best");
    expect(comment).toContain("[%eval #3]");
  });

  it("formats negative eval correctly in comment", () => {
    const comment = buildMoveComment(-150, null, "mistake");
    expect(comment).toContain("[%eval -1.50]");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// pgnHeader
// ═══════════════════════════════════════════════════════════════════════════════

describe("pgnHeader", () => {
  it("formats a basic tag", () => {
    expect(pgnHeader("Event", "World Championship")).toBe('[Event "World Championship"]');
  });

  it("formats White tag", () => {
    expect(pgnHeader("White", "Kasparov")).toBe('[White "Kasparov"]');
  });

  it("formats Result tag", () => {
    expect(pgnHeader("Result", "1-0")).toBe('[Result "1-0"]');
  });

  it("escapes double quotes in value", () => {
    const result = pgnHeader("Event", 'Test "quoted" event');
    expect(result).toBe('[Event "Test \\"quoted\\" event"]');
  });

  it("escapes backslashes in value", () => {
    const result = pgnHeader("Event", "path\\to\\file");
    expect(result).toBe('[Event "path\\\\to\\\\file"]');
  });

  it("handles empty value", () => {
    expect(pgnHeader("Round", "")).toBe('[Round ""]');
  });

  it("handles question mark value", () => {
    expect(pgnHeader("Round", "?")).toBe('[Round "?"]');
  });

  it("handles date format", () => {
    expect(pgnHeader("Date", "1985.11.09")).toBe('[Date "1985.11.09"]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPgnHeaders
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildPgnHeaders", () => {
  it("includes all seven required tags", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain("[Event ");
    expect(headers).toContain("[Site ");
    expect(headers).toContain("[Date ");
    expect(headers).toContain("[Round ");
    expect(headers).toContain("[White ");
    expect(headers).toContain("[Black ");
    expect(headers).toContain("[Result ");
  });

  it("includes ECO tag when openingEco is present", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain('[ECO "C65"]');
  });

  it("includes Opening tag when openingName is present", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain('[Opening "Ruy Lopez"]');
  });

  it("includes Annotator tag", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain("[Annotator ");
    expect(headers).toContain("Stockfish");
  });

  it("uses player names from game data", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain('[White "Kasparov"]');
    expect(headers).toContain('[Black "Karpov"]');
  });

  it("uses result from game data", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain('[Result "1-0"]');
  });

  it("uses date from game data", () => {
    const headers = buildPgnHeaders(SAMPLE_GAME);
    expect(headers).toContain('[Date "1985-11-09"]');
  });

  it("falls back to 'White' when whitePlayer is null", () => {
    const game = { ...SAMPLE_GAME, whitePlayer: null };
    const headers = buildPgnHeaders(game);
    expect(headers).toContain('[White "White"]');
  });

  it("falls back to 'Black' when blackPlayer is null", () => {
    const game = { ...SAMPLE_GAME, blackPlayer: null };
    const headers = buildPgnHeaders(game);
    expect(headers).toContain('[Black "Black"]');
  });

  it("falls back to 'OTB Game' when event is null", () => {
    const game = { ...SAMPLE_GAME, event: null };
    const headers = buildPgnHeaders(game);
    expect(headers).toContain('[Event "OTB Game"]');
  });

  it("falls back to '????.??.??' when date is null", () => {
    const game = { ...SAMPLE_GAME, date: null };
    const headers = buildPgnHeaders(game);
    expect(headers).toContain('[Date "????.??.??"]');
  });

  it("omits ECO tag when openingEco is null", () => {
    const game = { ...SAMPLE_GAME, openingEco: null };
    const headers = buildPgnHeaders(game);
    expect(headers).not.toContain("[ECO ");
  });

  it("omits Opening tag when openingName is null", () => {
    const game = { ...SAMPLE_GAME, openingName: null };
    const headers = buildPgnHeaders(game);
    expect(headers).not.toContain("[Opening ");
  });

  it("uses '*' result when result is null", () => {
    const game = { ...SAMPLE_GAME, result: null };
    const headers = buildPgnHeaders(game);
    expect(headers).toContain('[Result "*"]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// wrapAt80
// ═══════════════════════════════════════════════════════════════════════════════

describe("wrapAt80", () => {
  it("returns empty string for empty token array", () => {
    expect(wrapAt80([])).toBe("");
  });

  it("returns single token unchanged", () => {
    expect(wrapAt80(["1."])).toBe("1.");
  });

  it("joins short tokens on one line", () => {
    const result = wrapAt80(["1.", "e4", "e5", "2.", "Nf3", "Nc6"]);
    expect(result).toBe("1. e4 e5 2. Nf3 Nc6");
  });

  it("wraps lines exceeding 80 characters", () => {
    // Create tokens that will exceed 80 chars on one line
    const tokens = Array.from({ length: 20 }, (_, i) => `token${i}`);
    const result = wrapAt80(tokens);
    const lines = result.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("never breaks a single long token", () => {
    const longToken = "a".repeat(100);
    const result = wrapAt80([longToken]);
    expect(result).toBe(longToken);
  });

  it("produces multiple lines for long content", () => {
    const tokens = Array.from({ length: 50 }, (_, i) => `move${i}`);
    const result = wrapAt80(tokens);
    expect(result).toContain("\n");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildMoveText
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildMoveText", () => {
  it("includes move numbers for white moves", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    expect(text).toContain("1.");
    expect(text).toContain("2.");
    expect(text).toContain("3.");
    expect(text).toContain("4.");
  });

  it("includes SAN moves", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    expect(text).toContain("e4");
    expect(text).toContain("e5");
    expect(text).toContain("Nf3");
    expect(text).toContain("Nc6");
    expect(text).toContain("Bb5");
    expect(text).toContain("a6");
  });

  it("appends NAG symbol for inaccuracy", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    // a6 is classified as inaccuracy → should get !?
    expect(text).toContain("a6!?");
  });

  it("appends ! for best moves", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    expect(text).toContain("e4!");
  });

  it("does not annotate good moves with NAG", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    // e5 is good → no NAG suffix
    expect(text).not.toContain("e5!?");
    expect(text).not.toContain("e5?");
    expect(text).not.toContain("e5??");
  });

  it("includes eval comments", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    expect(text).toContain("[%eval");
  });

  it("appends game result at the end", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1-0");
    expect(text.trimEnd()).toMatch(/1-0$/);
  });

  it("appends * when result is null", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, null);
    expect(text.trimEnd()).toMatch(/\*$/);
  });

  it("appends * when result is *", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "*");
    expect(text.trimEnd()).toMatch(/\*$/);
  });

  it("handles empty analyses array", () => {
    const text = buildMoveText([], "1-0");
    expect(text.trim()).toBe("1-0");
  });

  it("includes best-move arrow for blunder", () => {
    const blunderAnalyses: MoveAnalysisForExport[] = [
      { moveNumber: 1, color: "w", san: "Qh5", eval: -300, bestMove: "e2e4", classification: "blunder" },
    ];
    const text = buildMoveText(blunderAnalyses, "*");
    expect(text).toContain("[%cal Ge2e4]");
  });

  it("does not include arrow for best move", () => {
    const bestAnalyses: MoveAnalysisForExport[] = [
      { moveNumber: 1, color: "w", san: "e4", eval: 20, bestMove: "e2e4", classification: "best" },
    ];
    const text = buildMoveText(bestAnalyses, "*");
    expect(text).not.toContain("[%cal");
  });

  it("handles a draw result", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "1/2-1/2");
    expect(text.trimEnd()).toMatch(/1\/2-1\/2$/);
  });

  it("handles black-wins result", () => {
    const text = buildMoveText(SAMPLE_ANALYSES, "0-1");
    expect(text.trimEnd()).toMatch(/0-1$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildAnnotatedPgn (integration)
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildAnnotatedPgn (integration)", () => {
  it("produces a non-empty string", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn.length).toBeGreaterThan(0);
  });

  it("starts with PGN headers", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toMatch(/^\[Event /);
  });

  it("has a blank line separating headers from move text", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toContain("\n\n");
  });

  it("ends with a newline", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toMatch(/\n$/);
  });

  it("contains all required header tags", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toContain("[Event ");
    expect(pgn).toContain("[White ");
    expect(pgn).toContain("[Black ");
    expect(pgn).toContain("[Result ");
    expect(pgn).toContain("[ECO ");
    expect(pgn).toContain("[Opening ");
    expect(pgn).toContain("[Annotator ");
  });

  it("contains move text with eval comments", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toContain("[%eval");
    expect(pgn).toContain("1. e4");
  });

  it("contains the game result", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    expect(pgn).toContain("1-0");
  });

  it("produces valid PGN structure for an empty game", () => {
    const game: GameDataForExport = { ...SAMPLE_GAME, result: null };
    const pgn = buildAnnotatedPgn(game, []);
    expect(pgn).toContain("[Event ");
    expect(pgn).toContain("*");
  });

  it("includes inaccuracy arrow in full PGN", () => {
    const analyses: MoveAnalysisForExport[] = [
      { moveNumber: 1, color: "w", san: "e4", eval: 20, bestMove: null, classification: "best" },
      { moveNumber: 1, color: "b", san: "d5", eval: -50, bestMove: "e7e5", classification: "inaccuracy" },
    ];
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, analyses);
    expect(pgn).toContain("[%cal Ge7e5]");
    expect(pgn).toContain("d5!?");
  });

  it("includes blunder annotation in full PGN", () => {
    const analyses: MoveAnalysisForExport[] = [
      { moveNumber: 1, color: "w", san: "f3", eval: -200, bestMove: "e2e4", classification: "blunder" },
    ];
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, analyses);
    expect(pgn).toContain("f3??");
    expect(pgn).toContain("[%eval -2.00]");
    expect(pgn).toContain("[%cal Ge2e4]");
  });

  it("produces importable PGN with correct header format", () => {
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, SAMPLE_ANALYSES);
    // Each header line must match [Tag "Value"] format
    const lines = pgn.split("\n");
    const headerLines = lines.filter((l) => l.startsWith("["));
    for (const line of headerLines) {
      expect(line).toMatch(/^\[.+ ".*"\]$/);
    }
  });

  it("handles a game with null evaluations gracefully", () => {
    const analyses: MoveAnalysisForExport[] = [
      { moveNumber: 1, color: "w", san: "e4", eval: null, bestMove: null, classification: null },
      { moveNumber: 1, color: "b", san: "e5", eval: null, bestMove: null, classification: null },
    ];
    const pgn = buildAnnotatedPgn(SAMPLE_GAME, analyses);
    expect(pgn).toContain("1. e4 e5");
    expect(pgn).not.toContain("[%eval");
  });
});
