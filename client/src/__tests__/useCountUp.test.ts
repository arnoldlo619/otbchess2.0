/**
 * Tests for the useCountUp hook logic.
 * We test the easeOutExpo math and number formatting in isolation,
 * since the hook itself relies on requestAnimationFrame timing.
 */
import { describe, it, expect } from "vitest";

// Pure easeOutExpo extracted from the hook for unit testing
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Number formatter used inside the hook
function formatValue(current: number, _target: number, decimals: number, suffix: string): string {
  const fmt = decimals > 0
    ? current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.floor(current).toLocaleString("en-US");
  return `${fmt}${suffix}`;
}

describe("easeOutExpo", () => {
  it("returns 0 at t=0", () => {
    expect(easeOutExpo(0)).toBeCloseTo(0, 5);
  });

  it("returns 1 at t=1", () => {
    expect(easeOutExpo(1)).toBe(1);
  });

  it("is monotonically increasing", () => {
    const values = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(easeOutExpo);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("is concave — covers more than half the range by t=0.5", () => {
    const mid = easeOutExpo(0.5);
    const end = easeOutExpo(1);
    expect(mid).toBeGreaterThan(end / 2);
  });
});

describe("formatValue", () => {
  it("formats integer stats with commas and suffix", () => {
    expect(formatValue(2400, 2400, 0, "+")).toBe("2,400+");
    expect(formatValue(18000, 18000, 0, "+")).toBe("18,000+");
    expect(formatValue(200, 200, 0, "+")).toBe("200+");
  });

  it("formats decimal stats with correct precision and suffix", () => {
    expect(formatValue(4.9, 4.9, 1, "\u2605")).toBe("4.9\u2605");
  });

  it("floors mid-animation integers", () => {
    expect(formatValue(1234.7, 2400, 0, "+")).toBe("1,234+");
  });

  it("clamps decimal display at specified precision", () => {
    expect(formatValue(4.567, 4.9, 1, "\u2605")).toBe("4.6\u2605");
  });

  it("handles zero correctly", () => {
    expect(formatValue(0, 2400, 0, "+")).toBe("0+");
    expect(formatValue(0, 4.9, 1, "\u2605")).toBe("0.0\u2605");
  });
});

describe("count-up animation progress", () => {
  it("reaches target value at progress=1", () => {
    const target = 2400;
    const eased = easeOutExpo(1);
    const current = eased * target;
    expect(current).toBe(target);
  });

  it("starts near zero at progress=0.01", () => {
    const target = 18000;
    const eased = easeOutExpo(0.01);
    const current = eased * target;
    expect(current).toBeLessThan(target * 0.1);
  });

  it("covers more than 90% of range by progress=0.5", () => {
    const target = 200;
    const eased = easeOutExpo(0.5);
    const current = eased * target;
    expect(current).toBeGreaterThan(target * 0.9);
  });
});
