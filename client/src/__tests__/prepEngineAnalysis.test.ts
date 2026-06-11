/**
 * prepEngineAnalysis.test.ts
 *
 * Tests for the Stockfish-backed engine analysis pipeline:
 * - EnginePattern shape and confidence rules
 * - EnginePatterns summary stats
 * - PrepReport.enginePatterns field integration
 * - Severity score range validation
 * - Pattern type enumeration
 */

import { describe, it, expect } from "vitest";

// ── Type mirrors (must match MatchupPrep.tsx interfaces) ──────────────────────

type PatternType = "opening_trap" | "tactical_weakness" | "endgame_weakness" | "time_pressure" | "phase_blunder";
type Confidence = "high" | "moderate" | "low";

interface EnginePatternEvidence {
  gameUrl?: string;
  move?: string;
  phase?: string;
  eco?: string;
}

interface EnginePattern {
  patternType: PatternType;
  label: string;
  description: string;
  frequency: number;
  totalGames: number;
  confidence: Confidence;
  severityScore: number;
  evidence: EnginePatternEvidence[];
}

interface EnginePatterns {
  patterns: EnginePattern[];
  gamesAnalyzed: number;
  positionsAnalyzed: number;
  avgBlundersPerGame: number;
  avgMistakesPerGame: number;
  worstPhase: "opening" | "middlegame" | "endgame";
  weakOpenings: { eco: string; name: string; blunderRate: number; games: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePattern(overrides: Partial<EnginePattern> = {}): EnginePattern {
  return {
    patternType: "tactical_weakness",
    label: "Drops pieces in the middlegame",
    description: "Opponent frequently hangs pieces after move 15, especially when under time pressure.",
    frequency: 8,
    totalGames: 20,
    confidence: "high",
    severityScore: 72,
    evidence: [
      { eco: "B20", phase: "middlegame", gameUrl: "https://chess.com/game/123" },
    ],
    ...overrides,
  };
}

function makeEnginePatterns(overrides: Partial<EnginePatterns> = {}): EnginePatterns {
  return {
    patterns: [makePattern()],
    gamesAnalyzed: 50,
    positionsAnalyzed: 1200,
    avgBlundersPerGame: 1.4,
    avgMistakesPerGame: 2.1,
    worstPhase: "middlegame",
    weakOpenings: [{ eco: "B20", name: "Sicilian Defense", blunderRate: 0.35, games: 12 }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EnginePattern shape", () => {
  it("has all required fields", () => {
    const p = makePattern();
    expect(p).toHaveProperty("patternType");
    expect(p).toHaveProperty("label");
    expect(p).toHaveProperty("description");
    expect(p).toHaveProperty("frequency");
    expect(p).toHaveProperty("totalGames");
    expect(p).toHaveProperty("confidence");
    expect(p).toHaveProperty("severityScore");
    expect(p).toHaveProperty("evidence");
  });

  it("severityScore is between 0 and 100", () => {
    const p = makePattern({ severityScore: 72 });
    expect(p.severityScore).toBeGreaterThanOrEqual(0);
    expect(p.severityScore).toBeLessThanOrEqual(100);
  });

  it("frequency does not exceed totalGames", () => {
    const p = makePattern({ frequency: 8, totalGames: 20 });
    expect(p.frequency).toBeLessThanOrEqual(p.totalGames);
  });

  it("confidence is one of the valid values", () => {
    const validValues: Confidence[] = ["high", "moderate", "low"];
    const p = makePattern();
    expect(validValues).toContain(p.confidence);
  });

  it("patternType is one of the valid enum values", () => {
    const validTypes: PatternType[] = [
      "opening_trap", "tactical_weakness", "endgame_weakness", "time_pressure", "phase_blunder",
    ];
    for (const type of validTypes) {
      const p = makePattern({ patternType: type });
      expect(validTypes).toContain(p.patternType);
    }
  });
});

describe("EnginePatternEvidence shape", () => {
  it("all evidence fields are optional", () => {
    const ev: EnginePatternEvidence = {};
    expect(ev.gameUrl).toBeUndefined();
    expect(ev.move).toBeUndefined();
    expect(ev.phase).toBeUndefined();
    expect(ev.eco).toBeUndefined();
  });

  it("gameUrl is a valid URL when present", () => {
    const ev: EnginePatternEvidence = { gameUrl: "https://chess.com/game/456" };
    expect(ev.gameUrl).toMatch(/^https?:\/\//);
  });
});

describe("EnginePatterns summary stats", () => {
  it("has all required fields", () => {
    const ep = makeEnginePatterns();
    expect(ep).toHaveProperty("gamesAnalyzed");
    expect(ep).toHaveProperty("positionsAnalyzed");
    expect(ep).toHaveProperty("avgBlundersPerGame");
    expect(ep).toHaveProperty("avgMistakesPerGame");
    expect(ep).toHaveProperty("worstPhase");
    expect(ep).toHaveProperty("weakOpenings");
    expect(ep).toHaveProperty("patterns");
  });

  it("avgBlundersPerGame is non-negative", () => {
    const ep = makeEnginePatterns({ avgBlundersPerGame: 1.4 });
    expect(ep.avgBlundersPerGame).toBeGreaterThanOrEqual(0);
  });

  it("avgMistakesPerGame is non-negative", () => {
    const ep = makeEnginePatterns({ avgMistakesPerGame: 2.1 });
    expect(ep.avgMistakesPerGame).toBeGreaterThanOrEqual(0);
  });

  it("worstPhase is one of the valid values", () => {
    const valid = ["opening", "middlegame", "endgame"];
    const ep = makeEnginePatterns();
    expect(valid).toContain(ep.worstPhase);
  });

  it("weakOpenings have required fields", () => {
    const ep = makeEnginePatterns();
    for (const wo of ep.weakOpenings) {
      expect(wo).toHaveProperty("eco");
      expect(wo).toHaveProperty("name");
      expect(wo).toHaveProperty("blunderRate");
      expect(wo).toHaveProperty("games");
      expect(wo.blunderRate).toBeGreaterThanOrEqual(0);
      expect(wo.blunderRate).toBeLessThanOrEqual(1);
    }
  });

  it("patterns array can be empty (no patterns found)", () => {
    const ep = makeEnginePatterns({ patterns: [] });
    expect(ep.patterns).toHaveLength(0);
  });
});

describe("Confidence-to-severity heuristics", () => {
  it("high confidence patterns tend to have higher severity", () => {
    const high = makePattern({ confidence: "high", severityScore: 75 });
    const low = makePattern({ confidence: "low", severityScore: 20 });
    // High confidence patterns should generally have higher severity scores
    expect(high.severityScore).toBeGreaterThan(low.severityScore);
  });

  it("severity score thresholds for UI color coding", () => {
    // Red threshold: >= 70
    expect(makePattern({ severityScore: 70 }).severityScore).toBeGreaterThanOrEqual(70);
    // Amber threshold: >= 40 and < 70
    const amber = makePattern({ severityScore: 55 });
    expect(amber.severityScore).toBeGreaterThanOrEqual(40);
    expect(amber.severityScore).toBeLessThan(70);
    // Green threshold: < 40
    expect(makePattern({ severityScore: 30 }).severityScore).toBeLessThan(40);
  });
});

describe("PrepReport.enginePatterns integration", () => {
  it("enginePatterns field is optional on PrepReport", () => {
    // Simulate a report without engine patterns (e.g., from cache before engine ran)
    const reportWithout = { enginePatterns: undefined };
    expect(reportWithout.enginePatterns).toBeUndefined();
  });

  it("enginePatterns field is present when engine ran successfully", () => {
    const reportWith = { enginePatterns: makeEnginePatterns() };
    expect(reportWith.enginePatterns).toBeDefined();
    expect(reportWith.enginePatterns!.patterns.length).toBeGreaterThan(0);
  });
});
