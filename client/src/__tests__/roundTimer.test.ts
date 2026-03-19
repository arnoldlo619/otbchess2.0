/**
 * Unit tests for RoundTimer logic helpers
 * Tests the pure functions: time formatting, progress calculation, warning threshold
 */

import { describe, it, expect } from "vitest";

// ── Pure helpers extracted from RoundTimer ─────────────────────────────────

function formatTime(remaining: number): { mm: string; ss: string } {
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return { mm, ss };
}

function calcProgress(remaining: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  return remaining / totalSeconds;
}

function isWarning(remaining: number, totalSeconds: number): boolean {
  const progress = calcProgress(remaining, totalSeconds);
  return progress <= 0.25 && remaining > 0;
}

function isExpired(remaining: number): boolean {
  return remaining <= 0;
}

function clampMinutes(raw: number | string, fallback = 25): number {
  const parsed = parseInt(String(raw), 10);
  if (isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(180, parsed));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats 25 minutes as 25:00", () => {
    const { mm, ss } = formatTime(25 * 60);
    expect(mm).toBe("25");
    expect(ss).toBe("00");
  });

  it("zero-pads single-digit minutes", () => {
    const { mm } = formatTime(5 * 60);
    expect(mm).toBe("05");
  });

  it("zero-pads single-digit seconds", () => {
    const { ss } = formatTime(61);
    expect(ss).toBe("01");
  });

  it("formats 0 as 00:00", () => {
    const { mm, ss } = formatTime(0);
    expect(mm).toBe("00");
    expect(ss).toBe("00");
  });

  it("formats 1:30 correctly", () => {
    const { mm, ss } = formatTime(90);
    expect(mm).toBe("01");
    expect(ss).toBe("30");
  });

  it("formats 59:59 correctly", () => {
    const { mm, ss } = formatTime(3599);
    expect(mm).toBe("59");
    expect(ss).toBe("59");
  });
});

describe("calcProgress", () => {
  it("returns 1 when no time has elapsed", () => {
    expect(calcProgress(1500, 1500)).toBe(1);
  });

  it("returns 0.5 at halfway", () => {
    expect(calcProgress(750, 1500)).toBe(0.5);
  });

  it("returns 0 when expired", () => {
    expect(calcProgress(0, 1500)).toBe(0);
  });

  it("returns 0 when totalSeconds is 0 (guard)", () => {
    expect(calcProgress(100, 0)).toBe(0);
  });
});

describe("isWarning", () => {
  it("is false when more than 25% remains", () => {
    expect(isWarning(400, 1500)).toBe(false); // ~26.7%
  });

  it("is true at exactly 25%", () => {
    expect(isWarning(375, 1500)).toBe(true); // 25%
  });

  it("is true below 25%", () => {
    expect(isWarning(100, 1500)).toBe(true);
  });

  it("is false when expired (remaining = 0)", () => {
    expect(isWarning(0, 1500)).toBe(false);
  });
});

describe("isExpired", () => {
  it("is false when time remains", () => {
    expect(isExpired(1)).toBe(false);
  });

  it("is true at exactly 0", () => {
    expect(isExpired(0)).toBe(true);
  });

  it("is true for negative values", () => {
    expect(isExpired(-1)).toBe(true);
  });
});

describe("clampMinutes", () => {
  it("returns 25 for default input", () => {
    expect(clampMinutes(25)).toBe(25);
  });

  it("clamps to minimum of 1", () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(-5)).toBe(1);
  });

  it("clamps to maximum of 180", () => {
    expect(clampMinutes(999)).toBe(180);
  });

  it("handles string input", () => {
    expect(clampMinutes("45")).toBe(45);
  });

  it("falls back to default for NaN", () => {
    expect(clampMinutes("abc", 25)).toBe(25);
  });

  it("accepts boundary values", () => {
    expect(clampMinutes(1)).toBe(1);
    expect(clampMinutes(180)).toBe(180);
  });
});
