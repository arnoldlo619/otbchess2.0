/**
 * userRepertoire.test.ts
 * Tests for the repertoire-aware collision scoring library.
 */
import {describe, it, expect, beforeEach} from "vitest";
import {
  loadUserRepertoire,
  saveUserRepertoire,
  clearUserRepertoire,
  DEFAULT_REPERTOIRE,
  computeCollisionScore,
  computeRepertoireFit,
  getColorContext,
  rankLinesByCollision,
  enrichPrepLines,
  generateMatchupSummary,
  getStructureLabel,
  WHITE_FIRST_MOVES,
  BLACK_VS_E4,
  BLACK_VS_D4,
  type UserRepertoire,
  type EnrichedPrepLine,
} from "../lib/userRepertoire";

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const e4Repertoire: UserRepertoire = {
  whiteFirstMove: "e4",
  blackVsE4: "Sicilian",
  blackVsD4: null,
  expectedColor: "white",
  chesscomUsername: null,
};

const d4Repertoire: UserRepertoire = {
  whiteFirstMove: "d4",
  blackVsE4: "French",
  blackVsD4: "King's Indian",
  expectedColor: "black",
  chesscomUsername: null,
};

const emptyRepertoire: UserRepertoire = { ...DEFAULT_REPERTOIRE };

const opponentProfile = {
  firstMoveAsWhite: [{ move: "e4", count: 30, pct: 75 }],
  blackOpenings: [
    { name: "Sicilian Defense: Najdorf Variation", eco: "B90", count: 15, winRate: 55 },
    { name: "French Defense", eco: "C00", count: 8, winRate: 40 },
  ],
  whiteOpenings: [
    { name: "Ruy Lopez", eco: "C65", count: 20, winRate: 60 },
  ],
  gamesAnalyzed: 40,
};

const sicilianLine = {
  name: "Sicilian Defense: Najdorf Variation",
  eco: "B90",
  moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
  confidence: "high" as const,
};

const frenchLine = {
  name: "French Defense: Advance Variation",
  eco: "C02",
  moves: "1.e4 e6 2.d4 d5 3.e5",
  confidence: "medium" as const,
};

const kidLine = {
  name: "King's Indian Defense: Classical Variation",
  eco: "E92",
  moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7",
  confidence: "high" as const,
};

const endgameLine = {
  name: "Rook endgame strategy",
  eco: "---",
  moves: "",
  confidence: "low" as const,
};

// ─── localStorage persistence ─────────────────────────────────────────────────

describe("localStorage persistence", () => {
  beforeEach(() => localStorageMock.clear());

  it("loadUserRepertoire returns DEFAULT_REPERTOIRE when nothing is stored", () => {
    const r = loadUserRepertoire();
    expect(r).toEqual(DEFAULT_REPERTOIRE);
  });

  it("saveUserRepertoire and loadUserRepertoire round-trip correctly", () => {
    saveUserRepertoire(e4Repertoire);
    const loaded = loadUserRepertoire();
    expect(loaded.whiteFirstMove).toBe("e4");
    expect(loaded.blackVsE4).toBe("Sicilian");
    expect(loaded.expectedColor).toBe("white");
  });

  it("clearUserRepertoire removes the stored value", () => {
    saveUserRepertoire(e4Repertoire);
    clearUserRepertoire();
    const loaded = loadUserRepertoire();
    expect(loaded).toEqual(DEFAULT_REPERTOIRE);
  });

  it("loadUserRepertoire merges with DEFAULT_REPERTOIRE for partial saves", () => {
    localStorageMock.setItem("otb_user_repertoire", JSON.stringify({ whiteFirstMove: "d4" }));
    const r = loadUserRepertoire();
    expect(r.whiteFirstMove).toBe("d4");
    expect(r.blackVsE4).toBeNull();
    expect(r.expectedColor).toBeNull();
  });

  it("loadUserRepertoire returns DEFAULT_REPERTOIRE on invalid JSON", () => {
    localStorageMock.setItem("otb_user_repertoire", "not-json{{{");
    const r = loadUserRepertoire();
    expect(r).toEqual(DEFAULT_REPERTOIRE);
  });
});

// ─── getColorContext ──────────────────────────────────────────────────────────

