/**
 * Tests for Game Highlight Generator
 *
 * Covers:
 *   - Critical moment detection (biggest eval swing)
 *   - Edge cases: empty analyses, single move, all equal evals
 *   - Classification config completeness
 *   - Share text generation
 */
import { describe, it, expect } from "vitest";

// ── Replicate the critical moment logic from GameAnalysis ─────────────────────
interface MoveAnalysis {
  id: string;
  gameId: string;
  moveNumber: number;
  color: string;
  san: string;
  fen: string;
  eval: number | null;
  bestMove: string | null;
  classification: string | null;
  winChance: number | null;
  continuation: string | null;
}

function findCriticalMoment(analyses: MoveAnalysis[]) {
  if (analyses.length === 0) return null;
  let maxSwing = 0;
  let best: MoveAnalysis | null = null;
  for (let i = 1; i < analyses.length; i++) {
    const prev = analyses[i - 1];
    const curr = analyses[i];
    if (prev.eval === null || curr.eval === null) continue;
    const swing = Math.abs(curr.eval - prev.eval);
    if (swing > maxSwing) {
      maxSwing = swing;
      best = curr;
    }
  }
  return best ? { analysis: best, swing: maxSwing } : null;
}

function makeMove(
  moveNumber: number,
  color: string,
  san: string,
  evalCp: number | null,
  classification: string | null = "good"
): MoveAnalysis {
  return {
    id: `m${moveNumber}${color}`,
    gameId: "game1",
    moveNumber,
    color,
    san,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    eval: evalCp,
    bestMove: null,
    classification,
    winChance: null,
    continuation: null,
  };
}

// ── Classification config (mirrors GameHighlightCard) ─────────────────────────
const CLASSIFICATION_CONFIG: Record<
  string,
  { label: string; emoji: string; bg: string; text: string; border: string }
> = {
  blunder: {
    label: "Blunder",
    emoji: "??",
    bg: "#7f1d1d",
    text: "#fca5a5",
    border: "#ef4444",
  },
  mistake: {
    label: "Mistake",
    emoji: "?",
    bg: "#7c2d12",
    text: "#fdba74",
    border: "#f97316",
  },
  inaccuracy: {
    label: "Inaccuracy",
    emoji: "?!",
    bg: "#713f12",
    text: "#fde68a",
    border: "#eab308",
  },
  best: {
    label: "Best Move",
    emoji: "!!",
    bg: "#052e16",
    text: "#6ee7b7",
    border: "#10b981",
  },
  good: {
    label: "Good Move",
    emoji: "!",
    bg: "#14532d",
    text: "#86efac",
    border: "#22c55e",
  },
};

