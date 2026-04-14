/**
 * Tests for the weaknessScore exploitability badge logic in the Scout tab
 * Covers: badge tier thresholds, display rules, and score computation
 */
import { describe, it, expect } from "vitest";

// Mirror the badge tier logic from MatchupPrep.tsx
type BadgeTier = "high-exploit" | "moderate" | "none";

function getBadgeTier(weaknessScore: number): BadgeTier {
  if (weaknessScore >= 70) return "high-exploit";
  if (weaknessScore >= 40) return "moderate";
  return "none";
}

// Mirror the computeWeaknessScore logic from prepEngine.ts
function computeWeaknessScore(opts: {
  count: number;
  totalGames: number;
  winRate: number;
}): number {
  const { count, totalGames, winRate } = opts;
  const freqScore = Math.min(50, (count / Math.max(1, totalGames)) * 200);
  const winRatePenalty = Math.max(0, 0.5 - winRate / 100);
  const weaknessScore = Math.min(50, winRatePenalty * 100);
  return Math.round(freqScore + weaknessScore);
}

describe("weaknessScore badge tier thresholds", () => {
  it("returns 'high-exploit' for score >= 70", () => {
    expect(getBadgeTier(70)).toBe("high-exploit");
    expect(getBadgeTier(85)).toBe("high-exploit");
    expect(getBadgeTier(100)).toBe("high-exploit");
  });

  it("returns 'moderate' for score 40–69", () => {
    expect(getBadgeTier(40)).toBe("moderate");
    expect(getBadgeTier(55)).toBe("moderate");
    expect(getBadgeTier(69)).toBe("moderate");
  });

  it("returns 'none' for score < 40", () => {
    expect(getBadgeTier(0)).toBe("none");
    expect(getBadgeTier(20)).toBe("none");
    expect(getBadgeTier(39)).toBe("none");
  });

  it("boundary: score exactly 40 is 'moderate' not 'none'", () => {
    expect(getBadgeTier(40)).toBe("moderate");
  });

  it("boundary: score exactly 70 is 'high-exploit' not 'moderate'", () => {
    expect(getBadgeTier(70)).toBe("high-exploit");
  });
});

describe("weaknessScore computation", () => {
  it("high frequency + low win rate = high score", () => {
    const score = computeWeaknessScore({ count: 20, totalGames: 50, winRate: 20 });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(getBadgeTier(score)).toBe("high-exploit");
  });

  it("low frequency + high win rate = low score", () => {
    const score = computeWeaknessScore({ count: 2, totalGames: 50, winRate: 70 });
    expect(score).toBeLessThan(40);
    expect(getBadgeTier(score)).toBe("none");
  });

  it("moderate frequency + moderate win rate = moderate score", () => {
    const score = computeWeaknessScore({ count: 10, totalGames: 50, winRate: 45 });
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(70);
    expect(getBadgeTier(score)).toBe("moderate");
  });

  it("score is always in range 0–100", () => {
    const cases = [
      { count: 0, totalGames: 50, winRate: 0 },
      { count: 50, totalGames: 50, winRate: 0 },
      { count: 50, totalGames: 50, winRate: 100 },
      { count: 1, totalGames: 1, winRate: 50 },
    ];
    cases.forEach(c => {
      const score = computeWeaknessScore(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  it("zero games does not throw", () => {
    expect(() => computeWeaknessScore({ count: 0, totalGames: 0, winRate: 0 })).not.toThrow();
  });
});

describe("badge display rules", () => {
  it("only one badge is shown per opening (tiers are mutually exclusive)", () => {
    const scores = [0, 25, 39, 40, 55, 69, 70, 85, 100];
    scores.forEach(score => {
      const tier = getBadgeTier(score);
      const showHigh = tier === "high-exploit";
      const showModerate = tier === "moderate";
      // At most one badge is shown
      expect(showHigh && showModerate).toBe(false);
    });
  });

  it("no badge shown for strong openings (score < 40)", () => {
    [0, 10, 20, 39].forEach(score => {
      expect(getBadgeTier(score)).toBe("none");
    });
  });
});
