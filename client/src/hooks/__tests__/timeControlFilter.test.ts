/**
 * Unit tests for time-control classification and client-side filtering logic
 * used by useRatingHistory.
 *
 * Tests cover:
 *   - classifyChessComTC: time_class field and fallback time_control string
 *   - classifyLichessPerf: perf field mapping
 *   - Client-side filtering: "all" returns last N, specific TC filters correctly
 */

import { describe, it, expect } from "vitest";
import type { RatingPoint, TimeControl } from "../useRatingHistory";

// ─── Replicate pure helpers from the hook ────────────────────────────────────

function classifyChessComTC(
  timeClass: string | undefined,
  timeControlStr: string | undefined
): Exclude<TimeControl, "all"> {
  if (timeClass) {
    const tc = timeClass.toLowerCase();
    if (tc === "bullet") return "bullet";
    if (tc === "blitz") return "blitz";
    if (tc === "rapid") return "rapid";
    if (tc === "classical" || tc === "daily") return "classical";
  }
  if (timeControlStr) {
    const base = parseInt(timeControlStr.split("+")[0], 10);
    if (!isNaN(base)) {
      if (base < 180) return "bullet";
      if (base < 540) return "blitz";
      if (base < 1800) return "rapid";
      return "classical";
    }
  }
  return "rapid";
}

function classifyLichessPerf(perf: string | undefined): Exclude<TimeControl, "all"> {
  if (!perf) return "rapid";
  const p = perf.toLowerCase();
  if (p === "bullet" || p === "ultrabullet") return "bullet";
  if (p === "blitz") return "blitz";
  if (p === "rapid") return "rapid";
  if (p === "classical" || p === "correspondence") return "classical";
  return "rapid";
}

function filterPoints(
  allPoints: RatingPoint[],
  timeControl: TimeControl,
  count: number
): RatingPoint[] {
  return timeControl === "all"
    ? allPoints.slice(-count)
    : allPoints.filter((p) => p.timeControl === timeControl).slice(-count);
}

// ─── chess.com TC classification ─────────────────────────────────────────────

describe("classifyChessComTC — time_class field", () => {
  it("classifies 'bullet' correctly", () => {
    expect(classifyChessComTC("bullet", undefined)).toBe("bullet");
  });

  it("classifies 'blitz' correctly", () => {
    expect(classifyChessComTC("blitz", undefined)).toBe("blitz");
  });

  it("classifies 'rapid' correctly", () => {
    expect(classifyChessComTC("rapid", undefined)).toBe("rapid");
  });

  it("classifies 'classical' correctly", () => {
    expect(classifyChessComTC("classical", undefined)).toBe("classical");
  });

  it("classifies 'daily' as classical", () => {
    expect(classifyChessComTC("daily", undefined)).toBe("classical");
  });

  it("is case-insensitive", () => {
    expect(classifyChessComTC("BLITZ", undefined)).toBe("blitz");
    expect(classifyChessComTC("Rapid", undefined)).toBe("rapid");
  });
});

describe("classifyChessComTC — time_control string fallback", () => {
  it("classifies 60s as bullet", () => {
    expect(classifyChessComTC(undefined, "60")).toBe("bullet");
  });

  it("classifies 120s as bullet", () => {
    expect(classifyChessComTC(undefined, "120")).toBe("bullet");
  });

  it("classifies 179s as bullet (boundary)", () => {
    expect(classifyChessComTC(undefined, "179")).toBe("bullet");
  });

  it("classifies 180s as blitz (boundary)", () => {
    expect(classifyChessComTC(undefined, "180")).toBe("blitz");
  });

  it("classifies 300s (5 min) as blitz", () => {
    expect(classifyChessComTC(undefined, "300")).toBe("blitz");
  });

  it("classifies 539s as blitz (boundary)", () => {
    expect(classifyChessComTC(undefined, "539")).toBe("blitz");
  });

  it("classifies 540s (9 min) as rapid (boundary)", () => {
    expect(classifyChessComTC(undefined, "540")).toBe("rapid");
  });

  it("classifies 600s (10 min) as rapid", () => {
    expect(classifyChessComTC(undefined, "600")).toBe("rapid");
  });

  it("classifies 600+5 as rapid (ignores increment)", () => {
    expect(classifyChessComTC(undefined, "600+5")).toBe("rapid");
  });

  it("classifies 1799s as rapid (boundary)", () => {
    expect(classifyChessComTC(undefined, "1799")).toBe("rapid");
  });

  it("classifies 1800s (30 min) as classical (boundary)", () => {
    expect(classifyChessComTC(undefined, "1800")).toBe("classical");
  });

  it("classifies 3600s (60 min) as classical", () => {
    expect(classifyChessComTC(undefined, "3600")).toBe("classical");
  });

  it("returns 'rapid' as default when both args are undefined", () => {
    expect(classifyChessComTC(undefined, undefined)).toBe("rapid");
  });
});

