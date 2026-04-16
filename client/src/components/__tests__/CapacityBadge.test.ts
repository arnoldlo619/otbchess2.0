import { describe, it, expect } from "vitest";
import {getCapacityState, getCapacityPct} from "../CapacityBadge";

// ─── getCapacityState ─────────────────────────────────────────────────────────

describe("getCapacityState", () => {
  it("returns 'ok' when current is 0", () => {
    expect(getCapacityState(0, 20)).toBe("ok");
  });

  it("returns 'ok' at exactly 74% full", () => {
    // 14/20 = 70% → ok
    expect(getCapacityState(14, 20)).toBe("ok");
  });

  it("returns 'ok' just below 75%", () => {
    // 14/19 ≈ 73.7% → ok
    expect(getCapacityState(14, 19)).toBe("ok");
  });

  it("returns 'warning' at exactly 75%", () => {
    // 15/20 = 75% → warning
    expect(getCapacityState(15, 20)).toBe("warning");
  });

  it("returns 'warning' at 80%", () => {
    expect(getCapacityState(16, 20)).toBe("warning");
  });

  it("returns 'warning' at 99%", () => {
    // 19/20 = 95% → warning
    expect(getCapacityState(19, 20)).toBe("warning");
  });

  it("returns 'full' at exactly 100%", () => {
    expect(getCapacityState(20, 20)).toBe("full");
  });

  it("returns 'full' when current exceeds max (over-registration edge case)", () => {
    expect(getCapacityState(21, 20)).toBe("full");
  });

  it("returns 'ok' when max is 0 (no cap set)", () => {
    expect(getCapacityState(10, 0)).toBe("ok");
  });

  it("returns 'ok' when max is negative (invalid)", () => {
    expect(getCapacityState(5, -1)).toBe("ok");
  });

  it("returns 'full' for single-player cap at capacity", () => {
    expect(getCapacityState(1, 1)).toBe("full");
  });
});

// ─── getCapacityPct ───────────────────────────────────────────────────────────

describe("getCapacityPct", () => {
  it("returns 0 when current is 0", () => {
    expect(getCapacityPct(0, 20)).toBe(0);
  });

  it("returns 0.5 at 50%", () => {
    expect(getCapacityPct(10, 20)).toBe(0.5);
  });

  it("returns 1 at 100%", () => {
    expect(getCapacityPct(20, 20)).toBe(1);
  });

  it("clamps to 1 when over capacity", () => {
    expect(getCapacityPct(25, 20)).toBe(1);
  });

  it("returns 0 when max is 0 (guard against division by zero)", () => {
    expect(getCapacityPct(5, 0)).toBe(0);
  });

  it("returns correct fraction for 75%", () => {
    expect(getCapacityPct(15, 20)).toBe(0.75);
  });
});
