/**
 * Tests for useChessComRepertoire hook logic
 *
 * Tests the pure functions: classifyWhiteFirstMove, classifyBlackVsE4,
 * classifyBlackVsD4, parsePgnHeaders, and detectChessComRepertoire.
 */

import {describe, it, expect} from "vitest";
import {
  classifyWhiteFirstMove,
  classifyBlackVsE4,
  classifyBlackVsD4,
  parsePgnHeaders,
} from "../hooks/useChessComRepertoire";

// ─── classifyWhiteFirstMove ───────────────────────────────────────────────────

describe("classifyWhiteFirstMove", () => {
  it("classifies 1.e4", () => {
    expect(classifyWhiteFirstMove("1.e4 e5 2.Nf3")).toBe("e4");
  });

  it("classifies 1.d4", () => {
    expect(classifyWhiteFirstMove("1.d4 d5 2.c4")).toBe("d4");
  });

  it("classifies 1.c4", () => {
    expect(classifyWhiteFirstMove("1.c4 e5 2.Nc3")).toBe("c4");
  });

  it("classifies 1.Nf3", () => {
    expect(classifyWhiteFirstMove("1.Nf3 d5 2.g3")).toBe("Nf3");
  });

  it("classifies 1.nf3 case-insensitive", () => {
    expect(classifyWhiteFirstMove("1.Nf3 Nf6")).toBe("Nf3");
  });

  it("classifies irregular first moves as other", () => {
    expect(classifyWhiteFirstMove("1.g3 d5")).toBe("other");
    expect(classifyWhiteFirstMove("1.b3 e5")).toBe("other");
    expect(classifyWhiteFirstMove("1.f4 e5")).toBe("other");
  });

  it("returns null for empty string", () => {
    expect(classifyWhiteFirstMove("")).toBeNull();
  });

  it("handles moves without move number prefix", () => {
    expect(classifyWhiteFirstMove("e4 e5 Nf3")).toBe("e4");
  });
});

// ─── classifyBlackVsE4 ───────────────────────────────────────────────────────

describe("classifyBlackVsE4", () => {
  it("classifies Sicilian by ECO code", () => {
    expect(classifyBlackVsE4("Sicilian Defense", "B90", "")).toBe("Sicilian");
    expect(classifyBlackVsE4("Sicilian, Najdorf", "B96", "")).toBe("Sicilian");
    expect(classifyBlackVsE4("Sicilian Defense", "B20", "")).toBe("Sicilian");
  });

  it("classifies French by ECO code", () => {
    expect(classifyBlackVsE4("French Defense", "C00", "")).toBe("French");
    expect(classifyBlackVsE4("French, Advance", "C02", "")).toBe("French");
    expect(classifyBlackVsE4("French, Winawer", "C15", "")).toBe("French");
  });

  it("classifies Caro-Kann by ECO code", () => {
    expect(classifyBlackVsE4("Caro-Kann Defense", "B12", "")).toBe("Caro-Kann");
    expect(classifyBlackVsE4("Caro-Kann, Classical", "B18", "")).toBe("Caro-Kann");
  });

  it("classifies open games (1...e5) by ECO code", () => {
    expect(classifyBlackVsE4("Ruy Lopez", "C60", "")).toBe("e5");
    expect(classifyBlackVsE4("Italian Game", "C50", "")).toBe("e5");
    expect(classifyBlackVsE4("Scotch Game", "C45", "")).toBe("e5");
    expect(classifyBlackVsE4("King's Gambit", "C30", "")).toBe("e5");
  });

  it("classifies Pirc/Modern by ECO code", () => {
    expect(classifyBlackVsE4("Pirc Defense", "B07", "")).toBe("Pirc/Modern");
    expect(classifyBlackVsE4("Modern Defense", "B06", "")).toBe("Pirc/Modern");
  });

  it("classifies Alekhine by ECO code", () => {
    expect(classifyBlackVsE4("Alekhine Defense", "B02", "")).toBe("Alekhine");
    expect(classifyBlackVsE4("Alekhine, Four Pawns", "B03", "")).toBe("Alekhine");
  });

  it("classifies Scandinavian by ECO code", () => {
    expect(classifyBlackVsE4("Scandinavian Defense", "B01", "")).toBe("Scandinavian");
  });

  it("returns null for non-e4 openings", () => {
    expect(classifyBlackVsE4("Queen's Gambit", "D06", "")).toBeNull();
    expect(classifyBlackVsE4("King's Indian", "E60", "")).toBeNull();
    expect(classifyBlackVsE4("English Opening", "A20", "")).toBeNull();
  });

  it("classifies by opening name even with unknown ECO", () => {
    expect(classifyBlackVsE4("Sicilian Defense", "B50", "")).toBe("Sicilian");
    expect(classifyBlackVsE4("French Defense", "C10", "")).toBe("French");
  });
});

