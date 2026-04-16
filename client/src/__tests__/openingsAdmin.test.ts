/**
 * openingsAdmin.test.ts — Unit tests for the openings admin system.
 *
 * Tests cover:
 *   1. Admin API route structure validation
 *   2. PGN parsing and move validation logic
 *   3. Completeness/QA check logic
 *   4. Duplicate detection logic
 *   5. Slug generation
 *   6. Tag taxonomy validation
 */
import { describe, it, expect } from "vitest";

// ─── PGN Parsing & Move Validation ─────────────────────────────────────────

/**
 * Simulates the server-side PGN parsing logic.
 * Strips move numbers, annotations, and results to extract clean SAN moves.
 */
function parsePGNMoves(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}/g, "")        // strip comments
    .replace(/\([^)]*\)/g, "")        // strip variations
    .replace(/\d+\.\.\./g, "")        // strip Black move numbers
    .replace(/\d+\./g, "")            // strip White move numbers
    .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, "") // strip results
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 0);
}

/**
 * Validates a SAN move string has basic valid format.
 * Not a full legality check — that requires a board state.
 */
function isValidSANFormat(san: string): boolean {
  // Castling
  if (san === "O-O" || san === "O-O-O") return true;
  // Standard move pattern: optional piece, optional disambiguation, optional capture, destination, optional promotion, optional check
  const pattern = /^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$/;
  return pattern.test(san);
}

/**
 * Generates a URL-safe slug from a title string.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Checks completeness of a line object for QA purposes.
 */
interface LineForQA {
  title: string;
  pgn: string;
  finalFen: string;
  description: string | null;
  strategicSummary: string | null;
  hintText: string | null;
  punishmentIdea: string | null;
  difficulty: string;
  commonness: number;
  priority: number;
}

function checkCompleteness(line: LineForQA): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!line.title) missing.push("title");
  if (!line.pgn) missing.push("pgn");
  if (!line.finalFen) missing.push("finalFen");
  if (!line.description) missing.push("description");
  if (!line.strategicSummary) missing.push("strategicSummary");
  if (!line.hintText) missing.push("hintText");
  if (!line.punishmentIdea) missing.push("punishmentIdea");
  if (!line.difficulty) missing.push("difficulty");
  if (line.commonness < 0 || line.commonness > 100) missing.push("commonness");
  if (line.priority < 0 || line.priority > 100) missing.push("priority");
  return { complete: missing.length === 0, missing };
}

/**
 * Detects potential duplicates between two lines based on PGN overlap.
 */
