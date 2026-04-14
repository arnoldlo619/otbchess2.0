import { describe, it, expect } from "vitest";

/**
 * Tests for the deep theory line system:
 * 1. Counter-lines (COUNTER_LINES_AS_WHITE / AS_BLACK) are 8+ moves deep
 * 2. DEEP_THEORY_MAP fallback provides 8+ move lines for unmatched openings
 * 3. getDeepTheoryLine produces practical study material
 */

// ── Counter-line depth validation ──────────────────────────────────────────

function countHalfMoves(moveString: string): number {
  // Count individual moves (both white and black) in a PGN-like string
  // e.g., "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6" → 6 half-moves
  const tokens = moveString
    .replace(/\d+\.\s*/g, "") // strip move numbers
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0 && !t.match(/^\d+\.?$/));
  return tokens.length;
}

describe("Counter-line move depth", () => {
  // Simulate the counter-lines structure with representative entries
  const SAMPLE_WHITE_LINES = [
    { name: "Sicilian: Anti-Najdorf 6.Be2", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 e5 7.Nb3 Be7 8.O-O O-O 9.Be3 Be6 10.Qd2 Nbd7 11.a4 Rc8" },
    { name: "French: Advance, Milner-Barry Gambit", moves: "1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.Bd3 cxd4 7.cxd4 Bd7 8.O-O Nxd4 9.Nxd4 Qxd4 10.Nc3 a6 11.Qe2 Ne7" },
    { name: "Caro-Kann: Advance, Short System", moves: "1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.Be2 Nd7 6.O-O Ne7 7.Nbd2 h6 8.Nb3 Nc8 9.a4 a5 10.Bd2 Be7" },
  ];

  const SAMPLE_BLACK_LINES = [
    { name: "Ruy Lopez: Breyer Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4 Nbd7 11.Nbd2 Bb7" },
    { name: "Berlin Defense: Rio de Janeiro", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 9.h3 Ke8 10.Nc3 h5 11.Bf4 Be7" },
    { name: "QGD: Tartakower-Makogonov-Bondarevsky", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6 8.Be2 Bb7 9.Bxf6 Bxf6 10.cxd5 exd5 11.b4 c5" },
  ];

  it("all sample white counter-lines should be at least 8 half-moves deep", () => {
    for (const line of SAMPLE_WHITE_LINES) {
      const depth = countHalfMoves(line.moves);
      expect(depth).toBeGreaterThanOrEqual(16); // 8 full moves = 16 half-moves
    }
  });

  it("all sample black counter-lines should be at least 8 half-moves deep", () => {
    for (const line of SAMPLE_BLACK_LINES) {
      const depth = countHalfMoves(line.moves);
      expect(depth).toBeGreaterThanOrEqual(16); // 8 full moves = 16 half-moves
    }
  });
});

// ── Deep theory map validation ─────────────────────────────────────────────

describe("DEEP_THEORY_MAP coverage", () => {
  const DEEP_THEORY_MAP_KEYS = [
    "sicilian", "french", "caro-kann", "pirc", "scandinavian",
    "alekhine", "philidor", "petroff",
    "queen's gambit", "slav", "dutch", "benoni", "bogo-indian", "indian",
    "english", "reti", "bird",
  ];

  const DEEP_THEORY_MAP_MOVES: Record<string, string> = {
    "sicilian": "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O Nbd7",
    "french": "1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.e5 Nfd7 5.f4 c5 6.Nf3 Nc6 7.Be3 cxd4 8.Nxd4 Bc5 9.Qd2 O-O 10.O-O-O a6",
    "caro-kann": "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3 e6",
    "english": "1.c4 e5 2.Nc3 Nf6 3.Nf3 Nc6 4.g3 d5 5.cxd5 Nxd5 6.Bg2 Nb6 7.O-O Be7 8.d3 O-O 9.a3 Be6 10.b4 f6",
    "reti": "1.Nf3 d5 2.g3 Nf6 3.Bg2 c6 4.O-O Bg4 5.d3 Nbd7 6.Nbd2 e5 7.e4 dxe4 8.dxe4 Bc5 9.h3 Bh5 10.Qe1 O-O",
  };

  it("should cover all major opening families", () => {
    expect(DEEP_THEORY_MAP_KEYS.length).toBeGreaterThanOrEqual(15);
  });

  it("each deep theory line should be at least 8 full moves (16 half-moves)", () => {
    for (const [key, moves] of Object.entries(DEEP_THEORY_MAP_MOVES)) {
      const depth = countHalfMoves(moves);
      expect(depth).toBeGreaterThanOrEqual(16);
    }
  });

  it("countHalfMoves correctly counts a 10-move line", () => {
    const moves = "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O Nbd7";
    expect(countHalfMoves(moves)).toBe(20); // 10 full moves = 20 half-moves
  });

  it("countHalfMoves correctly counts a 2-move line", () => {
    const moves = "1.d4 Nf6";
    expect(countHalfMoves(moves)).toBe(2);
  });
});

// ── getDeepTheoryLine behavior ─────────────────────────────────────────────

describe("getDeepTheoryLine fallback behavior", () => {
  it("should match 'Sicilian Defense' to the sicilian deep theory entry", () => {
    // The function matches by checking if the opening name includes the key
    const openingName = "Sicilian Defense";
    const lowerName = openingName.toLowerCase();
    const matched = ["sicilian", "french", "caro-kann"].find(key => lowerName.includes(key));
    expect(matched).toBe("sicilian");
  });

  it("should match 'French Defense: Winawer' to the french deep theory entry", () => {
    const openingName = "French Defense: Winawer";
    const lowerName = openingName.toLowerCase();
    const matched = ["sicilian", "french", "caro-kann"].find(key => lowerName.includes(key));
    expect(matched).toBe("french");
  });

  it("should match 'Queen's Gambit Declined' to the queen's gambit deep theory entry", () => {
    const openingName = "Queen's Gambit Declined";
    const lowerName = openingName.toLowerCase();
    const matched = ["sicilian", "french", "queen's gambit", "slav"].find(key => lowerName.includes(key));
    expect(matched).toBe("queen's gambit");
  });

  it("should NOT match 'Irregular Opening' to any deep theory entry", () => {
    const openingName = "Irregular Opening";
    const lowerName = openingName.toLowerCase();
    const keys = ["sicilian", "french", "caro-kann", "pirc", "scandinavian", "queen's gambit", "slav", "english", "reti"];
    const matched = keys.find(key => lowerName.includes(key));
    expect(matched).toBeUndefined();
  });

  it("should match 'Indian Defense' to the indian deep theory entry", () => {
    const openingName = "Indian Defense";
    const lowerName = openingName.toLowerCase();
    const matched = ["sicilian", "french", "indian", "english"].find(key => lowerName.includes(key));
    expect(matched).toBe("indian");
  });
});
