/**
 * Tests for ChessClock helper functions:
 * - formatClockMs: milliseconds → "M:SS" display string
 * - parseTimeControl: tournament preset → { baseMs, incrementMs }
 */
import { describe, it, expect } from "vitest";
import { formatClockMs, parseTimeControl } from "../pages/ChessClock";

// ─── formatClockMs ────────────────────────────────────────────────────────────
describe("formatClockMs", () => {
  it("formats 5 minutes as 5:00", () => {
    expect(formatClockMs(5 * 60 * 1000)).toBe("5:00");
  });

  it("formats 0 ms as 0:00", () => {
    expect(formatClockMs(0)).toBe("0:00");
  });

  it("formats negative ms as 0:00", () => {
    expect(formatClockMs(-500)).toBe("0:00");
  });

  it("formats 1 minute exactly", () => {
    expect(formatClockMs(60 * 1000)).toBe("1:00");
  });

  it("formats 1 minute 30 seconds", () => {
    expect(formatClockMs(90 * 1000)).toBe("1:30");
  });

  it("formats 10 minutes", () => {
    expect(formatClockMs(10 * 60 * 1000)).toBe("10:00");
  });

  it("formats 30 minutes", () => {
    expect(formatClockMs(30 * 60 * 1000)).toBe("30:00");
  });

  it("formats 9 seconds as 0:09", () => {
    expect(formatClockMs(9 * 1000)).toBe("0:09");
  });

  it("formats 59 seconds as 0:59", () => {
    expect(formatClockMs(59 * 1000)).toBe("0:59");
  });

  it("formats 1 hour as 1:00:00", () => {
    expect(formatClockMs(60 * 60 * 1000)).toBe("1:00:00");
  });

  it("formats 1 hour 30 minutes as 1:30:00", () => {
    expect(formatClockMs(90 * 60 * 1000)).toBe("1:30:00");
  });

  it("rounds up partial seconds (ceiling)", () => {
    // 4999ms → ceil(4.999) = 5 seconds → 0:05
    expect(formatClockMs(4999)).toBe("0:05");
  });

  it("rounds up 1ms to 0:01", () => {
    expect(formatClockMs(1)).toBe("0:01");
  });

  it("formats 2 minutes 5 seconds with leading zero on seconds", () => {
    expect(formatClockMs(2 * 60 * 1000 + 5 * 1000)).toBe("2:05");
  });
});

// ─── parseTimeControl ─────────────────────────────────────────────────────────
describe("parseTimeControl", () => {
  it("parses '5+0' preset correctly", () => {
    const result = parseTimeControl("5+0", 5, 0);
    expect(result.baseMs).toBe(5 * 60 * 1000);
    expect(result.incrementMs).toBe(0);
  });

  it("parses '3+2' preset correctly", () => {
    const result = parseTimeControl("3+2", 3, 2);
    expect(result.baseMs).toBe(3 * 60 * 1000);
    expect(result.incrementMs).toBe(2 * 1000);
  });

  it("parses '10+5' preset correctly", () => {
    const result = parseTimeControl("10+5", 10, 5);
    expect(result.baseMs).toBe(10 * 60 * 1000);
    expect(result.incrementMs).toBe(5 * 1000);
  });

  it("parses '30+0' preset correctly", () => {
    const result = parseTimeControl("30+0", 30, 0);
    expect(result.baseMs).toBe(30 * 60 * 1000);
    expect(result.incrementMs).toBe(0);
  });

  it("falls back to timeBase/timeIncrement when preset is unrecognised", () => {
    const result = parseTimeControl("Rapid", 15, 10);
    expect(result.baseMs).toBe(15 * 60 * 1000);
    expect(result.incrementMs).toBe(10 * 1000);
  });

  it("falls back to timeBase/timeIncrement when preset is empty string", () => {
    const result = parseTimeControl("", 5, 3);
    expect(result.baseMs).toBe(5 * 60 * 1000);
    expect(result.incrementMs).toBe(3 * 1000);
  });

  it("parses '1+0' bullet preset", () => {
    const result = parseTimeControl("1+0", 1, 0);
    expect(result.baseMs).toBe(60 * 1000);
    expect(result.incrementMs).toBe(0);
  });

  it("parses decimal base time like '1.5+0'", () => {
    const result = parseTimeControl("1.5+0", 1, 0);
    expect(result.baseMs).toBe(1.5 * 60 * 1000);
    expect(result.incrementMs).toBe(0);
  });

  it("parses '60+30' classical preset", () => {
    const result = parseTimeControl("60+30", 60, 30);
    expect(result.baseMs).toBe(60 * 60 * 1000);
    expect(result.incrementMs).toBe(30 * 1000);
  });
});