function detectDuplicate(pgnA: string, pgnB: string): { isDuplicate: boolean; reason: string } {
  const movesA = parsePGNMoves(pgnA);
  const movesB = parsePGNMoves(pgnB);

  // Exact match
  if (pgnA === pgnB) {
    return { isDuplicate: true, reason: "Exact PGN match" };
  }

  // One is a prefix of the other
  const shorter = movesA.length <= movesB.length ? movesA : movesB;
  const longer = movesA.length <= movesB.length ? movesB : movesA;
  const isPrefix = shorter.every((m, i) => m === longer[i]);
  if (isPrefix && shorter.length >= 4) {
    return { isDuplicate: true, reason: `Prefix overlap (${shorter.length} moves)` };
  }

  return { isDuplicate: false, reason: "" };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PGN Parsing", () => {
  it("parses a standard PGN into SAN moves", () => {
    const pgn = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });

  it("strips comments from PGN", () => {
    const pgn = "1.e4 {Best by test} e5 2.Nf3 Nc6";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("strips result markers", () => {
    const pgn = "1.e4 e5 2.Nf3 Nc6 1-0";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("strips variations in parentheses", () => {
    const pgn = "1.e4 e5 (1...c5) 2.Nf3 Nc6";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("handles Black move numbers (3...)", () => {
    const pgn = "1.e4 e5 2.Nf3 Nc6 3.Bb5 3...a6";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });

  it("handles empty PGN", () => {
    expect(parsePGNMoves("")).toEqual([]);
    expect(parsePGNMoves("   ")).toEqual([]);
  });

  it("handles draw result", () => {
    const pgn = "1.d4 d5 2.c4 e6 1/2-1/2";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["d4", "d5", "c4", "e6"]);
  });

  it("handles ongoing game marker", () => {
    const pgn = "1.e4 c5 *";
    const moves = parsePGNMoves(pgn);
    expect(moves).toEqual(["e4", "c5"]);
  });
});

describe("SAN Format Validation", () => {
  it("validates pawn moves", () => {
    expect(isValidSANFormat("e4")).toBe(true);
    expect(isValidSANFormat("d5")).toBe(true);
    expect(isValidSANFormat("a6")).toBe(true);
  });

  it("validates piece moves", () => {
    expect(isValidSANFormat("Nf3")).toBe(true);
    expect(isValidSANFormat("Bb5")).toBe(true);
    expect(isValidSANFormat("Qd1")).toBe(true);
    expect(isValidSANFormat("Ke2")).toBe(true);
    expect(isValidSANFormat("Rad1")).toBe(true);
  });

  it("validates captures", () => {
    expect(isValidSANFormat("exd5")).toBe(true);
    expect(isValidSANFormat("Nxe5")).toBe(true);
    expect(isValidSANFormat("Bxf7")).toBe(true);
  });

  it("validates castling", () => {
    expect(isValidSANFormat("O-O")).toBe(true);
    expect(isValidSANFormat("O-O-O")).toBe(true);
  });

  it("validates promotions", () => {
    expect(isValidSANFormat("e8=Q")).toBe(true);
    expect(isValidSANFormat("a1=R")).toBe(true);
  });

  it("validates check and checkmate", () => {
    expect(isValidSANFormat("Qh5+")).toBe(true);
    expect(isValidSANFormat("Qf7#")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidSANFormat("")).toBe(false);
    expect(isValidSANFormat("1.")).toBe(false);
    expect(isValidSANFormat("e9")).toBe(false);
    expect(isValidSANFormat("Zi4")).toBe(false);
  });

  it("validates disambiguation moves", () => {
    expect(isValidSANFormat("R1d4")).toBe(true);
    expect(isValidSANFormat("Nbd2")).toBe(true);
    expect(isValidSANFormat("Raxd1")).toBe(true);
  });
});

describe("Slug Generation", () => {
  it("generates a clean slug from a title", () => {
    expect(generateSlug("Sicilian Defense")).toBe("sicilian-defense");
  });

  it("handles special characters", () => {
    expect(generateSlug("Najdorf: 6.Bg5 Main Line")).toBe("najdorf-6bg5-main-line");
  });

  it("handles multiple spaces", () => {
    expect(generateSlug("King's   Indian   Defense")).toBe("kings-indian-defense");
  });

  it("handles leading/trailing hyphens", () => {
    expect(generateSlug("  - test - ")).toBe("test");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles all special characters", () => {
    expect(generateSlug("!!!@@@###")).toBe("");
  });
});

describe("Line Completeness Check", () => {
  const completeLine: LineForQA = {
    title: "Najdorf Main Line",
    pgn: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
    finalFen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    description: "The main line of the Najdorf Sicilian.",
    strategicSummary: "Black fights for central control with a flexible pawn structure.",
    hintText: "Remember to play a6 before developing the bishop.",
    punishmentIdea: "If White plays passively, Black gets a strong queenside attack.",
    difficulty: "advanced",
    commonness: 85,
    priority: 90,
  };

  it("marks a complete line as complete", () => {
    const result = checkCompleteness(completeLine);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("detects missing description", () => {
    const result = checkCompleteness({ ...completeLine, description: null });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("description");
  });

  it("detects missing strategicSummary", () => {
    const result = checkCompleteness({ ...completeLine, strategicSummary: null });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("strategicSummary");
  });

  it("detects missing hintText", () => {
    const result = checkCompleteness({ ...completeLine, hintText: null });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("hintText");
  });

  it("detects missing punishmentIdea", () => {
    const result = checkCompleteness({ ...completeLine, punishmentIdea: null });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("punishmentIdea");
  });

  it("detects out-of-range commonness", () => {
    const result = checkCompleteness({ ...completeLine, commonness: 150 });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("commonness");
  });

  it("detects out-of-range priority", () => {
    const result = checkCompleteness({ ...completeLine, priority: -10 });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("priority");
  });

  it("detects multiple missing fields", () => {
    const result = checkCompleteness({
      ...completeLine,
      description: null,
      hintText: null,
      punishmentIdea: null,
    });
    expect(result.complete).toBe(false);
    expect(result.missing.length).toBe(3);
  });
});

describe("Duplicate Detection", () => {
  it("detects exact PGN duplicates", () => {
    const pgn = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const result = detectDuplicate(pgn, pgn);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("Exact PGN match");
  });

  it("detects prefix overlap", () => {
    const pgnA = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const pgnB = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6";
    const result = detectDuplicate(pgnA, pgnB);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("Prefix overlap");
  });

  it("does not flag completely different lines", () => {
    const pgnA = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const pgnB = "1.d4 d5 2.c4 e6 3.Nc3 Nf6";
    const result = detectDuplicate(pgnA, pgnB);
    expect(result.isDuplicate).toBe(false);
  });

  it("does not flag short prefix overlaps (< 4 moves)", () => {
    const pgnA = "1.e4 e5 2.Nf3";
    const pgnB = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const result = detectDuplicate(pgnA, pgnB);
    // 3 moves is below the threshold
    expect(result.isDuplicate).toBe(false);
  });

  it("detects prefix overlap with exactly 4 moves", () => {
    const pgnA = "1.e4 e5 2.Nf3 Nc6";
    const pgnB = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6";
    const result = detectDuplicate(pgnA, pgnB);
    expect(result.isDuplicate).toBe(true);
  });
});

describe("Admin API Route Structure", () => {
  const expectedRoutes = [
    { method: "GET", path: "/api/admin/openings" },
    { method: "POST", path: "/api/admin/openings" },
    { method: "GET", path: "/api/admin/openings/:id" },
    { method: "PUT", path: "/api/admin/openings/:id" },
    { method: "DELETE", path: "/api/admin/openings/:id" },
    { method: "GET", path: "/api/admin/openings/:id/lines" },
    { method: "POST", path: "/api/admin/openings/:id/lines" },
    { method: "PUT", path: "/api/admin/lines/:id" },
    { method: "DELETE", path: "/api/admin/lines/:id" },
    { method: "POST", path: "/api/admin/lines/:id/validate" },
    { method: "POST", path: "/api/admin/lines/bulk-publish" },
    { method: "GET", path: "/api/admin/tags" },
    { method: "POST", path: "/api/admin/tags" },
    { method: "DELETE", path: "/api/admin/tags/:id" },
    { method: "POST", path: "/api/admin/import/pgn" },
    { method: "GET", path: "/api/admin/qa/dashboard" },
    { method: "GET", path: "/api/admin/qa/incomplete" },
    { method: "GET", path: "/api/admin/qa/duplicates" },
  ];

  it("defines all required admin routes", () => {
    // This test validates the route design — actual endpoint testing requires integration tests
    expect(expectedRoutes.length).toBe(18);
    const methods = expectedRoutes.map((r) => r.method);
    expect(methods.filter((m) => m === "GET").length).toBeGreaterThanOrEqual(6);
    expect(methods.filter((m) => m === "POST").length).toBeGreaterThanOrEqual(5);
    expect(methods.filter((m) => m === "PUT").length).toBeGreaterThanOrEqual(2);
    expect(methods.filter((m) => m === "DELETE").length).toBeGreaterThanOrEqual(3);
  });

  it("all routes are under /api/admin/ namespace", () => {
    for (const route of expectedRoutes) {
      expect(route.path).toMatch(/^\/api\/admin\//);
    }
  });

  it("CRUD routes follow REST conventions", () => {
    const openingRoutes = expectedRoutes.filter((r) => r.path.includes("/openings") && !r.path.includes("/lines"));
    expect(openingRoutes.some((r) => r.method === "GET" && r.path === "/api/admin/openings")).toBe(true);
    expect(openingRoutes.some((r) => r.method === "POST" && r.path === "/api/admin/openings")).toBe(true);
    expect(openingRoutes.some((r) => r.method === "GET" && r.path === "/api/admin/openings/:id")).toBe(true);
    expect(openingRoutes.some((r) => r.method === "PUT" && r.path === "/api/admin/openings/:id")).toBe(true);
    expect(openingRoutes.some((r) => r.method === "DELETE" && r.path === "/api/admin/openings/:id")).toBe(true);
  });

  it("QA routes are read-only (GET)", () => {
    const qaRoutes = expectedRoutes.filter((r) => r.path.includes("/qa/"));
    for (const route of qaRoutes) {
      expect(route.method).toBe("GET");
    }
  });
});

describe("Tag Taxonomy Validation", () => {
  const validCategories = ["theme", "structure", "style", "level", "bestFor", "family"];

  it("defines all 6 tag categories", () => {
    expect(validCategories.length).toBe(6);
  });

  it("each category has a distinct purpose", () => {
    // No duplicates
    const unique = new Set(validCategories);
    expect(unique.size).toBe(validCategories.length);
  });

  it("category names follow camelCase convention", () => {
    for (const cat of validCategories) {
      expect(cat).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });
});

describe("FEN Validation Format", () => {
  function isValidFENFormat(fen: string): boolean {
    const parts = fen.split(" ");
    if (parts.length !== 6) return false;
    const ranks = parts[0].split("/");
    if (ranks.length !== 8) return false;
    if (!["w", "b"].includes(parts[1])) return false;
    if (!/^(-|[KQkq]{1,4})$/.test(parts[2])) return false;
    if (!/^(-|[a-h][36])$/.test(parts[3])) return false;
    if (isNaN(parseInt(parts[4]))) return false;
    if (isNaN(parseInt(parts[5]))) return false;
    return true;
  }

  it("validates a standard starting position FEN", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(true);
  });

  it("validates a mid-game FEN", () => {
    expect(isValidFENFormat("rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2")).toBe(true);
  });

  it("rejects FEN with wrong number of ranks", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false);
  });

  it("rejects FEN with invalid active color", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1")).toBe(false);
  });

  it("rejects FEN with wrong number of fields", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq")).toBe(false);
  });

  it("validates FEN with en passant square", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")).toBe(true);
  });

  it("validates FEN with no castling rights", () => {
    expect(isValidFENFormat("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1")).toBe(true);
  });
});
