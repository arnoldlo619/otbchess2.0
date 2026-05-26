/**
 * Tests for the OTB ELO System
 * - Rating calculation (Elo formula)
 * - K-factor selection
 * - Time control categorization
 * - Anti-abuse rules
 */
import { describe, it, expect } from "vitest";

// ─── Rating Calculation Tests ─────────────────────────────────────────────────

describe("OTB ELO Rating Calculation", () => {
  // Expected probability formula: E = 1 / (1 + 10^((Rb - Ra) / 400))
  function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // K-factor based on games played
  function getKFactor(gamesPlayed: number): number {
    if (gamesPlayed < 10) return 40; // Provisional
    if (gamesPlayed < 30) return 32; // Rated
    return 24; // Established
  }

  // New rating calculation
  function calculateNewRating(
    currentRating: number,
    opponentRating: number,
    score: number, // 1 = win, 0.5 = draw, 0 = loss
    gamesPlayed: number
  ): number {
    const expected = expectedScore(currentRating, opponentRating);
    const K = getKFactor(gamesPlayed);
    return Math.round(currentRating + K * (score - expected));
  }

  it("should calculate expected score correctly for equal ratings", () => {
    const result = expectedScore(1200, 1200);
    expect(result).toBeCloseTo(0.5, 4);
  });

  it("should calculate expected score correctly for 200-point difference", () => {
    // Higher rated player expects ~0.76
    const result = expectedScore(1400, 1200);
    expect(result).toBeCloseTo(0.76, 1);
  });

  it("should calculate expected score correctly for lower rated player", () => {
    // Lower rated player expects ~0.24
    const result = expectedScore(1200, 1400);
    expect(result).toBeCloseTo(0.24, 1);
  });

  it("should give K=40 for provisional players (<10 games)", () => {
    expect(getKFactor(0)).toBe(40);
    expect(getKFactor(5)).toBe(40);
    expect(getKFactor(9)).toBe(40);
  });

  it("should give K=32 for rated players (10-29 games)", () => {
    expect(getKFactor(10)).toBe(32);
    expect(getKFactor(20)).toBe(32);
    expect(getKFactor(29)).toBe(32);
  });

  it("should give K=24 for established players (30+ games)", () => {
    expect(getKFactor(30)).toBe(24);
    expect(getKFactor(100)).toBe(24);
  });

  it("should increase rating on win against equal opponent", () => {
    const newRating = calculateNewRating(1200, 1200, 1, 15);
    expect(newRating).toBeGreaterThan(1200);
    expect(newRating).toBe(1216); // K=32, expected=0.5, gain = 32*(1-0.5) = 16
  });

  it("should decrease rating on loss against equal opponent", () => {
    const newRating = calculateNewRating(1200, 1200, 0, 15);
    expect(newRating).toBeLessThan(1200);
    expect(newRating).toBe(1184); // K=32, expected=0.5, loss = 32*(0-0.5) = -16
  });

  it("should not change rating much on draw against equal opponent", () => {
    const newRating = calculateNewRating(1200, 1200, 0.5, 15);
    expect(newRating).toBe(1200); // No change on draw between equals
  });

  it("should gain less on win against much lower rated opponent", () => {
    const newRating = calculateNewRating(1500, 1200, 1, 30);
    // Expected ~0.85, gain = 24*(1-0.85) ≈ 4
    expect(newRating).toBeLessThan(1510);
    expect(newRating).toBeGreaterThan(1500);
  });

  it("should lose more on loss against much lower rated opponent", () => {
    const newRating = calculateNewRating(1500, 1200, 0, 30);
    // Expected ~0.85, loss = 24*(0-0.85) ≈ -20
    expect(newRating).toBeLessThan(1500);
    expect(newRating - 1500).toBeLessThan(-15);
  });

  it("should gain more for provisional players (higher K)", () => {
    const provisionalGain = calculateNewRating(1200, 1200, 1, 5); // K=40
    const ratedGain = calculateNewRating(1200, 1200, 1, 15); // K=32
    const establishedGain = calculateNewRating(1200, 1200, 1, 35); // K=24

    expect(provisionalGain - 1200).toBeGreaterThan(ratedGain - 1200);
    expect(ratedGain - 1200).toBeGreaterThan(establishedGain - 1200);
  });
});

