// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { recommendedRounds, roundsHint, roundRangeLabel } from "../recommendedRounds";

// ── recommendedRounds ──────────────────────────────────────────────────────────

describe("recommendedRounds", () => {
  it("returns 3 for fewer than 2 players", () => {
    expect(recommendedRounds(0)).toBe(3);
    expect(recommendedRounds(1)).toBe(3);
  });

  it("returns 3 for 2 players (ceil(log2(2)) = 1, clamped to 3)", () => {
    expect(recommendedRounds(2)).toBe(3);
  });

  it("returns 3 for 4 players (ceil(log2(4)) = 2, clamped to 3)", () => {
    expect(recommendedRounds(4)).toBe(3);
  });

  it("returns 3 for 5 players (ceil(log2(5)) = 3)", () => {
    expect(recommendedRounds(5)).toBe(3);
  });

  it("returns 4 for 9 players (ceil(log2(9)) = 4)", () => {
    expect(recommendedRounds(9)).toBe(4);
  });

  it("returns 4 for 16 players (ceil(log2(16)) = 4)", () => {
    expect(recommendedRounds(16)).toBe(4);
  });

  it("returns 5 for 17 players (ceil(log2(17)) = 5)", () => {
    expect(recommendedRounds(17)).toBe(5);
  });

  it("returns 5 for 32 players (ceil(log2(32)) = 5)", () => {
    expect(recommendedRounds(32)).toBe(5);
  });

  it("returns 6 for 33 players (ceil(log2(33)) = 6)", () => {
    expect(recommendedRounds(33)).toBe(6);
  });

  it("returns 7 for 65 players (ceil(log2(65)) = 7)", () => {
    expect(recommendedRounds(65)).toBe(7);
  });

  it("clamps to 11 for very large player counts", () => {
    expect(recommendedRounds(10000)).toBe(11);
  });

  it("returns 11 for 2048 players (ceil(log2(2048)) = 11)", () => {
    expect(recommendedRounds(2048)).toBe(11);
  });
});

// ── roundsHint ────────────────────────────────────────────────────────────────

describe("roundsHint", () => {
  it("returns a simple label for fewer than 2 players", () => {
    const hint = roundsHint(1, 5);
    expect(hint).toContain("5 rounds selected");
  });

  it("returns 'Optimal' when selected rounds equals recommended", () => {
    // 16 players → optimal = 4
    const hint = roundsHint(16, 4);
    expect(hint).toMatch(/optimal/i);
    expect(hint).toContain("16 players");
  });

  it("returns a 'fewer than recommended' message when rounds is too low", () => {
    // 16 players → optimal = 4; selecting 3 is below optimal
    const hint = roundsHint(16, 3);
    expect(hint).toMatch(/fewer than recommended/i);
    expect(hint).toContain("16 players");
  });

  it("mentions the deficit count when rounds is too low", () => {
    // 32 players → optimal = 5; selecting 3 is 2 below optimal
    const hint = roundsHint(32, 3);
    expect(hint).toContain("2 fewer");
  });

  it("returns a 'more than needed' message when rounds exceeds optimal", () => {
    // 8 players → optimal = 3; selecting 7 is above optimal
    const hint = roundsHint(8, 7);
    expect(hint).toMatch(/more than needed/i);
  });

  it("includes the max-clear player count in the 'more than needed' message", () => {
    // 7 rounds → maxClear = 2^6 = 64
    const hint = roundsHint(8, 7);
    expect(hint).toContain("64");
  });

  it("returns 'Optimal' for 5 rounds with 17–32 players", () => {
    expect(roundsHint(20, 5)).toMatch(/optimal/i);
    expect(roundsHint(32, 5)).toMatch(/optimal/i);
  });
});

// ── roundRangeLabel ───────────────────────────────────────────────────────────

describe("roundRangeLabel", () => {
  it("returns 'Up to 4 players' for 3 rounds", () => {
    expect(roundRangeLabel(3)).toBe("Up to 4 players");
  });

  it("returns a range string for 4 rounds", () => {
    const label = roundRangeLabel(4);
    expect(label).toMatch(/\d+–\d+ players/);
  });

  it("returns a range string for 5 rounds", () => {
    const label = roundRangeLabel(5);
    expect(label).toMatch(/\d+–\d+ players/);
  });

  it("returns a range string for 7 rounds", () => {
    const label = roundRangeLabel(7);
    expect(label).toMatch(/\d+–\d+ players/);
  });

  it("upper bound of range for 5 rounds is 16", () => {
    // hi = 2^(5-1) = 16
    expect(roundRangeLabel(5)).toContain("16");
  });

  it("upper bound of range for 6 rounds is 32", () => {
    // hi = 2^(6-1) = 32
    expect(roundRangeLabel(6)).toContain("32");
  });
});
