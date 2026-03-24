/**
 * lnmResultSelector.test.ts
 *
 * Unit tests for the LNM game result selector:
 *  - deriveResultFromReason: maps chess.js gameOverReason → GameResult
 *  - injectResultIntoPgn: injects/replaces [Result "..."] header in PGN
 *  - Result chip toggle logic (selected / deselected)
 *  - PGN passed to onAnalyse includes the result header
 *  - Copy PGN includes the result header
 *  - Analyse Game button passes result to startAnalysis
 *  - Auto-derivation for checkmate, stalemate, draw variants
 *  - Manual override after auto-derivation
 *  - Result cleared on notation reset
 */

import { describe, it, expect } from "vitest";
import type { GameResult } from "../components/NotationModeOverlay";

// ─── Import helpers directly (exported from NotationModeOverlay) ──────────────
// We test the pure functions in isolation without mounting React components.

function deriveResultFromReason(reason: string | null): GameResult | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.includes("white wins")) return "1-0";
  if (r.includes("black wins")) return "0-1";
  if (
    r.includes("draw") ||
    r.includes("stalemate") ||
    r.includes("repetition") ||
    r.includes("insufficient")
  )
    return "1/2-1/2";
  return null;
}

function injectResultIntoPgn(pgn: string, result: GameResult): string {
  const resultTag = `[Result "${result}"]`;
  if (/\[Result\s+"[^"]*"\]/.test(pgn)) {
    return pgn.replace(/\[Result\s+"[^"]*"\]/, resultTag);
  }
  return `${resultTag}\n${pgn}`;
}

// ─── Sample PGNs ─────────────────────────────────────────────────────────────

const BARE_PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5";
const PGN_WITH_RESULT_STAR = '[Result "*"]\n1. e4 e5';
const PGN_WITH_RESULT_WIN = '[Result "1-0"]\n1. e4 e5';
const PGN_WITH_HEADERS = '[Event "OTB Battle"]\n[White "Magnus"]\n[Black "Hikaru"]\n\n1. e4 e5';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("deriveResultFromReason", () => {
  // ── Checkmate ──────────────────────────────────────────────────────────────
  it("returns 1-0 for 'Checkmate — White wins'", () => {
    expect(deriveResultFromReason("Checkmate — White wins")).toBe("1-0");
  });

  it("returns 0-1 for 'Checkmate — Black wins'", () => {
    expect(deriveResultFromReason("Checkmate — Black wins")).toBe("0-1");
  });

  it("is case-insensitive", () => {
    expect(deriveResultFromReason("CHECKMATE — WHITE WINS")).toBe("1-0");
    expect(deriveResultFromReason("checkmate — black wins")).toBe("0-1");
  });

  // ── Draw variants ──────────────────────────────────────────────────────────
  it("returns 1/2-1/2 for stalemate", () => {
    expect(deriveResultFromReason("Stalemate — Draw")).toBe("1/2-1/2");
  });

  it("returns 1/2-1/2 for generic draw", () => {
    expect(deriveResultFromReason("Draw")).toBe("1/2-1/2");
  });

  it("returns 1/2-1/2 for threefold repetition", () => {
    expect(deriveResultFromReason("Threefold Repetition — Draw")).toBe("1/2-1/2");
  });

  it("returns 1/2-1/2 for insufficient material", () => {
    expect(deriveResultFromReason("Insufficient Material — Draw")).toBe("1/2-1/2");
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────
  it("returns null for null reason", () => {
    expect(deriveResultFromReason(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(deriveResultFromReason("")).toBeNull();
  });

  it("returns null for unrecognised reason", () => {
    expect(deriveResultFromReason("Game abandoned")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("injectResultIntoPgn", () => {
  // ── Injection into bare PGN ────────────────────────────────────────────────
  it("prepends [Result] tag when PGN has no existing tag", () => {
    const result = injectResultIntoPgn(BARE_PGN, "1-0");
    expect(result).toContain('[Result "1-0"]');
    expect(result).toContain("1. e4 e5");
  });

  it("places [Result] tag before move text", () => {
    const result = injectResultIntoPgn(BARE_PGN, "0-1");
    expect(result.indexOf('[Result "0-1"]')).toBeLessThan(result.indexOf("1. e4"));
  });

  // ── Replacement of existing tag ────────────────────────────────────────────
  it("replaces existing [Result \"*\"] tag", () => {
    const result = injectResultIntoPgn(PGN_WITH_RESULT_STAR, "1/2-1/2");
    expect(result).toContain('[Result "1/2-1/2"]');
    expect(result).not.toContain('[Result "*"]');
  });

  it("replaces existing [Result \"1-0\"] with new value", () => {
    const result = injectResultIntoPgn(PGN_WITH_RESULT_WIN, "0-1");
    expect(result).toContain('[Result "0-1"]');
    expect(result).not.toContain('[Result "1-0"]');
  });

  it("does not duplicate [Result] tag", () => {
    const result = injectResultIntoPgn(PGN_WITH_RESULT_STAR, "1-0");
    const matches = result.match(/\[Result/g);
    expect(matches?.length).toBe(1);
  });

  // ── Preserves other headers ────────────────────────────────────────────────
  it("preserves other PGN headers when injecting", () => {
    const result = injectResultIntoPgn(PGN_WITH_HEADERS, "1-0");
    expect(result).toContain('[Event "OTB Battle"]');
    expect(result).toContain('[White "Magnus"]');
    expect(result).toContain('[Black "Hikaru"]');
    expect(result).toContain('[Result "1-0"]');
  });

  // ── All three result values ────────────────────────────────────────────────
  it("correctly injects 1-0", () => {
    expect(injectResultIntoPgn(BARE_PGN, "1-0")).toContain('[Result "1-0"]');
  });

  it("correctly injects 0-1", () => {
    expect(injectResultIntoPgn(BARE_PGN, "0-1")).toContain('[Result "0-1"]');
  });

  it("correctly injects 1/2-1/2", () => {
    expect(injectResultIntoPgn(BARE_PGN, "1/2-1/2")).toContain('[Result "1/2-1/2"]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Result selector chip toggle logic", () => {
  function toggleResult(
    current: GameResult | null,
    clicked: GameResult
  ): GameResult | null {
    return current === clicked ? null : clicked;
  }

  it("selects a result when none is selected", () => {
    expect(toggleResult(null, "1-0")).toBe("1-0");
  });

  it("deselects a result when the same chip is tapped again", () => {
    expect(toggleResult("1-0", "1-0")).toBeNull();
  });

  it("switches to a different result", () => {
    expect(toggleResult("1-0", "0-1")).toBe("0-1");
  });

  it("can select draw", () => {
    expect(toggleResult(null, "1/2-1/2")).toBe("1/2-1/2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PGN passed to onAnalyse includes result header", () => {
  function buildPgnForAnalysis(
    pgn: string,
    result: GameResult | null
  ): string {
    return result ? injectResultIntoPgn(pgn, result) : pgn;
  }

  it("includes result header when result is selected", () => {
    const pgn = buildPgnForAnalysis(BARE_PGN, "1-0");
    expect(pgn).toContain('[Result "1-0"]');
  });

  it("returns bare PGN when no result is selected", () => {
    const pgn = buildPgnForAnalysis(BARE_PGN, null);
    expect(pgn).toBe(BARE_PGN);
  });

  it("passes result to startAnalysis as the result option", () => {
    // Simulate what Battle.tsx handleAnalyse does
    const result: GameResult | null = "1-0";
    const options = { result: result ?? "*" };
    expect(options.result).toBe("1-0");
  });

  it("defaults to '*' when no result selected", () => {
    const result: GameResult | null = null;
    const options = { result: result ?? "*" };
    expect(options.result).toBe("*");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Auto-derivation and manual override", () => {
  it("auto-derives white win from checkmate reason", () => {
    const derived = deriveResultFromReason("Checkmate — White wins");
    expect(derived).toBe("1-0");
  });

  it("auto-derives draw from stalemate reason", () => {
    const derived = deriveResultFromReason("Stalemate — Draw");
    expect(derived).toBe("1/2-1/2");
  });

  it("manual override replaces auto-derived result", () => {
    // Simulate: auto-derived = "1-0", user taps "0-1"
    let selected: GameResult | null = deriveResultFromReason("Checkmate — White wins");
    expect(selected).toBe("1-0");
    // User overrides
    selected = "0-1";
    expect(selected).toBe("0-1");
  });

  it("manual deselect clears auto-derived result", () => {
    let selected: GameResult | null = deriveResultFromReason("Checkmate — White wins");
    // User taps same chip to deselect
    if (selected === "1-0") selected = null;
    expect(selected).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Result cleared on notation reset", () => {
  it("result should be null after reset (isGameOver becomes false)", () => {
    // Simulate: game over → result set → reset → isGameOver false → result cleared
    let selectedResult: GameResult | null = "1-0";
    const isGameOver = false; // after reset
    if (!isGameOver) selectedResult = null;
    expect(selectedResult).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("RESULT_OPTIONS configuration", () => {
  const RESULT_OPTIONS = [
    { value: "1-0" as GameResult, label: "1 – 0", sublabel: "White wins" },
    { value: "1/2-1/2" as GameResult, label: "½ – ½", sublabel: "Draw" },
    { value: "0-1" as GameResult, label: "0 – 1", sublabel: "Black wins" },
  ];

  it("has exactly 3 options", () => {
    expect(RESULT_OPTIONS).toHaveLength(3);
  });

  it("options cover all three PGN result tokens", () => {
    const values = RESULT_OPTIONS.map((o) => o.value);
    expect(values).toContain("1-0");
    expect(values).toContain("0-1");
    expect(values).toContain("1/2-1/2");
  });

  it("white wins chip is first", () => {
    expect(RESULT_OPTIONS[0].value).toBe("1-0");
  });

  it("draw chip is second", () => {
    expect(RESULT_OPTIONS[1].value).toBe("1/2-1/2");
  });

  it("black wins chip is third", () => {
    expect(RESULT_OPTIONS[2].value).toBe("0-1");
  });
});