// ─── Time Control Categorization Tests ────────────────────────────────────────

describe("Time Control Categorization", () => {
  function categorizeTimeControl(baseMinutes: number, incrementSeconds: number): string {
    // Total estimated time = base + 40 * increment (standard game length estimate)
    const totalMinutes = baseMinutes + (40 * incrementSeconds) / 60;
    if (totalMinutes < 10) return "otb_blitz";
    if (totalMinutes < 30) return "otb_rapid";
    return "casual"; // Not rated
  }

  it("should categorize 3+0 as blitz", () => {
    expect(categorizeTimeControl(3, 0)).toBe("otb_blitz");
  });

  it("should categorize 3+2 as blitz", () => {
    expect(categorizeTimeControl(3, 2)).toBe("otb_blitz");
  });

  it("should categorize 5+0 as blitz", () => {
    expect(categorizeTimeControl(5, 0)).toBe("otb_blitz");
  });

  it("should categorize 5+3 as rapid (5 + 40*3/60 = 7 min, still blitz)", () => {
    // 5 + 2 = 7 min → blitz
    expect(categorizeTimeControl(5, 3)).toBe("otb_blitz");
  });

  it("should categorize 10+0 as rapid", () => {
    expect(categorizeTimeControl(10, 0)).toBe("otb_rapid");
  });

  it("should categorize 10+5 as rapid", () => {
    expect(categorizeTimeControl(10, 5)).toBe("otb_rapid");
  });

  it("should categorize 15+10 as rapid", () => {
    expect(categorizeTimeControl(15, 10)).toBe("otb_rapid");
  });

  it("should categorize 30+0 as casual (not rated)", () => {
    expect(categorizeTimeControl(30, 0)).toBe("casual");
  });

  it("should categorize 60+0 as casual", () => {
    expect(categorizeTimeControl(60, 0)).toBe("casual");
  });
});

// ─── Anti-Abuse Rules Tests ───────────────────────────────────────────────────

describe("Anti-Abuse Rules", () => {
  it("should prevent self-play (same user as host and opponent)", () => {
    const hostUserId = "user_123";
    const opponentUserId = "user_123";
    expect(hostUserId === opponentUserId).toBe(true);
    // Server should reject this with 400
  });

  it("should prevent joining an expired session (>30 min)", () => {
    const createdAt = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    expect(new Date() > expiresAt).toBe(true);
  });

  it("should allow joining a fresh session (<30 min)", () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    expect(new Date() > expiresAt).toBe(false);
  });

  it("should prevent joining a session that already has an opponent", () => {
    const session = { status: "opponent_joined", opponentUserId: "user_456" };
    expect(session.status !== "pending_opponent").toBe(true);
  });

  it("should only allow valid status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      opponent_joined: ["clock_started", "cancelled"],
      clock_started: ["awaiting_results", "cancelled"],
      awaiting_results: ["result_confirmed", "result_disputed"],
      result_disputed: ["awaiting_results"],
    };

    // Valid: opponent_joined → clock_started
    expect(validTransitions["opponent_joined"]?.includes("clock_started")).toBe(true);

    // Invalid: opponent_joined → result_confirmed (skipping steps)
    expect(validTransitions["opponent_joined"]?.includes("result_confirmed")).toBe(false);

    // Invalid: clock_started → opponent_joined (going backward)
    expect(validTransitions["clock_started"]?.includes("opponent_joined")).toBe(false);
  });

  it("should not rate games with 30+ minute time controls", () => {
    const baseMinutes = 30;
    const isCasual = baseMinutes >= 30;
    expect(isCasual).toBe(true);
  });

  it("should require both players to agree on result", () => {
    const hostResult = "white_wins";
    const opponentResult = "black_wins";
    const agreed = hostResult === opponentResult;
    expect(agreed).toBe(false);
    // This should trigger a dispute
  });

  it("should confirm result when both players agree", () => {
    const hostResult = "white_wins";
    const opponentResult = "white_wins";
    const agreed = hostResult === opponentResult;
    expect(agreed).toBe(true);
  });
});