// ─── Lichess perf classification ─────────────────────────────────────────────

describe("classifyLichessPerf", () => {
  it("classifies 'bullet' correctly", () => {
    expect(classifyLichessPerf("bullet")).toBe("bullet");
  });

  it("classifies 'ultraBullet' as bullet (case-insensitive)", () => {
    // The hook lowercases before comparing, so 'ultraBullet' → 'ultrabullet' matches
    expect(classifyLichessPerf("ultraBullet")).toBe("bullet");
  });

  it("classifies 'blitz' correctly", () => {
    expect(classifyLichessPerf("blitz")).toBe("blitz");
  });

  it("classifies 'rapid' correctly", () => {
    expect(classifyLichessPerf("rapid")).toBe("rapid");
  });

  it("classifies 'classical' correctly", () => {
    expect(classifyLichessPerf("classical")).toBe("classical");
  });

  it("classifies 'correspondence' as classical", () => {
    expect(classifyLichessPerf("correspondence")).toBe("classical");
  });

  it("returns 'rapid' as default for unknown perf", () => {
    expect(classifyLichessPerf("chess960")).toBe("rapid");
  });

  it("returns 'rapid' when perf is undefined", () => {
    expect(classifyLichessPerf(undefined)).toBe("rapid");
  });
});

// ─── Client-side filtering ────────────────────────────────────────────────────

function makePoint(tc: Exclude<TimeControl, "all">, rating = 1500): RatingPoint {
  return { date: Date.now(), rating, result: "draw", timeControl: tc };
}

describe("filterPoints — client-side time-control filtering", () => {
  const mixed: RatingPoint[] = [
    makePoint("rapid", 1400),
    makePoint("blitz", 1450),
    makePoint("bullet", 1300),
    makePoint("rapid", 1420),
    makePoint("blitz", 1460),
    makePoint("rapid", 1430),
    makePoint("bullet", 1310),
    makePoint("blitz", 1470),
    makePoint("rapid", 1440),
    makePoint("rapid", 1450),
    makePoint("blitz", 1480),
    makePoint("bullet", 1320),
  ];

  it("'all' returns the last N points regardless of TC", () => {
    const result = filterPoints(mixed, "all", 10);
    expect(result).toHaveLength(10);
    expect(result).toEqual(mixed.slice(-10));
  });

  it("'rapid' returns only rapid games, last N", () => {
    const result = filterPoints(mixed, "rapid", 10);
    expect(result.every((p) => p.timeControl === "rapid")).toBe(true);
  });

  it("'blitz' returns only blitz games", () => {
    const result = filterPoints(mixed, "blitz", 10);
    expect(result.every((p) => p.timeControl === "blitz")).toBe(true);
  });

  it("'bullet' returns only bullet games", () => {
    const result = filterPoints(mixed, "bullet", 10);
    expect(result.every((p) => p.timeControl === "bullet")).toBe(true);
  });

  it("respects the count limit when filtering", () => {
    const result = filterPoints(mixed, "rapid", 3);
    expect(result).toHaveLength(3);
  });

  it("returns fewer than count when not enough games of that TC", () => {
    const result = filterPoints(mixed, "classical", 10);
    expect(result).toHaveLength(0);
  });

  it("'all' with count=5 returns last 5 games", () => {
    const result = filterPoints(mixed, "all", 5);
    expect(result).toHaveLength(5);
    expect(result).toEqual(mixed.slice(-5));
  });

  it("returns empty array when allPoints is empty", () => {
    expect(filterPoints([], "all", 10)).toHaveLength(0);
    expect(filterPoints([], "rapid", 10)).toHaveLength(0);
  });
});
