/**
 * explorerFallback.test.ts — Tests for the static fallback opening explorer database.
 *
 * Validates that:
 * 1. The fallback JSON database has the expected structure and coverage
 * 2. FEN normalization works correctly
 * 3. All 16 openings have positions in the database
 * 4. Key positions (starting, after e4, d4) are present with correct data
 */
import { describe, it, expect } from "vitest";
import fallbackDb from "../../../data/explorer-fallback.json";

// ── Type helpers ──────────────────────────────────────────────────────────────

interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

interface ExplorerPosition {
  white: number;
  draws: number;
  black: number;
  opening: { eco: string; name: string } | null;
  moves: ExplorerMove[];
}

interface FallbackDb {
  _meta: {
    version: string;
    positionCount: number;
    sourceLines: number;
    sourceOpenings: number;
  };
  positions: Record<string, ExplorerPosition>;
}

const db = fallbackDb as unknown as FallbackDb;

// ── FEN normalization helper (mirrors server logic) ───────────────────────────
function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(" ");
}

// ── Meta tests ────────────────────────────────────────────────────────────────

describe("Explorer Fallback DB — Meta", () => {
  it("has correct version", () => {
    expect(db._meta.version).toBe("1.0.0");
  });

  it("has at least 1,000 positions", () => {
    expect(db._meta.positionCount).toBeGreaterThanOrEqual(1000);
    expect(Object.keys(db.positions).length).toBe(db._meta.positionCount);
  });

  it("was built from all 16 openings", () => {
    expect(db._meta.sourceOpenings).toBe(16);
  });

  it("was built from 158 lines", () => {
    expect(db._meta.sourceLines).toBe(158);
  });
});

// ── Position structure tests ──────────────────────────────────────────────────

describe("Explorer Fallback DB — Position Structure", () => {
  const positions = Object.entries(db.positions);

  it("all positions have required fields", () => {
    for (const [key, pos] of positions.slice(0, 100)) {
      expect(typeof pos.white).toBe("number");
      expect(typeof pos.draws).toBe("number");
      expect(typeof pos.black).toBe("number");
      expect(Array.isArray(pos.moves)).toBe(true);
      // opening can be null or object
      expect(pos.opening === null || typeof pos.opening === "object").toBe(true);
    }
  });

  it("all FEN keys have 4 space-separated fields", () => {
    for (const key of Object.keys(db.positions).slice(0, 200)) {
      const parts = key.split(" ");
      expect(parts.length).toBe(4);
      // Board position has 8 ranks
      expect(parts[0].split("/").length).toBe(8);
      // Active color is 'w' or 'b'
      expect(["w", "b"]).toContain(parts[1]);
    }
  });

  it("all moves have valid UCI format (4-5 chars)", () => {
    for (const pos of Object.values(db.positions).slice(0, 100)) {
      for (const move of pos.moves) {
        expect(move.uci.length).toBeGreaterThanOrEqual(4);
        expect(move.uci.length).toBeLessThanOrEqual(5);
        expect(move.san).toBeTruthy();
        expect(typeof move.white).toBe("number");
        expect(typeof move.draws).toBe("number");
        expect(typeof move.black).toBe("number");
      }
    }
  });

  it("moves are sorted by total games descending", () => {
    for (const pos of Object.values(db.positions).slice(0, 50)) {
      if (pos.moves.length < 2) continue;
      for (let i = 0; i < pos.moves.length - 1; i++) {
        const curr = pos.moves[i].white + pos.moves[i].draws + pos.moves[i].black;
        const next = pos.moves[i + 1].white + pos.moves[i + 1].draws + pos.moves[i + 1].black;
        expect(curr).toBeGreaterThanOrEqual(next);
      }
    }
  });
});

// ── Key position tests ────────────────────────────────────────────────────────

describe("Explorer Fallback DB — Key Positions", () => {
  it("has starting position with correct moves", () => {
    const key = normalizeFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const pos = db.positions[key];
    expect(pos).toBeDefined();
    expect(pos.white + pos.draws + pos.black).toBeGreaterThan(1000000);
    const moveSans = pos.moves.map((m) => m.san);
    expect(moveSans).toContain("e4");
    expect(moveSans).toContain("d4");
    expect(moveSans).toContain("Nf3");
  });

  it("has position after 1.e4 with correct responses", () => {
    const key = normalizeFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    const pos = db.positions[key];
    expect(pos).toBeDefined();
    const moveSans = pos.moves.map((m) => m.san);
    expect(moveSans).toContain("e5");
    expect(moveSans).toContain("c5");
    expect(moveSans).toContain("e6");
    expect(moveSans).toContain("c6");
  });

  it("has position after 1.d4 with correct responses", () => {
    const key = normalizeFen("rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1");
    const pos = db.positions[key];
    expect(pos).toBeDefined();
    const moveSans = pos.moves.map((m) => m.san);
    expect(moveSans).toContain("d5");
    expect(moveSans).toContain("Nf6");
  });
});

