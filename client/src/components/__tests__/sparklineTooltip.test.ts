/**
 * Unit tests for sparkline tooltip helper functions.
 *
 * These test the pure logic used by the Sparkline component:
 *   - formatDate: Unix-ms → "Mon DD" string
 *   - Tooltip x-position flip logic (left vs right of dot)
 *   - Tooltip y-position clamping (never above SVG top)
 *   - Result label mapping (win / draw / loss)
 */

import { describe, it, expect } from "vitest";

// ─── Replicate helpers from PlayerProfileCard (pure functions) ────────────────

function formatDate(ms: number): string {
  if (!ms) return "Unknown date";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tooltipX(dotX: number, tooltipW: number, svgWidth: number): number {
  return dotX + tooltipW > svgWidth ? dotX - tooltipW - 4 : dotX + 6;
}

function tooltipY(dotY: number): number {
  return Math.max(0, dotY - 28);
}

function resultLabel(result: "win" | "draw" | "loss"): string {
  return result === "win" ? "Win" : result === "loss" ? "Loss" : "Draw";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns 'Unknown date' for zero timestamp", () => {
    expect(formatDate(0)).toBe("Unknown date");
  });

  it("formats a known date correctly", () => {
    // Use noon UTC to avoid timezone-related day shifts
    const ts = new Date("2026-02-18T12:00:00Z").getTime();
    const result = formatDate(ts);
    // The result depends on locale, but should contain "Feb" and "18"
    expect(result).toMatch(/Feb/i);
    expect(result).toMatch(/18/);
  });

  it("formats Dec 1 correctly", () => {
    const ts = new Date("2025-12-01T12:00:00Z").getTime();
    const result = formatDate(ts);
    expect(result).toMatch(/Dec/i);
    expect(result).toMatch(/1/);
  });

  it("returns a non-empty string for any positive timestamp", () => {
    expect(formatDate(Date.now()).length).toBeGreaterThan(0);
  });
});

describe("tooltipX positioning", () => {
  const svgWidth = 224;
  const tooltipW = 80;

  it("places tooltip to the right of the dot when there is room", () => {
    // dot at x=100, tooltip needs 80px, right edge = 100+80 = 180 < 224 → right
    const x = tooltipX(100, tooltipW, svgWidth);
    expect(x).toBe(106); // 100 + 6
  });

  it("flips tooltip to the left when near the right edge", () => {
    // dot at x=180, 180+80 = 260 > 224 → flip left
    const x = tooltipX(180, tooltipW, svgWidth);
    expect(x).toBe(180 - tooltipW - 4); // 96
  });

  it("flips when dot is exactly at the boundary (equal → right side, no flip)", () => {
    // dot at x=144, 144+80 = 224 = svgWidth → NOT strictly greater, so no flip
    const x = tooltipX(144, tooltipW, svgWidth);
    expect(x).toBe(144 + 6); // 150
  });

  it("flips when tooltip would overflow by 1px", () => {
    // dot at x=145, 145+80 = 225 > 224 → flip left
    const x = tooltipX(145, tooltipW, svgWidth);
    expect(x).toBe(145 - tooltipW - 4); // 61
  });

  it("does not flip when dot is just inside the boundary", () => {
    // dot at x=143, 143+80 = 223 < 224 → right
    const x = tooltipX(143, tooltipW, svgWidth);
    expect(x).toBe(149); // 143 + 6
  });
});

describe("tooltipY positioning", () => {
  it("places tooltip 28px above the dot normally", () => {
    expect(tooltipY(40)).toBe(12); // 40 - 28 = 12
  });

  it("clamps to 0 when dot is near the top", () => {
    expect(tooltipY(10)).toBe(0); // 10 - 28 = -18 → clamped to 0
  });

  it("clamps to 0 when dot is at y=0", () => {
    expect(tooltipY(0)).toBe(0);
  });

  it("returns 0 for very small y values", () => {
    expect(tooltipY(5)).toBe(0);
  });
});

describe("resultLabel", () => {
  it("returns 'Win' for win", () => {
    expect(resultLabel("win")).toBe("Win");
  });

  it("returns 'Loss' for loss", () => {
    expect(resultLabel("loss")).toBe("Loss");
  });

  it("returns 'Draw' for draw", () => {
    expect(resultLabel("draw")).toBe("Draw");
  });
});

describe("sparkline data integrity", () => {
  it("tooltip width constant is positive", () => {
    const TOOLTIP_W = 80;
    expect(TOOLTIP_W).toBeGreaterThan(0);
  });

  it("tooltipX always returns a finite number", () => {
    for (const dotX of [0, 50, 100, 150, 200, 224]) {
      const x = tooltipX(dotX, 80, 224);
      expect(isFinite(x)).toBe(true);
    }
  });

  it("tooltipY always returns a non-negative number", () => {
    for (const dotY of [0, 6, 28, 44, 100]) {
      const y = tooltipY(dotY);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });
});
