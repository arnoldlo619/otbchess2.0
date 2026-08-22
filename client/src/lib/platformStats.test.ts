import { describe, expect, it } from "vitest";
import { normalizePlatformStats, PLATFORM_STATS_FLOORS } from "./platformStats";

describe("normalizePlatformStats", () => {
  it("never exposes zero or missing values below the published floors", () => {
    expect(normalizePlatformStats({ tournaments: 0, players: 0, clubs: 0 })).toEqual(PLATFORM_STATS_FLOORS);
    expect(normalizePlatformStats(null)).toEqual(PLATFORM_STATS_FLOORS);
  });

  it("preserves real counts that exceed the published floors", () => {
    expect(normalizePlatformStats({ tournaments: 420, players: 900, clubs: 125 })).toEqual({
      tournaments: 420,
      players: 900,
      clubs: 125,
    });
  });

  it("applies floors independently when only some counts are available", () => {
    expect(normalizePlatformStats({ tournaments: 450 })).toEqual({
      tournaments: 450,
      players: 550,
      clubs: 80,
    });
  });
});