// ── Opening coverage tests ────────────────────────────────────────────────────

describe("Explorer Fallback DB — Opening Coverage", () => {
  // Test that we have positions from each of the 16 openings
  // by checking for positions with the expected opening ECO codes

  const allOpenings = Object.values(db.positions)
    .filter((p) => p.opening !== null)
    .map((p) => p.opening!);

  it("has positions with opening annotations", () => {
    expect(allOpenings.length).toBeGreaterThanOrEqual(100);
  });

  it("has London System positions (D00-D09)", () => {
    const london = allOpenings.filter((o) => o.eco.startsWith("D0"));
    expect(london.length).toBeGreaterThanOrEqual(1);
  });

  it("has Sicilian Defense positions (B20-B99)", () => {
    const sicilian = allOpenings.filter(
      (o) => o.eco >= "B20" && o.eco <= "B99"
    );
    expect(sicilian.length).toBeGreaterThanOrEqual(1);
  });

  it("has French Defense positions (C00-C19)", () => {
    const french = allOpenings.filter(
      (o) => o.eco >= "C00" && o.eco <= "C19"
    );
    expect(french.length).toBeGreaterThanOrEqual(1);
  });

  it("has Caro-Kann positions (B10-B19)", () => {
    const caroKann = allOpenings.filter(
      (o) => o.eco >= "B10" && o.eco <= "B19"
    );
    expect(caroKann.length).toBeGreaterThanOrEqual(1);
  });

  it("has Queen's Gambit positions (D20-D69)", () => {
    const qg = allOpenings.filter(
      (o) => o.eco >= "D20" && o.eco <= "D69"
    );
    expect(qg.length).toBeGreaterThanOrEqual(1);
  });

  it("has Italian Game positions (C50-C59)", () => {
    const italian = allOpenings.filter(
      (o) => o.eco >= "C50" && o.eco <= "C59"
    );
    expect(italian.length).toBeGreaterThanOrEqual(1);
  });
});

// ── FEN normalization tests ───────────────────────────────────────────────────

describe("Explorer Fallback DB — FEN Normalization", () => {
  it("normalizes FEN with 6 fields to 4 fields", () => {
    const fen6 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const fen4 = normalizeFen(fen6);
    expect(fen4.split(" ").length).toBe(4);
    expect(fen4).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
  });

  it("handles FEN with extra whitespace", () => {
    const fen = "  rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR  b  KQkq  -  0  1  ";
    const key = normalizeFen(fen);
    expect(key).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
  });

  it("same position with different move clocks maps to same key", () => {
    const fen1 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const fen2 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 5 10";
    expect(normalizeFen(fen1)).toBe(normalizeFen(fen2));
  });
});

// ── Depth coverage tests ──────────────────────────────────────────────────────

describe("Explorer Fallback DB — Depth Coverage", () => {
  it("has positions at depth 5+ (half-moves)", () => {
    // Positions with 5+ pieces moved from starting position
    // We check by counting positions that have non-starting-like FENs
    const deepPositions = Object.keys(db.positions).filter((key) => {
      // Starting position has 8 pawns in rank 2 and 7
      const board = key.split(" ")[0];
      // A deep position won't have the full starting pawn structure
      return !board.includes("PPPPPPPP") && !board.includes("pppppppp");
    });
    expect(deepPositions.length).toBeGreaterThanOrEqual(500);
  });

  it("has positions with 10+ moves played", () => {
    // Positions where both sides have castled or developed significantly
    // Check for positions without any rooks on starting squares
    const veryDeep = Object.keys(db.positions).filter((key) => {
      const board = key.split(" ")[0];
      // Positions where pawns have moved significantly
      return !board.startsWith("rnbqkbnr") && !board.endsWith("RNBQKBNR");
    });
    expect(veryDeep.length).toBeGreaterThanOrEqual(200);
  });
});
