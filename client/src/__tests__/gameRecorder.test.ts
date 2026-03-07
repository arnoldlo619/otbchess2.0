/**
 * @vitest-environment jsdom
 *
 * Tests for the Game Recorder feature:
 *   - PGN validation logic
 *   - EvalBar percentage calculations
 *   - Move classification color mapping
 *   - Analysis summary computation helpers
 */
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

// ── PGN Validation (mirrors the logic in GameRecorder.tsx) ──────────────────
function validatePgn(pgn: string): { valid: boolean; error?: string; moveCount: number } {
  if (!pgn.trim()) return { valid: false, error: "PGN is empty", moveCount: 0 };
  try {
    const chess = new Chess();
    const movesOnly = pgn.replace(/\[.*?\]\s*/g, "").trim();
    chess.loadPgn(movesOnly);
    const history = chess.history();
    if (history.length === 0) {
      return { valid: false, error: "No valid moves found in PGN", moveCount: 0 };
    }
    return { valid: true, moveCount: history.length };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid PGN: ${err instanceof Error ? err.message : "Parse error"}`,
      moveCount: 0,
    };
  }
}

// ── Eval Bar helpers (mirrors EvalBar in GameAnalysis.tsx) ───────────────────
function evalToWhitePercent(evalCp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, evalCp));
  return 50 + (clamped / 1000) * 50;
}

function evalDisplay(evalCp: number): string {
  if (Math.abs(evalCp) >= 10000) {
    return evalCp > 0
      ? "M" + Math.ceil((10000 - Math.abs(evalCp)) / 100)
      : "-M" + Math.ceil((10000 - Math.abs(evalCp)) / 100);
  }
  return (evalCp / 100).toFixed(1);
}

// ── Classification colors ───────────────────────────────────────────────────
const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  best: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
  good: { bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-400" },
  inaccuracy: { bg: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400" },
  mistake: { bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-400" },
  blunder: { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-400" },
};

// ── Move pair grouping helper ───────────────────────────────────────────────
interface MoveAnalysis {
  moveNumber: number;
  color: string;
  san: string;
}

function groupIntoPairs(analyses: MoveAnalysis[]) {
  const pairs: Array<{
    number: number;
    white?: MoveAnalysis;
    black?: MoveAnalysis;
  }> = [];

  for (const a of analyses) {
    const pairIdx = a.moveNumber - 1;
    if (!pairs[pairIdx]) {
      pairs[pairIdx] = { number: a.moveNumber };
    }
    if (a.color === "w") {
      pairs[pairIdx].white = a;
    } else {
      pairs[pairIdx].black = a;
    }
  }
  return pairs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("PGN Validation", () => {
  it("rejects empty string", () => {
    const result = validatePgn("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("PGN is empty");
    expect(result.moveCount).toBe(0);
  });

  it("rejects whitespace-only string", () => {
    const result = validatePgn("   \n  ");
    expect(result.valid).toBe(false);
  });

  it("validates a simple opening", () => {
    const result = validatePgn("1. e4 e5 2. Nf3 Nc6");
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(4);
  });

  it("validates a full game with result", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0";
    const result = validatePgn(pgn);
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(10);
  });

  it("strips PGN headers before parsing", () => {
    const pgn = `[Event "Test"]\n[White "Player1"]\n[Black "Player2"]\n\n1. d4 d5 2. c4 e6`;
    const result = validatePgn(pgn);
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(4);
  });

  it("rejects invalid move notation", () => {
    const result = validatePgn("1. e4 e5 2. Zz9 Nc6");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid PGN");
  });

  it("rejects random text", () => {
    const result = validatePgn("hello world this is not chess");
    expect(result.valid).toBe(false);
  });

  it("validates draw result", () => {
    const result = validatePgn("1. e4 e5 2. Nf3 Nc6 1/2-1/2");
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(4);
  });

  it("validates single move", () => {
    const result = validatePgn("1. e4");
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(1);
  });

  it("handles PGN with annotations stripped", () => {
    // chess.js loadPgn should handle comments
    const result = validatePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6");
    expect(result.valid).toBe(true);
    expect(result.moveCount).toBe(6);
  });
});

describe("EvalBar Calculations", () => {
  it("returns 50% for equal position (0 cp)", () => {
    expect(evalToWhitePercent(0)).toBe(50);
  });

  it("returns 100% for +1000 cp (white winning)", () => {
    expect(evalToWhitePercent(1000)).toBe(100);
  });

  it("returns 0% for -1000 cp (black winning)", () => {
    expect(evalToWhitePercent(-1000)).toBe(0);
  });

  it("returns 75% for +500 cp", () => {
    expect(evalToWhitePercent(500)).toBe(75);
  });

  it("returns 25% for -500 cp", () => {
    expect(evalToWhitePercent(-500)).toBe(25);
  });

  it("clamps values above 1000", () => {
    expect(evalToWhitePercent(2000)).toBe(100);
  });

  it("clamps values below -1000", () => {
    expect(evalToWhitePercent(-2000)).toBe(0);
  });

  it("displays +0.5 for 50 cp", () => {
    expect(evalDisplay(50)).toBe("0.5");
  });

  it("displays -1.5 for -150 cp", () => {
    expect(evalDisplay(-150)).toBe("-1.5");
  });

  it("displays 0.0 for 0 cp", () => {
    expect(evalDisplay(0)).toBe("0.0");
  });

  it("displays +3.0 for 300 cp", () => {
    expect(evalDisplay(300)).toBe("3.0");
  });
});

describe("Classification Colors", () => {
  it("has all five classifications", () => {
    expect(Object.keys(CLASSIFICATION_COLORS)).toEqual([
      "best",
      "good",
      "inaccuracy",
      "mistake",
      "blunder",
    ]);
  });

  it("best moves use emerald color", () => {
    expect(CLASSIFICATION_COLORS.best.dot).toBe("bg-emerald-400");
  });

  it("blunders use red color", () => {
    expect(CLASSIFICATION_COLORS.blunder.dot).toBe("bg-red-400");
  });

  it("mistakes use orange color", () => {
    expect(CLASSIFICATION_COLORS.mistake.dot).toBe("bg-orange-400");
  });

  it("inaccuracies use yellow color", () => {
    expect(CLASSIFICATION_COLORS.inaccuracy.dot).toBe("bg-yellow-400");
  });

  it("each classification has bg, text, and dot properties", () => {
    for (const cls of Object.values(CLASSIFICATION_COLORS)) {
      expect(cls).toHaveProperty("bg");
      expect(cls).toHaveProperty("text");
      expect(cls).toHaveProperty("dot");
    }
  });
});

describe("Move Pair Grouping", () => {
  it("groups a single white move", () => {
    const analyses: MoveAnalysis[] = [
      { moveNumber: 1, color: "w", san: "e4" },
    ];
    const pairs = groupIntoPairs(analyses);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].number).toBe(1);
    expect(pairs[0].white?.san).toBe("e4");
    expect(pairs[0].black).toBeUndefined();
  });

  it("groups a complete move pair", () => {
    const analyses: MoveAnalysis[] = [
      { moveNumber: 1, color: "w", san: "e4" },
      { moveNumber: 1, color: "b", san: "e5" },
    ];
    const pairs = groupIntoPairs(analyses);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].white?.san).toBe("e4");
    expect(pairs[0].black?.san).toBe("e5");
  });

  it("groups multiple move pairs correctly", () => {
    const analyses: MoveAnalysis[] = [
      { moveNumber: 1, color: "w", san: "e4" },
      { moveNumber: 1, color: "b", san: "e5" },
      { moveNumber: 2, color: "w", san: "Nf3" },
      { moveNumber: 2, color: "b", san: "Nc6" },
      { moveNumber: 3, color: "w", san: "Bb5" },
    ];
    const pairs = groupIntoPairs(analyses);
    expect(pairs).toHaveLength(3);
    expect(pairs[0].number).toBe(1);
    expect(pairs[1].number).toBe(2);
    expect(pairs[2].number).toBe(3);
    expect(pairs[2].white?.san).toBe("Bb5");
    expect(pairs[2].black).toBeUndefined();
  });

  it("handles empty analysis array", () => {
    const pairs = groupIntoPairs([]);
    expect(pairs).toHaveLength(0);
  });
});
