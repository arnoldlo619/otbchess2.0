import { describe, expect, it } from "vitest";
import { normalizePlatformStats } from "./platformStats";

describe("normalizePlatformStats", () => {
  it("preserves real zero counts instead of inflating platform activity", () => {
    expect(normalizePlatformStats({ tournaments: 0, players: 0, clubs: 0 })).toEqual({
      tournaments: 0,
      players: 0,
      clubs: 0,
    });
    expect(normalizePlatformStats(null)).toEqual({ tournaments: 0, players: 0, clubs: 0 });
  });

  it("preserves real counts that exceed the published floors", () => {
    expect(normalizePlatformStats({ tournaments: 420, players: 900, clubs: 125 })).toEqual({
      tournaments: 420,
      players: 900,
      clubs: 125,
    });
  });

  it("normalizes missing, negative, and fractional values conservatively", () => {
    expect(normalizePlatformStats({ tournaments: 450.9, players: -5 })).toEqual({
      tournaments: 450,
      players: 0,
      clubs: 0,
    });
  });
});