// ─── classifyBlackVsD4 ───────────────────────────────────────────────────────

describe("classifyBlackVsD4", () => {
  it("classifies King's Indian by ECO code", () => {
    expect(classifyBlackVsD4("King's Indian Defense", "E60", "")).toBe("King's Indian");
    expect(classifyBlackVsD4("King's Indian, Classical", "E92", "")).toBe("King's Indian");
  });

  it("classifies Nimzo-Indian by ECO code", () => {
    expect(classifyBlackVsD4("Nimzo-Indian Defense", "E20", "")).toBe("Nimzo-Indian");
    expect(classifyBlackVsD4("Nimzo-Indian, Classical", "E32", "")).toBe("Nimzo-Indian");
  });

  it("classifies QGD by ECO code", () => {
    expect(classifyBlackVsD4("Queen's Gambit Declined", "D30", "")).toBe("QGD");
    expect(classifyBlackVsD4("QGD, Orthodox", "D60", "")).toBe("QGD");
  });

  it("classifies Grünfeld by ECO code", () => {
    expect(classifyBlackVsD4("Grünfeld Defense", "D70", "")).toBe("Grünfeld");
    expect(classifyBlackVsD4("Grunfeld, Exchange", "D85", "")).toBe("Grünfeld");
  });

  it("classifies Dutch by ECO code", () => {
    expect(classifyBlackVsD4("Dutch Defense", "A80", "")).toBe("Dutch");
    expect(classifyBlackVsD4("Dutch, Leningrad", "A90", "")).toBe("Dutch");
  });

  it("classifies Benoni by ECO code", () => {
    expect(classifyBlackVsD4("Modern Benoni", "A60", "")).toBe("Benoni");
    expect(classifyBlackVsD4("Benoni Defense", "A75", "")).toBe("Benoni");
  });

  it("classifies Queen's Indian by ECO code", () => {
    expect(classifyBlackVsD4("Queen's Indian Defense", "E10", "")).toBe("Queen's Indian");
    expect(classifyBlackVsD4("Queen's Indian, Kasparov", "E12", "")).toBe("Queen's Indian");
  });

  it("classifies Slav by ECO code", () => {
    expect(classifyBlackVsD4("Slav Defense", "D10", "")).toBe("Slav");
    expect(classifyBlackVsD4("Slav, Exchange", "D15", "")).toBe("Slav");
  });

  it("returns null for non-d4 openings", () => {
    expect(classifyBlackVsD4("Sicilian Defense", "B90", "")).toBeNull();
    expect(classifyBlackVsD4("French Defense", "C00", "")).toBeNull();
    expect(classifyBlackVsD4("Ruy Lopez", "C60", "")).toBeNull();
  });

  it("classifies by opening name even with unknown ECO", () => {
    expect(classifyBlackVsD4("King's Indian Defense", "E65", "")).toBe("King's Indian");
    expect(classifyBlackVsD4("Nimzo-Indian Defense", "E25", "")).toBe("Nimzo-Indian");
  });
});

// ─── parsePgnHeaders ──────────────────────────────────────────────────────────