// ── Share text generation (mirrors GameAnalysis handleShareHighlight) ─────────
function buildShareText(
  white: string,
  black: string,
  classification: string,
  moveNumber: number,
  color: string,
  san: string
): string {
  const mv = `${moveNumber}${color === "w" ? "." : "..."} ${san}`;
  return `${white} vs ${black} — ${classification} on ${mv} #ChessOTB #ChessOTBclub`;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("findCriticalMoment", () => {
  it("returns null for empty analyses", () => {
    expect(findCriticalMoment([])).toBeNull();
  });

  it("returns null for single move", () => {
    const analyses = [makeMove(1, "w", "e4", 20)];
    expect(findCriticalMoment(analyses)).toBeNull();
  });

  it("returns null when all evals are null", () => {
    const analyses = [
      makeMove(1, "w", "e4", null),
      makeMove(1, "b", "e5", null),
      makeMove(2, "w", "Nf3", null),
    ];
    expect(findCriticalMoment(analyses)).toBeNull();
  });

  it("skips pairs where either eval is null", () => {
    const analyses = [
      makeMove(1, "w", "e4", null),
      makeMove(1, "b", "e5", 50),
      makeMove(2, "w", "Nf3", 100),
    ];
    // Only pair (e5, Nf3) is valid: swing = 50
    const result = findCriticalMoment(analyses);
    expect(result).not.toBeNull();
    expect(result!.swing).toBe(50);
    expect(result!.analysis.san).toBe("Nf3");
  });

  it("finds the move with the largest eval swing", () => {
    const analyses = [
      makeMove(1, "w", "e4", 0),
      makeMove(1, "b", "e5", 10),   // swing 10
      makeMove(2, "w", "Nf3", 50),  // swing 40
      makeMove(2, "b", "Nc6", -200), // swing 250 ← biggest
      makeMove(3, "w", "Bb5", -180), // swing 20
    ];
    const result = findCriticalMoment(analyses);
    expect(result).not.toBeNull();
    expect(result!.swing).toBe(250);
    expect(result!.analysis.san).toBe("Nc6");
  });

  it("handles a blunder that swings from +50 to -300", () => {
    const analyses = [
      makeMove(10, "w", "Qd3", 50),
      makeMove(10, "b", "Rxf2", -300, "blunder"),
    ];
    const result = findCriticalMoment(analyses);
    expect(result!.swing).toBe(350);
    expect(result!.analysis.classification).toBe("blunder");
  });

  it("handles equal evaluations (swing = 0)", () => {
    const analyses = [
      makeMove(1, "w", "e4", 0),
      makeMove(1, "b", "e5", 0),
      makeMove(2, "w", "Nf3", 0),
    ];
    // All swings are 0, maxSwing stays 0, best stays null
    const result = findCriticalMoment(analyses);
    expect(result).toBeNull();
  });

  it("returns the first maximum when two swings are equal", () => {
    const analyses = [
      makeMove(1, "w", "e4", 0),
      makeMove(1, "b", "e5", 100),  // swing 100
      makeMove(2, "w", "Nf3", 0),   // swing 100 (equal)
    ];
    // First maximum wins (e5)
    const result = findCriticalMoment(analyses);
    expect(result!.analysis.san).toBe("e5");
    expect(result!.swing).toBe(100);
  });

  it("handles a single-move swing correctly", () => {
    const analyses = [
      makeMove(1, "w", "e4", -500),
      makeMove(1, "b", "Qh4", 500, "best"),
    ];
    const result = findCriticalMoment(analyses);
    expect(result!.swing).toBe(1000);
    expect(result!.analysis.san).toBe("Qh4");
  });

  it("handles large positive-to-positive swings", () => {
    const analyses = [
      makeMove(5, "w", "Rxe6", 800),
      makeMove(5, "b", "Kd7", 200, "mistake"),
      makeMove(6, "w", "Qd5", 900),
    ];
    const result = findCriticalMoment(analyses);
    expect(result!.swing).toBe(700);
    expect(result!.analysis.san).toBe("Qd5");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CLASSIFICATION_CONFIG", () => {
  it("has entries for all five classification types", () => {
    const required = ["blunder", "mistake", "inaccuracy", "best", "good"];
    for (const cls of required) {
      expect(CLASSIFICATION_CONFIG[cls]).toBeDefined();
    }
  });

  it("each entry has label, emoji, bg, text, and border", () => {
    for (const [, config] of Object.entries(CLASSIFICATION_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.emoji).toBeTruthy();
      expect(config.bg).toMatch(/^#/);
      expect(config.text).toMatch(/^#/);
      expect(config.border).toMatch(/^#/);
    }
  });

  it("blunder has ?? emoji", () => {
    expect(CLASSIFICATION_CONFIG.blunder.emoji).toBe("??");
  });

  it("best has !! emoji", () => {
    expect(CLASSIFICATION_CONFIG.best.emoji).toBe("!!");
  });

  it("mistake has ? emoji", () => {
    expect(CLASSIFICATION_CONFIG.mistake.emoji).toBe("?");
  });

  it("inaccuracy has ?! emoji", () => {
    expect(CLASSIFICATION_CONFIG.inaccuracy.emoji).toBe("?!");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("buildShareText", () => {
  it("formats white move correctly", () => {
    const text = buildShareText("Alice", "Bob", "blunder", 23, "w", "Qxf7");
    expect(text).toBe("Alice vs Bob — blunder on 23. Qxf7 #ChessOTB #ChessOTBclub");
  });

  it("formats black move with ellipsis", () => {
    const text = buildShareText("Alice", "Bob", "best", 15, "b", "Rxe4");
    expect(text).toBe("Alice vs Bob — best on 15... Rxe4 #ChessOTB #ChessOTBclub");
  });

  it("includes both hashtags", () => {
    const text = buildShareText("X", "Y", "mistake", 1, "w", "e4");
    expect(text).toContain("#ChessOTB");
    expect(text).toContain("#ChessOTBclub");
  });

  it("handles player names with spaces", () => {
    const text = buildShareText("Magnus Carlsen", "Fabiano Caruana", "inaccuracy", 30, "b", "Nd4");
    expect(text).toContain("Magnus Carlsen vs Fabiano Caruana");
  });

  it("uses em dash separator", () => {
    const text = buildShareText("A", "B", "good", 5, "w", "Nf3");
    expect(text).toContain("—");
  });
});