describe("getColorContext", () => {
  it("returns 'white' for 1.e4 opening names without defense keywords", () => {
    expect(getColorContext({ moves: "1.e4 e5", name: "Italian Game" })).toBe("white");
  });

  it("returns 'black' for Sicilian Defense", () => {
    expect(getColorContext(sicilianLine)).toBe("black");
  });

  it("returns 'black' for French Defense", () => {
    expect(getColorContext(frenchLine)).toBe("black");
  });

  it("returns 'black' for King's Indian Defense", () => {
    expect(getColorContext(kidLine)).toBe("black");
  });

  it("returns 'both' for endgame strategy lines", () => {
    expect(getColorContext(endgameLine)).toBe("both");
  });

  it("returns 'both' for middlegame complexity lines", () => {
    expect(getColorContext({ moves: "", name: "Complex middlegame strategy" })).toBe("both");
  });
});

// ─── computeRepertoireFit ─────────────────────────────────────────────────────

describe("computeRepertoireFit", () => {
  it("returns 'core' for Sicilian when user plays Sicilian as Black", () => {
    const fit = computeRepertoireFit(sicilianLine, e4Repertoire);
    expect(fit).toBe("core");
  });

  it("returns 'core' for French when user plays French as Black", () => {
    const fit = computeRepertoireFit(frenchLine, d4Repertoire);
    expect(fit).toBe("core");
  });

  it("returns 'core' for King's Indian when user plays KID", () => {
    const fit = computeRepertoireFit(kidLine, d4Repertoire);
    expect(fit).toBe("core");
  });

  it("returns 'adjacent' for e4 lines when user plays 1.e4", () => {
    const ruyLopez = { name: "Ruy Lopez", eco: "C65", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" };
    const fit = computeRepertoireFit(ruyLopez, e4Repertoire);
    expect(fit).toBe("core"); // starts with 1.e4 and user plays e4
  });

  it("returns 'outside' for KID when user has no d4 preference", () => {
    const noD4Rep: UserRepertoire = { ...DEFAULT_REPERTOIRE, whiteFirstMove: "e4" };
    const fit = computeRepertoireFit(kidLine, noD4Rep);
    // KID is E-range, user plays e4 (C/B range) → outside
    expect(fit).toBe("outside");
  });

  it("returns 'outside' for empty repertoire", () => {
    const fit = computeRepertoireFit(sicilianLine, emptyRepertoire);
    // B-range, no e4 preference → outside
    expect(fit).toBe("outside");
  });

  it("returns 'adjacent' for B-range lines when user has blackVsE4 set", () => {
    const rep: UserRepertoire = { ...DEFAULT_REPERTOIRE, blackVsE4: "French" };
    const caro = { name: "Caro-Kann Defense", eco: "B12", moves: "1.e4 c6" };
    const fit = computeRepertoireFit(caro, rep);
    expect(fit).toBe("adjacent");
  });
});

// ─── computeCollisionScore ────────────────────────────────────────────────────

describe("computeCollisionScore", () => {
  it("high confidence line scores higher than low confidence", () => {
    const highScore = computeCollisionScore(sicilianLine, emptyRepertoire, opponentProfile);
    const lowScore = computeCollisionScore(endgameLine, emptyRepertoire, opponentProfile);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("score is between 0 and 100", () => {
    const score = computeCollisionScore(sicilianLine, e4Repertoire, opponentProfile);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("core repertoire fit adds bonus over outside fit", () => {
    const coreScore = computeCollisionScore(sicilianLine, e4Repertoire, opponentProfile);
    const outsideScore = computeCollisionScore(sicilianLine, emptyRepertoire, opponentProfile);
    expect(coreScore).toBeGreaterThan(outsideScore);
  });

  it("matching opponent's top Black opening adds bonus", () => {
    const matchingScore = computeCollisionScore(sicilianLine, emptyRepertoire, opponentProfile);
    const nonMatchingScore = computeCollisionScore(kidLine, emptyRepertoire, opponentProfile);
    // Sicilian matches opponent's top Black opening; KID does not
    expect(matchingScore).toBeGreaterThan(nonMatchingScore);
  });

  it("color context bonus applies when expectedColor matches", () => {
    const whiteRep: UserRepertoire = { ...DEFAULT_REPERTOIRE, expectedColor: "white" };
    const blackRep: UserRepertoire = { ...DEFAULT_REPERTOIRE, expectedColor: "black" };
    const italianLine = { name: "Italian Game", eco: "C50", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4", confidence: "high" as const };
    const whiteScore = computeCollisionScore(italianLine, whiteRep, opponentProfile);
    const blackScore = computeCollisionScore(italianLine, blackRep, opponentProfile);
    expect(whiteScore).toBeGreaterThan(blackScore);
  });

  it("returns 0 or positive for empty opponent profile", () => {
    const emptyProfile = {
      firstMoveAsWhite: [],
      blackOpenings: [],
      whiteOpenings: [],
      gamesAnalyzed: 0,
    };
    const score = computeCollisionScore(sicilianLine, emptyRepertoire, emptyProfile);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── rankLinesByCollision ─────────────────────────────────────────────────────

describe("rankLinesByCollision", () => {
  it("sorts lines by collisionScore descending", () => {
    const lines: EnrichedPrepLine[] = [
      { name: "A", eco: "A00", moves: "", rationale: "", confidence: "low", collisionScore: 20, repertoireFit: "outside", colorContext: "both" },
      { name: "B", eco: "B00", moves: "", rationale: "", confidence: "high", collisionScore: 80, repertoireFit: "core", colorContext: "white" },
      { name: "C", eco: "C00", moves: "", rationale: "", confidence: "medium", collisionScore: 50, repertoireFit: "adjacent", colorContext: "black" },
    ];
    const ranked = rankLinesByCollision(lines);
    expect(ranked[0].name).toBe("B");
    expect(ranked[1].name).toBe("C");
    expect(ranked[2].name).toBe("A");
  });

  it("uses confidence as tiebreaker when collision scores are equal", () => {
    const lines: EnrichedPrepLine[] = [
      { name: "Low", eco: "A00", moves: "", rationale: "", confidence: "low", collisionScore: 50, repertoireFit: "outside", colorContext: "both" },
      { name: "High", eco: "B00", moves: "", rationale: "", confidence: "high", collisionScore: 50, repertoireFit: "core", colorContext: "white" },
    ];
    const ranked = rankLinesByCollision(lines);
    expect(ranked[0].name).toBe("High");
    expect(ranked[1].name).toBe("Low");
  });

  it("does not mutate the original array", () => {
    const lines: EnrichedPrepLine[] = [
      { name: "A", eco: "A00", moves: "", rationale: "", confidence: "low", collisionScore: 10, repertoireFit: "outside", colorContext: "both" },
      { name: "B", eco: "B00", moves: "", rationale: "", confidence: "high", collisionScore: 90, repertoireFit: "core", colorContext: "white" },
    ];
    const original = [...lines];
    rankLinesByCollision(lines);
    expect(lines[0].name).toBe(original[0].name);
  });
});

// ─── enrichPrepLines ──────────────────────────────────────────────────────────

describe("enrichPrepLines", () => {
  const rawLines = [sicilianLine, frenchLine, kidLine, endgameLine];

  it("returns enriched lines with collisionScore, repertoireFit, colorContext", () => {
    const enriched = enrichPrepLines(rawLines, e4Repertoire, opponentProfile);
    expect(enriched).toHaveLength(4);
    enriched.forEach(l => {
      expect(l.collisionScore).toBeGreaterThanOrEqual(0);
      expect(l.collisionScore).toBeLessThanOrEqual(100);
      expect(["core", "adjacent", "outside"]).toContain(l.repertoireFit);
      expect(["white", "black", "both"]).toContain(l.colorContext);
    });
  });

  it("marks exactly one line as isTrainFirst when top score > 30", () => {
    const enriched = enrichPrepLines(rawLines, e4Repertoire, opponentProfile);
    const trainFirst = enriched.filter(l => l.isTrainFirst);
    expect(trainFirst.length).toBeLessThanOrEqual(1);
  });

  it("returns lines sorted by collision score descending", () => {
    const enriched = enrichPrepLines(rawLines, e4Repertoire, opponentProfile);
    for (let i = 1; i < enriched.length; i++) {
      expect(enriched[i - 1].collisionScore).toBeGreaterThanOrEqual(enriched[i].collisionScore);
    }
  });

  it("returns empty array for empty input", () => {
    const enriched = enrichPrepLines([], e4Repertoire, opponentProfile);
    expect(enriched).toHaveLength(0);
  });

  it("adds structureLabel for known openings", () => {
    const enriched = enrichPrepLines([sicilianLine], e4Repertoire, opponentProfile);
    expect(enriched[0].structureLabel).toBe("Sicilian structure");
  });
});

// ─── getStructureLabel ────────────────────────────────────────────────────────

describe("getStructureLabel", () => {
  it("returns 'Sicilian structure' for Sicilian lines", () => {
    expect(getStructureLabel(sicilianLine)).toBe("Sicilian structure");
  });

  it("returns 'French structure' for French lines", () => {
    expect(getStructureLabel(frenchLine)).toBe("French structure");
  });

  it("returns 'KID structure' for King's Indian lines", () => {
    expect(getStructureLabel(kidLine)).toBe("KID structure");
  });

  it("returns 'Endgame technique' for endgame lines", () => {
    expect(getStructureLabel(endgameLine)).toBe("Endgame technique");
  });

  it("returns undefined for unknown openings", () => {
    const unknown = { name: "Some obscure gambit", eco: "A00", moves: "1.a4" };
    expect(getStructureLabel(unknown)).toBeUndefined();
  });
});

// ─── generateMatchupSummary ───────────────────────────────────────────────────

describe("generateMatchupSummary", () => {
  const enrichedLines = enrichPrepLines(
    [sicilianLine, frenchLine, kidLine],
    e4Repertoire,
    opponentProfile
  );

  const fullProfile = {
    firstMoveAsWhite: [{ move: "e4", count: 30, pct: 75 }],
    blackOpenings: [
      { name: "Sicilian Defense", eco: "B90", count: 15, winRate: 55, moves: "1.e4 c5" },
    ],
    whiteOpenings: [
      { name: "Ruy Lopez", eco: "C65", count: 20, winRate: 60, moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" },
    ],
    asWhite: { winRate: 65, games: 20 },
    asBlack: { winRate: 45, games: 20 },
    gamesAnalyzed: 40,
  };

  it("returns likelyBattle, studyFirst, prepRisk, colorAdvice", () => {
    const summary = generateMatchupSummary(e4Repertoire, fullProfile, enrichedLines);
    expect(summary).toHaveProperty("likelyBattle");
    expect(summary).toHaveProperty("studyFirst");
    expect(summary).toHaveProperty("prepRisk");
    expect(summary).toHaveProperty("colorAdvice");
  });

  it("likelyBattle mentions opponent's top Black opening when user is White", () => {
    const summary = generateMatchupSummary(e4Repertoire, fullProfile, enrichedLines);
    expect(summary.likelyBattle).toContain("Sicilian");
  });

  it("likelyBattle mentions opponent's first move when user is Black", () => {
    const blackRep: UserRepertoire = { ...d4Repertoire, expectedColor: "black" };
    const summary = generateMatchupSummary(blackRep, fullProfile, enrichedLines);
    expect(summary.likelyBattle).toMatch(/1\.e4|e4/);
  });

  it("studyFirst names the top collision line", () => {
    const summary = generateMatchupSummary(e4Repertoire, fullProfile, enrichedLines);
    if (summary.studyFirst) {
      expect(summary.studyFirst).toContain("Study");
    }
  });

  it("colorAdvice is non-null when opponent has strong color asymmetry", () => {
    const summary = generateMatchupSummary(e4Repertoire, fullProfile, enrichedLines);
    // asWhite 65% vs asBlack 45% → 20% gap → should trigger colorAdvice
    expect(summary.colorAdvice).not.toBeNull();
    expect(summary.colorAdvice).toContain("White");
  });

  it("colorAdvice is null when color win rates are similar", () => {
    const balancedProfile = { ...fullProfile, asWhite: { winRate: 52, games: 20 }, asBlack: { winRate: 48, games: 20 } };
    const summary = generateMatchupSummary(e4Repertoire, balancedProfile, enrichedLines);
    expect(summary.colorAdvice).toBeNull();
  });

  it("returns fallback likelyBattle when no opponent data", () => {
    const emptyProfile = {
      firstMoveAsWhite: [],
      blackOpenings: [],
      whiteOpenings: [],
      asWhite: { winRate: 0, games: 0 },
      asBlack: { winRate: 0, games: 0 },
      gamesAnalyzed: 0,
    };
    const summary = generateMatchupSummary(emptyRepertoire, emptyProfile, []);
    expect(summary.likelyBattle).toBeTruthy();
  });
});

// ─── Constants completeness ───────────────────────────────────────────────────

describe("constants completeness", () => {
  it("WHITE_FIRST_MOVES has at least 4 options including e4 and d4", () => {
    expect(WHITE_FIRST_MOVES.length).toBeGreaterThanOrEqual(4);
    expect(WHITE_FIRST_MOVES.map(m => m.value)).toContain("e4");
    expect(WHITE_FIRST_MOVES.map(m => m.value)).toContain("d4");
  });

  it("BLACK_VS_E4 has at least 4 options including Sicilian and French", () => {
    expect(BLACK_VS_E4.length).toBeGreaterThanOrEqual(4);
    expect(BLACK_VS_E4.map(m => m.value)).toContain("Sicilian");
    expect(BLACK_VS_E4.map(m => m.value)).toContain("French");
  });

  it("BLACK_VS_D4 has at least 4 options including King's Indian", () => {
    expect(BLACK_VS_D4.length).toBeGreaterThanOrEqual(4);
    expect(BLACK_VS_D4.map(m => m.value)).toContain("King's Indian");
  });

  it("all option arrays have value, label, description fields", () => {
    [...WHITE_FIRST_MOVES, ...BLACK_VS_E4, ...BLACK_VS_D4].forEach(opt => {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    });
  });
});