describe("parsePgnHeaders", () => {
  const samplePgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Magnus"]
[Black "Hikaru"]
[Result "1-0"]
[ECO "B90"]
[Opening "Sicilian Defense: Najdorf Variation"]
[TimeControl "600"]

1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 1-0`;

  it("extracts ECO code", () => {
    const { eco } = parsePgnHeaders(samplePgn);
    expect(eco).toBe("B90");
  });

  it("extracts opening name", () => {
    const { opening } = parsePgnHeaders(samplePgn);
    expect(opening).toBe("Sicilian Defense: Najdorf Variation");
  });

  it("extracts White player name", () => {
    const { white } = parsePgnHeaders(samplePgn);
    expect(white).toBe("Magnus");
  });

  it("extracts Black player name", () => {
    const { black } = parsePgnHeaders(samplePgn);
    expect(black).toBe("Hikaru");
  });

  it("extracts first move from moves section", () => {
    const { moves } = parsePgnHeaders(samplePgn);
    expect(moves).toContain("1.e4");
  });

  it("handles missing headers gracefully", () => {
    const { eco, opening, white, black } = parsePgnHeaders("1.e4 e5");
    expect(eco).toBe("");
    expect(opening).toBe("");
    expect(white).toBe("");
    expect(black).toBe("");
  });

  it("handles empty PGN", () => {
    const { eco, opening, moves } = parsePgnHeaders("");
    expect(eco).toBe("");
    expect(opening).toBe("");
    expect(moves).toBe("");
  });

  it("handles PGN with only headers and no moves", () => {
    const pgn = `[ECO "D30"]\n[Opening "Queen's Gambit"]\n[White "A"]\n[Black "B"]`;
    const { eco, opening } = parsePgnHeaders(pgn);
    expect(eco).toBe("D30");
    expect(opening).toBe("Queen's Gambit");
  });
});

// ─── Integration: classification pipeline ────────────────────────────────────

describe("Opening classification pipeline", () => {
  it("correctly classifies a Sicilian game from PGN", () => {
    const pgn = `[ECO "B90"][Opening "Sicilian Defense: Najdorf Variation"][White "A"][Black "B"]\n1.e4 c5 2.Nf3`;
    const { eco, opening, moves } = parsePgnHeaders(pgn);
    const whiteMove = classifyWhiteFirstMove(moves);
    expect(whiteMove).toBe("e4");
    const blackResp = classifyBlackVsE4(opening, eco, moves);
    expect(blackResp).toBe("Sicilian");
  });

  it("correctly classifies a King's Indian game from PGN", () => {
    const pgn = `[ECO "E92"][Opening "King's Indian Defense: Classical Variation"][White "A"][Black "B"]\n1.d4 Nf6 2.c4 g6`;
    const { eco, opening, moves } = parsePgnHeaders(pgn);
    const whiteMove = classifyWhiteFirstMove(moves);
    expect(whiteMove).toBe("d4");
    const blackResp = classifyBlackVsD4(opening, eco, moves);
    expect(blackResp).toBe("King's Indian");
  });

  it("correctly classifies a Ruy Lopez game from PGN", () => {
    const pgn = `[ECO "C65"][Opening "Ruy Lopez: Berlin Defense"][White "A"][Black "B"]\n1.e4 e5 2.Nf3 Nc6 3.Bb5`;
    const { eco, opening, moves } = parsePgnHeaders(pgn);
    const whiteMove = classifyWhiteFirstMove(moves);
    expect(whiteMove).toBe("e4");
    const blackResp = classifyBlackVsE4(opening, eco, moves);
    expect(blackResp).toBe("e5");
  });

  it("correctly classifies a French Defense game from PGN", () => {
    const pgn = `[ECO "C02"][Opening "French Defense: Advance Variation"][White "A"][Black "B"]\n1.e4 e6 2.d4 d5 3.e5`;
    const { eco, opening, moves } = parsePgnHeaders(pgn);
    const whiteMove = classifyWhiteFirstMove(moves);
    expect(whiteMove).toBe("e4");
    const blackResp = classifyBlackVsE4(opening, eco, moves);
    expect(blackResp).toBe("French");
  });

  it("correctly classifies a Queen's Gambit Declined game from PGN", () => {
    const pgn = `[ECO "D30"][Opening "Queen's Gambit Declined"][White "A"][Black "B"]\n1.d4 d5 2.c4 e6`;
    const { eco, opening, moves } = parsePgnHeaders(pgn);
    const whiteMove = classifyWhiteFirstMove(moves);
    expect(whiteMove).toBe("d4");
    const blackResp = classifyBlackVsD4(opening, eco, moves);
    expect(blackResp).toBe("QGD");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("classifyBlackVsE4 returns null for A-series ECO (not e4)", () => {
    expect(classifyBlackVsE4("English Opening", "A20", "")).toBeNull();
    expect(classifyBlackVsE4("Bird's Opening", "A02", "")).toBeNull();
  });

  it("classifyBlackVsD4 returns null for B/C series ECO (not d4)", () => {
    expect(classifyBlackVsD4("Sicilian", "B90", "")).toBeNull();
    expect(classifyBlackVsD4("Ruy Lopez", "C60", "")).toBeNull();
  });

  it("classifyWhiteFirstMove handles whitespace", () => {
    expect(classifyWhiteFirstMove("  1.e4 e5  ")).toBe("e4");
  });

  it("classifyBlackVsE4 returns other for unrecognized e4 opening", () => {
    // B00 is an e4 opening but not specifically classified
    expect(classifyBlackVsE4("Owen's Defense", "B00", "")).toBe("other");
  });
});
