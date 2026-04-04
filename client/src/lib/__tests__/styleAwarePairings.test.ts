/**
 * Unit tests for the Style-Aware Pairings Engine
 * Covers: style signal computation, style profile synthesis,
 * pairing score computation, candidate evaluation, pairing generation,
 * pool readiness assessment, and graceful fallback logic.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  computeStyleSignals,
  synthesiseStyleProfile,
  computeStyleCompatScore,
  computeDynamismScore,
  computeEloProximityScore,
  evaluateCandidatePairing,
  generateStyleAwarePairings,
  assessPoolReadiness,
  neutralSignals,
  buildPairingExplanation,
  PAIRING_MODES,
  type RawGameStats,
  type StyleSignals,
  type StylePairingPlayer,
  type PairingSettings,
} from "../styleAwarePairings";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<RawGameStats> = {}): RawGameStats {
  return {
    gamesAnalyzed: 30,
    overall: { wins: 15, draws: 5, losses: 10 },
    endgameProfile: {
      checkmates: 5,
      resignations: 15,
      timeouts: 2,
      draws: 5,
      total: 27,
    },
    avgGameLength: 32,
    firstMoveAsWhite: [{ move: "e4", count: 20, pct: 0.8 }],
    whiteOpenings: [
      { name: "Sicilian Defense", count: 12 },
      { name: "Ruy Lopez", count: 8 },
    ],
    blackOpenings: [
      { name: "King's Gambit", count: 10 },
    ],
    ...overrides,
  };
}

function makePlayer(
  id: string,
  elo: number,
  signals?: Partial<StyleSignals>,
  previousOpponents: string[] = []
): StylePairingPlayer {
  const baseSignals: StyleSignals = {
    aggression: 0.5,
    tactical: 0.5,
    openingSharpness: 0.5,
    volatility: 0.5,
    gameLengthTendency: 0.5,
    confidence: 0.8,
    ...signals,
  };
  return {
    id,
    name: `Player ${id}`,
    elo,
    styleProfile: synthesiseStyleProfile(baseSignals),
    previousOpponents,
  };
}

function makeSettings(overrides: Partial<PairingSettings> = {}): PairingSettings {
  return {
    mode: "balanced",
    avoidRematches: true,
    autoFallbackOnWeakData: true,
    ...overrides,
  };
}

// ─── computeStyleSignals ──────────────────────────────────────────────────────

describe("computeStyleSignals", () => {
  it("returns neutral signals with confidence 0 when gamesAnalyzed is 0", () => {
    const stats = makeStats({ gamesAnalyzed: 0 });
    const signals = computeStyleSignals(stats);
    expect(signals.confidence).toBe(0);
    expect(signals.aggression).toBe(0.5);
    expect(signals.tactical).toBe(0.5);
    expect(signals.openingSharpness).toBe(0.5);
    expect(signals.volatility).toBe(0.5);
    expect(signals.gameLengthTendency).toBe(0.5);
  });

  it("computes high confidence for 30+ games", () => {
    const signals = computeStyleSignals(makeStats({ gamesAnalyzed: 30 }));
    expect(signals.confidence).toBe(1.0);
  });

  it("computes partial confidence for 15 games", () => {
    const signals = computeStyleSignals(makeStats({ gamesAnalyzed: 15 }));
    expect(signals.confidence).toBeCloseTo(0.5, 1);
  });

  it("computes high aggression for e4 first move", () => {
    const signals = computeStyleSignals(
      makeStats({ firstMoveAsWhite: [{ move: "e4", count: 20, pct: 0.9 }] })
    );
    expect(signals.aggression).toBeGreaterThanOrEqual(0.75);
  });

  it("computes lower aggression for non-aggressive first moves", () => {
    const signals = computeStyleSignals(
      makeStats({ firstMoveAsWhite: [{ move: "Nf3", count: 20, pct: 0.9 }] })
    );
    expect(signals.aggression).toBeLessThan(0.5);
  });

  it("computes high opening sharpness for sharp openings", () => {
    const signals = computeStyleSignals(
      makeStats({
        whiteOpenings: [{ name: "Sicilian Defense", count: 20 }],
        blackOpenings: [{ name: "King's Gambit", count: 10 }],
      })
    );
    expect(signals.openingSharpness).toBeGreaterThan(0.5);
  });

  it("computes low opening sharpness for solid openings", () => {
    const signals = computeStyleSignals(
      makeStats({
        whiteOpenings: [{ name: "London System", count: 20 }],
        blackOpenings: [{ name: "Nimzo-Indian Defense", count: 10 }],
      })
    );
    expect(signals.openingSharpness).toBeLessThanOrEqual(0.5);
  });

  it("computes high volatility when few draws", () => {
    const signals = computeStyleSignals(
      makeStats({ overall: { wins: 20, draws: 1, losses: 9 } })
    );
    expect(signals.volatility).toBeGreaterThan(0.8);
  });

  it("computes low volatility when many draws", () => {
    const signals = computeStyleSignals(
      makeStats({ overall: { wins: 5, draws: 20, losses: 5 } })
    );
    expect(signals.volatility).toBeLessThan(0.4);
  });

  it("computes high game length tendency for short games", () => {
    const signals = computeStyleSignals(makeStats({ avgGameLength: 18 }));
    expect(signals.gameLengthTendency).toBeGreaterThan(0.6);
  });

  it("computes low game length tendency for long games", () => {
    const signals = computeStyleSignals(makeStats({ avgGameLength: 55 }));
    expect(signals.gameLengthTendency).toBeLessThan(0.3);
  });

  it("computes high tactical score when many checkmates and resignations", () => {
    const signals = computeStyleSignals(
      makeStats({
        endgameProfile: {
          checkmates: 12,
          resignations: 10,
          timeouts: 1,
          draws: 2,
          total: 25,
        },
      })
    );
    expect(signals.tactical).toBeGreaterThan(0.7);
  });

  it("computes low tactical score when many draws in endgame", () => {
    const signals = computeStyleSignals(
      makeStats({
        endgameProfile: {
          checkmates: 1,
          resignations: 2,
          timeouts: 0,
          draws: 20,
          total: 23,
        },
      })
    );
    expect(signals.tactical).toBeLessThan(0.4);
  });

  it("all signal values are clamped to [0, 1]", () => {
    const signals = computeStyleSignals(makeStats());
    for (const key of Object.keys(signals) as (keyof StyleSignals)[]) {
      expect(signals[key]).toBeGreaterThanOrEqual(0);
      expect(signals[key]).toBeLessThanOrEqual(1);
    }
  });
});

// ─── synthesiseStyleProfile ───────────────────────────────────────────────────

describe("synthesiseStyleProfile", () => {
  it("assigns 'ready' status for high confidence signals", () => {
    const signals: StyleSignals = {
      aggression: 0.7,
      tactical: 0.75,
      openingSharpness: 0.8,
      volatility: 0.7,
      gameLengthTendency: 0.6,
      confidence: 0.9,
    };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.status).toBe("ready");
  });

  it("assigns 'limited' status for moderate confidence", () => {
    const signals = { ...neutralSignals(), confidence: 0.5 };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.status).toBe("limited");
  });

  it("assigns 'low_confidence' status for low confidence", () => {
    const signals = { ...neutralSignals(), confidence: 0.2 };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.status).toBe("low_confidence");
  });

  it("assigns 'fallback' status for very low confidence", () => {
    const signals = { ...neutralSignals(), confidence: 0.05 };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.status).toBe("fallback");
  });

  it("assigns 'Sharp Tactical Player' tag for high sharpness signals", () => {
    const signals: StyleSignals = {
      aggression: 0.85,
      tactical: 0.85,
      openingSharpness: 0.85,
      volatility: 0.85,
      gameLengthTendency: 0.7,
      confidence: 0.9,
    };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.primaryTag).toBe("Sharp Tactical Player");
  });

  it("assigns 'Positional Grind Player' tag for low sharpness signals", () => {
    const signals: StyleSignals = {
      aggression: 0.2,
      tactical: 0.2,
      openingSharpness: 0.2,
      volatility: 0.2,
      gameLengthTendency: 0.2,
      confidence: 0.9,
    };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.primaryTag).toBe("Positional Grind Player");
  });

  it("assigns 'Sharp Opening Repertoire' secondary tag for high opening sharpness", () => {
    const signals: StyleSignals = {
      aggression: 0.5,
      tactical: 0.5,
      openingSharpness: 0.8,
      volatility: 0.5,
      gameLengthTendency: 0.5,
      confidence: 0.9,
    };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.secondaryTag).toBe("Sharp Opening Repertoire");
  });

  it("returns a non-empty summary string", () => {
    const profile = synthesiseStyleProfile(neutralSignals());
    expect(profile.summary.length).toBeGreaterThan(5);
  });

  it("confidence in profile matches input signals confidence", () => {
    const signals = { ...neutralSignals(), confidence: 0.75 };
    const profile = synthesiseStyleProfile(signals);
    expect(profile.confidence).toBe(0.75);
  });
});

// ─── neutralSignals ───────────────────────────────────────────────────────────

describe("neutralSignals", () => {
  it("returns all 0.5 values except confidence which is 0", () => {
    const ns = neutralSignals();
    expect(ns.aggression).toBe(0.5);
    expect(ns.tactical).toBe(0.5);
    expect(ns.openingSharpness).toBe(0.5);
    expect(ns.volatility).toBe(0.5);
    expect(ns.gameLengthTendency).toBe(0.5);
    expect(ns.confidence).toBe(0);
  });
});

// ─── computeStyleCompatScore ──────────────────────────────────────────────────

describe("computeStyleCompatScore", () => {
  it("returns a value in [0, 1] for all modes", () => {
    const a = neutralSignals();
    const b = neutralSignals();
    for (const mode of ["balanced", "style_aware", "sharp"] as const) {
      const score = computeStyleCompatScore(a, b, mode);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("sharp mode rewards both players being sharp", () => {
    const sharp: StyleSignals = {
      aggression: 0.9,
      tactical: 0.9,
      openingSharpness: 0.9,
      volatility: 0.9,
      gameLengthTendency: 0.8,
      confidence: 0.9,
    };
    const solid: StyleSignals = {
      aggression: 0.1,
      tactical: 0.1,
      openingSharpness: 0.1,
      volatility: 0.1,
      gameLengthTendency: 0.2,
      confidence: 0.9,
    };
    const sharpVsSharp = computeStyleCompatScore(sharp, sharp, "sharp");
    const sharpVsSolid = computeStyleCompatScore(sharp, solid, "sharp");
    expect(sharpVsSharp).toBeGreaterThan(sharpVsSolid);
  });

  it("style_aware mode rewards contrasting styles", () => {
    const tactical: StyleSignals = {
      aggression: 0.8,
      tactical: 0.9,
      openingSharpness: 0.8,
      volatility: 0.7,
      gameLengthTendency: 0.6,
      confidence: 0.9,
    };
    const positional: StyleSignals = {
      aggression: 0.2,
      tactical: 0.1,
      openingSharpness: 0.2,
      volatility: 0.3,
      gameLengthTendency: 0.3,
      confidence: 0.9,
    };
    const contrastScore = computeStyleCompatScore(tactical, positional, "style_aware");
    const sameScore = computeStyleCompatScore(tactical, tactical, "style_aware");
    // Contrasting styles should score higher in style_aware mode
    expect(contrastScore).toBeGreaterThan(sameScore);
  });
});

// ─── computeDynamismScore ─────────────────────────────────────────────────────

describe("computeDynamismScore", () => {
  it("returns a value in [0, 1]", () => {
    const score = computeDynamismScore(neutralSignals(), neutralSignals());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns higher score for two aggressive players", () => {
    const aggressive: StyleSignals = {
      aggression: 0.9,
      tactical: 0.9,
      openingSharpness: 0.9,
      volatility: 0.9,
      gameLengthTendency: 0.8,
      confidence: 0.9,
    };
    const highDyn = computeDynamismScore(aggressive, aggressive);
    const lowDyn = computeDynamismScore(neutralSignals(), neutralSignals());
    expect(highDyn).toBeGreaterThan(lowDyn);
  });
});

// ─── computeEloProximityScore ─────────────────────────────────────────────────

describe("computeEloProximityScore", () => {
  it("returns 1.0 for identical Elo", () => {
    expect(computeEloProximityScore(1500, 1500, 400)).toBe(1.0);
  });

  it("returns 0.0 for Elo gap equal to tolerance", () => {
    expect(computeEloProximityScore(1500, 1900, 400)).toBe(0.0);
  });

  it("returns 0.5 for Elo gap equal to half tolerance", () => {
    expect(computeEloProximityScore(1500, 1700, 400)).toBe(0.5);
  });

  it("clamps to 0 for Elo gap exceeding tolerance", () => {
    expect(computeEloProximityScore(1000, 2000, 400)).toBe(0.0);
  });
});

// ─── evaluateCandidatePairing ─────────────────────────────────────────────────

describe("evaluateCandidatePairing", () => {
  it("marks pairing as invalid when Elo gap exceeds tolerance", () => {
    const a = makePlayer("a", 1000);
    const b = makePlayer("b", 1800);
    const settings = makeSettings({ mode: "balanced", eloTolerance: 400 });
    const result = evaluateCandidatePairing(a, b, settings);
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toMatch(/Elo gap/);
  });

  it("marks pairing as valid when Elo gap is within tolerance", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1700);
    const settings = makeSettings({ mode: "balanced", eloTolerance: 400 });
    const result = evaluateCandidatePairing(a, b, settings);
    expect(result.isValid).toBe(true);
  });

  it("returns a totalScore in [0, 1] for valid pairings", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1550);
    const settings = makeSettings({ mode: "style_aware" });
    const result = evaluateCandidatePairing(a, b, settings);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(1);
  });

  it("penalises rematch pairings", () => {
    const a = makePlayer("a", 1500, {}, ["b"]);
    const b = makePlayer("b", 1500);
    const settings = makeSettings({ mode: "balanced", avoidRematches: true });
    const result = evaluateCandidatePairing(a, b, settings);
    // Score should be penalised (multiplied by 0.5)
    const noRematchResult = evaluateCandidatePairing(
      makePlayer("a", 1500),
      b,
      settings
    );
    expect(result.totalScore).toBeLessThan(noRematchResult.totalScore);
  });

  it("falls back to balanced mode when style confidence is low", () => {
    const lowConfA = makePlayer("a", 1500, { confidence: 0.1 });
    const lowConfB = makePlayer("b", 1500, { confidence: 0.1 });
    const settings = makeSettings({
      mode: "sharp",
      autoFallbackOnWeakData: true,
    });
    const result = evaluateCandidatePairing(lowConfA, lowConfB, settings);
    // Should still be valid and produce a score
    expect(result.isValid).toBe(true);
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it("does not fall back when autoFallbackOnWeakData is false", () => {
    const lowConfA = makePlayer("a", 1500, { confidence: 0.1 });
    const lowConfB = makePlayer("b", 1500, { confidence: 0.1 });
    const settings = makeSettings({
      mode: "sharp",
      autoFallbackOnWeakData: false,
    });
    const result = evaluateCandidatePairing(lowConfA, lowConfB, settings);
    expect(result.isValid).toBe(true);
  });

  it("includes explanation chips for valid pairings", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1520);
    const settings = makeSettings({ mode: "balanced" });
    const result = evaluateCandidatePairing(a, b, settings);
    expect(result.explanation.chips.length).toBeGreaterThan(0);
  });
});

// ─── generateStyleAwarePairings ───────────────────────────────────────────────

describe("generateStyleAwarePairings", () => {
  it("generates correct number of pairings for even player count", () => {
    const players = [
      makePlayer("a", 1800),
      makePlayer("b", 1750),
      makePlayer("c", 1700),
      makePlayer("d", 1650),
    ];
    const settings = makeSettings({ mode: "balanced" });
    const { pairings, byePlayerId } = generateStyleAwarePairings(players, settings);
    expect(pairings).toHaveLength(2);
    expect(byePlayerId).toBeNull();
  });

  it("generates correct pairings and assigns bye for odd player count", () => {
    const players = [
      makePlayer("a", 1800),
      makePlayer("b", 1750),
      makePlayer("c", 1700),
    ];
    const settings = makeSettings({ mode: "balanced" });
    const { pairings, byePlayerId } = generateStyleAwarePairings(players, settings);
    expect(pairings).toHaveLength(1);
    expect(byePlayerId).not.toBeNull();
  });

  it("assigns sequential board numbers starting from 1", () => {
    const players = [
      makePlayer("a", 1800),
      makePlayer("b", 1750),
      makePlayer("c", 1700),
      makePlayer("d", 1650),
    ];
    const settings = makeSettings({ mode: "balanced" });
    const { pairings } = generateStyleAwarePairings(players, settings);
    expect(pairings[0].boardNumber).toBe(1);
    expect(pairings[1].boardNumber).toBe(2);
  });

  it("each player appears in at most one pairing", () => {
    const players = [
      makePlayer("a", 1800),
      makePlayer("b", 1750),
      makePlayer("c", 1700),
      makePlayer("d", 1650),
      makePlayer("e", 1600),
      makePlayer("f", 1550),
    ];
    const settings = makeSettings({ mode: "style_aware" });
    const { pairings } = generateStyleAwarePairings(players, settings);
    const usedIds = new Set<string>();
    for (const p of pairings) {
      expect(usedIds.has(p.whiteId)).toBe(false);
      expect(usedIds.has(p.blackId)).toBe(false);
      usedIds.add(p.whiteId);
      usedIds.add(p.blackId);
    }
  });

  it("returns empty pairings for empty player list", () => {
    const { pairings, byePlayerId } = generateStyleAwarePairings([], makeSettings());
    expect(pairings).toHaveLength(0);
    expect(byePlayerId).toBeNull();
  });

  it("returns bye for single player", () => {
    const players = [makePlayer("a", 1500)];
    const { pairings, byePlayerId } = generateStyleAwarePairings(players, makeSettings());
    expect(pairings).toHaveLength(0);
    expect(byePlayerId).toBe("a");
  });

  it("each pairing has an explanation with a label", () => {
    const players = [
      makePlayer("a", 1800),
      makePlayer("b", 1750),
    ];
    const { pairings } = generateStyleAwarePairings(players, makeSettings());
    expect(pairings[0].explanation.label.length).toBeGreaterThan(0);
  });

  it("sharp mode produces pairings with effectiveMode set correctly for high-confidence players", () => {
    const players = [
      makePlayer("a", 1800, { confidence: 0.9 }),
      makePlayer("b", 1750, { confidence: 0.9 }),
    ];
    const settings = makeSettings({ mode: "sharp", autoFallbackOnWeakData: true });
    const { pairings } = generateStyleAwarePairings(players, settings);
    expect(pairings[0].effectiveMode).toBe("sharp");
  });

  it("falls back to balanced mode for low-confidence players in sharp mode", () => {
    const players = [
      makePlayer("a", 1800, { confidence: 0.05 }),
      makePlayer("b", 1750, { confidence: 0.05 }),
    ];
    const settings = makeSettings({ mode: "sharp", autoFallbackOnWeakData: true });
    const { pairings } = generateStyleAwarePairings(players, settings);
    expect(pairings[0].effectiveMode).toBe("balanced");
  });
});

// ─── assessPoolReadiness ──────────────────────────────────────────────────────

describe("assessPoolReadiness", () => {
  it("returns 'ready' overall status when most players have strong profiles", () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      makePlayer(`p${i}`, 1500 + i * 50, { confidence: 0.9 })
    );
    const result = assessPoolReadiness(players);
    expect(result.overallStatus).toBe("ready");
    expect(result.readyPct).toBeGreaterThanOrEqual(70);
  });

  it("returns 'fallback' overall status when no players have style data", () => {
    const players: StylePairingPlayer[] = [
      { id: "a", name: "A", elo: 1500, styleProfile: undefined },
      { id: "b", name: "B", elo: 1600, styleProfile: undefined },
    ];
    const result = assessPoolReadiness(players);
    expect(result.overallStatus).toBe("fallback");
    expect(result.fallbackCount).toBe(2);
  });

  it("correctly counts ready, limited, and fallback players", () => {
    const players: StylePairingPlayer[] = [
      makePlayer("a", 1500, { confidence: 0.9 }),  // ready
      makePlayer("b", 1500, { confidence: 0.5 }),  // limited
      { id: "c", name: "C", elo: 1500, styleProfile: undefined },  // fallback
    ];
    const result = assessPoolReadiness(players);
    expect(result.readyCount).toBe(1);
    expect(result.limitedCount).toBe(1);
    expect(result.fallbackCount).toBe(1);
  });

  it("handles empty player list without error", () => {
    const result = assessPoolReadiness([]);
    expect(result.readyPct).toBe(0);
    expect(result.overallStatus).toBe("fallback");
  });
});

// ─── PAIRING_MODES config ─────────────────────────────────────────────────────

describe("PAIRING_MODES config", () => {
  it("balanced mode has highest eloWeight", () => {
    expect(PAIRING_MODES.balanced.eloWeight).toBeGreaterThan(
      PAIRING_MODES.style_aware.eloWeight
    );
    expect(PAIRING_MODES.balanced.eloWeight).toBeGreaterThan(
      PAIRING_MODES.sharp.eloWeight
    );
  });

  it("sharp mode has highest dynamismWeight", () => {
    expect(PAIRING_MODES.sharp.dynamismWeight).toBeGreaterThan(
      PAIRING_MODES.balanced.dynamismWeight
    );
    expect(PAIRING_MODES.sharp.dynamismWeight).toBeGreaterThan(
      PAIRING_MODES.style_aware.dynamismWeight
    );
  });

  it("all modes have labels and descriptions", () => {
    for (const mode of Object.values(PAIRING_MODES)) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
      expect(mode.tagline.length).toBeGreaterThan(0);
    }
  });

  it("all weight components are between 0 and 1", () => {
    for (const mode of Object.values(PAIRING_MODES)) {
      expect(mode.eloWeight).toBeGreaterThanOrEqual(0);
      expect(mode.eloWeight).toBeLessThanOrEqual(1);
      expect(mode.styleWeight).toBeGreaterThanOrEqual(0);
      expect(mode.styleWeight).toBeLessThanOrEqual(1);
      expect(mode.dynamismWeight).toBeGreaterThanOrEqual(0);
      expect(mode.dynamismWeight).toBeLessThanOrEqual(1);
    }
  });
});

// ─── buildPairingExplanation ──────────────────────────────────────────────────

describe("buildPairingExplanation", () => {
  it("returns a label string for all modes", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1520);
    for (const mode of ["balanced", "style_aware", "sharp"] as const) {
      const expl = buildPairingExplanation(a, b, 20, 0.6, 0.7, mode, mode);
      expect(expl.label.length).toBeGreaterThan(0);
    }
  });

  it("includes 'Near-identical rating' chip for small Elo gap", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1530);
    const expl = buildPairingExplanation(a, b, 30, 0.5, 0.5, "balanced", "balanced");
    expect(expl.chips).toContain("Near-identical rating");
  });

  it("includes confidence note when style data is absent", () => {
    const a: StylePairingPlayer = { id: "a", name: "A", elo: 1500 };
    const b: StylePairingPlayer = { id: "b", name: "B", elo: 1520 };
    const expl = buildPairingExplanation(a, b, 20, 0.5, 0.5, "style_aware", "style_aware");
    expect(expl.confidenceNote).toBeTruthy();
  });

  it("notes fallback when effectiveMode differs from requested mode", () => {
    const a = makePlayer("a", 1500);
    const b = makePlayer("b", 1520);
    const expl = buildPairingExplanation(a, b, 20, 0.5, 0.5, "sharp", "balanced");
    expect(expl.label).toMatch(/fallback/i);
  });
});
