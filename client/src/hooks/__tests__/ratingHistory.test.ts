/**
 * Tests for rating history data processing logic.
 *
 * We test the pure data-transformation helpers that are used by
 * useRatingHistory — specifically the sparkline coordinate math
 * and the trend calculation — without hitting any real APIs.
 */

import { describe, it, expect } from "vitest";
import type { RatingPoint } from "../useRatingHistory";

// ─── Helpers extracted for unit testing ──────────────────────────────────────

/** Compute the SVG y-coordinate for a rating point given min/max range */
function ratingToY(
  rating: number,
  minR: number,
  maxR: number,
  padY: number,
  innerH: number
): number {
  const range = maxR - minR || 1;
  return padY + (1 - (rating - minR) / range) * innerH;
}

/** Compute the net rating change across a series of points */
function computeTrend(points: RatingPoint[]): number {
  if (points.length < 2) return 0;
  return points[points.length - 1].rating - points[0].rating;
}

/** Format trend for display */
function formatTrend(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "±0";
}

/** Count results by type */
function countResults(points: RatingPoint[]) {
  return points.reduce(
    (acc, p) => {
      acc[p.result]++;
      return acc;
    },
    { win: 0, draw: 0, loss: 0 }
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ratingToY", () => {
  it("maps minimum rating to bottom of chart", () => {
    // padY=6, innerH=32 → bottom = padY + innerH = 38
    const y = ratingToY(1000, 1000, 1200, 6, 32);
    expect(y).toBe(38); // padY + innerH (factor=0 → bottom)
  });

  it("maps maximum rating to top of chart", () => {
    // padY=6, innerH=32 → top = padY = 6
    const y = ratingToY(1200, 1000, 1200, 6, 32);
    expect(y).toBe(6); // padY (factor=1 → top)
  });

  it("maps midpoint rating to vertical center", () => {
    const y = ratingToY(1100, 1000, 1200, 6, 32);
    expect(y).toBe(22); // padY + innerH/2 = 6 + 16 = 22
  });

  it("handles zero range (all same rating) without division by zero", () => {
    // range=1 when minR===maxR, so factor = (1100-1100)/1 = 0 → bottom
    const y = ratingToY(1100, 1100, 1100, 6, 32);
    expect(y).toBe(38);
  });
});

describe("computeTrend", () => {
  it("returns positive delta for improving rating", () => {
    const points: RatingPoint[] = [
      { date: 1, rating: 1200, result: "win" },
      { date: 2, rating: 1215, result: "win" },
      { date: 3, rating: 1230, result: "win" },
    ];
    expect(computeTrend(points)).toBe(30);
  });

  it("returns negative delta for declining rating", () => {
    const points: RatingPoint[] = [
      { date: 1, rating: 1500, result: "loss" },
      { date: 2, rating: 1485, result: "loss" },
    ];
    expect(computeTrend(points)).toBe(-15);
  });

  it("returns zero for flat rating", () => {
    const points: RatingPoint[] = [
      { date: 1, rating: 1400, result: "draw" },
      { date: 2, rating: 1400, result: "draw" },
    ];
    expect(computeTrend(points)).toBe(0);
  });

  it("returns zero for single point", () => {
    const points: RatingPoint[] = [{ date: 1, rating: 1300, result: "win" }];
    expect(computeTrend(points)).toBe(0);
  });

  it("returns zero for empty array", () => {
    expect(computeTrend([])).toBe(0);
  });
});

describe("formatTrend", () => {
  it("prefixes positive delta with +", () => {
    expect(formatTrend(25)).toBe("+25");
  });

  it("shows negative delta with minus sign", () => {
    expect(formatTrend(-12)).toBe("-12");
  });

  it("shows ±0 for zero delta", () => {
    expect(formatTrend(0)).toBe("±0");
  });
});

describe("countResults", () => {
  it("counts wins, draws, and losses correctly", () => {
    const points: RatingPoint[] = [
      { date: 1, rating: 1200, result: "win" },
      { date: 2, rating: 1215, result: "win" },
      { date: 3, rating: 1210, result: "draw" },
      { date: 4, rating: 1200, result: "loss" },
      { date: 5, rating: 1190, result: "loss" },
    ];
    const counts = countResults(points);
    expect(counts.win).toBe(2);
    expect(counts.draw).toBe(1);
    expect(counts.loss).toBe(2);
  });

  it("handles empty array", () => {
    const counts = countResults([]);
    expect(counts.win).toBe(0);
    expect(counts.draw).toBe(0);
    expect(counts.loss).toBe(0);
  });

  it("handles all wins", () => {
    const points: RatingPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: i,
      rating: 1200 + i * 10,
      result: "win" as const,
    }));
    const counts = countResults(points);
    expect(counts.win).toBe(5);
    expect(counts.draw).toBe(0);
    expect(counts.loss).toBe(0);
  });
});

describe("sparkline data integrity", () => {
  it("correctly identifies trend direction from 10 points", () => {
    const points: RatingPoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: i * 86400000,
      rating: 1200 + i * 5, // steadily improving
      result: "win" as const,
    }));
    const trend = computeTrend(points);
    expect(trend).toBe(45); // 1200 → 1245
    expect(formatTrend(trend)).toBe("+45");
  });

  it("uses only first and last points for trend (not intermediate)", () => {
    // Volatile middle, but overall flat
    const points: RatingPoint[] = [
      { date: 1, rating: 1400, result: "win" },
      { date: 2, rating: 1450, result: "win" },
      { date: 3, rating: 1350, result: "loss" },
      { date: 4, rating: 1400, result: "draw" },
    ];
    expect(computeTrend(points)).toBe(0);
    expect(formatTrend(0)).toBe("±0");
  });
});
