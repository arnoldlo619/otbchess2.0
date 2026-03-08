/**
 * Tests for GameVideoPlayer utility functions:
 *  - formatVideoTime
 *  - seekTimeForMove
 *  - clipTimings
 */
import { describe, it, expect } from "vitest";
import {
  formatVideoTime,
  seekTimeForMove,
  clipTimings,
  type MoveTimestamp,
} from "../components/GameVideoPlayer";

// ── Sample move timestamp data ────────────────────────────────────────────────

const TIMESTAMPS: MoveTimestamp[] = [
  { moveNumber: 1, color: "w", timestamp: 5.0 },
  { moveNumber: 1, color: "b", timestamp: 12.5 },
  { moveNumber: 2, color: "w", timestamp: 20.0 },
  { moveNumber: 2, color: "b", timestamp: 28.3 },
  { moveNumber: 3, color: "w", timestamp: 35.1 },
  { moveNumber: 3, color: "b", timestamp: 42.7 },
  { moveNumber: 10, color: "w", timestamp: 120.0 },
  { moveNumber: 10, color: "b", timestamp: 130.5 },
];

// ── formatVideoTime ───────────────────────────────────────────────────────────

describe("formatVideoTime", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatVideoTime(0)).toBe("0:00");
  });

  it("formats 59 seconds as 0:59", () => {
    expect(formatVideoTime(59)).toBe("0:59");
  });

  it("formats 60 seconds as 1:00", () => {
    expect(formatVideoTime(60)).toBe("1:00");
  });

  it("formats 61 seconds as 1:01", () => {
    expect(formatVideoTime(61)).toBe("1:01");
  });

  it("formats 90 seconds as 1:30", () => {
    expect(formatVideoTime(90)).toBe("1:30");
  });

  it("formats 3600 seconds as 60:00", () => {
    expect(formatVideoTime(3600)).toBe("60:00");
  });

  it("formats 3661 seconds as 61:01", () => {
    expect(formatVideoTime(3661)).toBe("61:01");
  });

  it("pads single-digit seconds with leading zero", () => {
    expect(formatVideoTime(65)).toBe("1:05");
  });

  it("handles fractional seconds by flooring", () => {
    expect(formatVideoTime(90.9)).toBe("1:30");
  });

  it("handles NaN by returning 0:00", () => {
    expect(formatVideoTime(NaN)).toBe("0:00");
  });

  it("handles Infinity by returning 0:00", () => {
    expect(formatVideoTime(Infinity)).toBe("0:00");
  });

  it("handles negative values by returning 0:00", () => {
    expect(formatVideoTime(-5)).toBe("0:00");
  });

  it("formats 599 seconds as 9:59", () => {
    expect(formatVideoTime(599)).toBe("9:59");
  });

  it("formats 600 seconds as 10:00", () => {
    expect(formatVideoTime(600)).toBe("10:00");
  });
});

// ── seekTimeForMove ───────────────────────────────────────────────────────────

describe("seekTimeForMove", () => {
  it("returns null for moveIndex -1 (starting position)", () => {
    expect(seekTimeForMove(-1, TIMESTAMPS)).toBeNull();
  });

  it("returns null for empty timestamps array", () => {
    expect(seekTimeForMove(0, [])).toBeNull();
  });

  it("returns timestamp for moveIndex 0 (move 1 white)", () => {
    expect(seekTimeForMove(0, TIMESTAMPS)).toBe(5.0);
  });

  it("returns timestamp for moveIndex 1 (move 1 black)", () => {
    expect(seekTimeForMove(1, TIMESTAMPS)).toBe(12.5);
  });

  it("returns timestamp for moveIndex 2 (move 2 white)", () => {
    expect(seekTimeForMove(2, TIMESTAMPS)).toBe(20.0);
  });

  it("returns timestamp for moveIndex 3 (move 2 black)", () => {
    expect(seekTimeForMove(3, TIMESTAMPS)).toBe(28.3);
  });

  it("returns timestamp for moveIndex 4 (move 3 white)", () => {
    expect(seekTimeForMove(4, TIMESTAMPS)).toBe(35.1);
  });

  it("returns timestamp for moveIndex 5 (move 3 black)", () => {
    expect(seekTimeForMove(5, TIMESTAMPS)).toBe(42.7);
  });

  it("maps moveIndex 18 to move 10 white", () => {
    expect(seekTimeForMove(18, TIMESTAMPS)).toBe(120.0);
  });

  it("maps moveIndex 19 to move 10 black", () => {
    expect(seekTimeForMove(19, TIMESTAMPS)).toBe(130.5);
  });

  it("falls back to same moveNumber when color doesn't match", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 1, timestamp: 5.0 }, // no color field
    ];
    expect(seekTimeForMove(0, ts)).toBe(5.0);
    expect(seekTimeForMove(1, ts)).toBe(5.0); // same moveNumber, no color match
  });

  it("falls back to closest moveNumber when exact not found", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 5, color: "w", timestamp: 60.0 },
      { moveNumber: 10, color: "w", timestamp: 120.0 },
    ];
    // moveIndex 0 = move 1 white — closest is move 5 at 60.0
    expect(seekTimeForMove(0, ts)).toBe(60.0);
  });

  it("returns null for negative moveIndex", () => {
    expect(seekTimeForMove(-2, TIMESTAMPS)).toBeNull();
  });

  it("handles timestamps without color field", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 1, timestamp: 8.0 },
      { moveNumber: 2, timestamp: 16.0 },
    ];
    expect(seekTimeForMove(0, ts)).toBe(8.0);
    expect(seekTimeForMove(2, ts)).toBe(16.0);
  });

  it("prefers exact color match over same-moveNumber fallback", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 3, color: "w", timestamp: 30.0 },
      { moveNumber: 3, color: "b", timestamp: 38.0 },
    ];
    // moveIndex 4 = move 3 white
    expect(seekTimeForMove(4, ts)).toBe(30.0);
    // moveIndex 5 = move 3 black
    expect(seekTimeForMove(5, ts)).toBe(38.0);
  });

  it("handles a single timestamp entry", () => {
    const ts: MoveTimestamp[] = [{ moveNumber: 1, color: "w", timestamp: 3.5 }];
    expect(seekTimeForMove(0, ts)).toBe(3.5);
  });

  it("returns closest when moveIndex is far beyond available timestamps", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 1, color: "w", timestamp: 5.0 },
    ];
    // moveIndex 100 = move 51 — closest is move 1
    const result = seekTimeForMove(100, ts);
    expect(result).toBe(5.0);
  });
});

// ── clipTimings ───────────────────────────────────────────────────────────────

describe("clipTimings", () => {
  it("starts 0.5s before the seek time", () => {
    const { start } = clipTimings(10.0, 120.0);
    expect(start).toBe(9.5);
  });

  it("ends 2.5s after the seek time", () => {
    const { end } = clipTimings(10.0, 120.0);
    expect(end).toBe(12.5);
  });

  it("clamps start to 0 when seek time is near beginning", () => {
    const { start } = clipTimings(0.3, 120.0);
    expect(start).toBe(0);
  });

  it("clamps end to video duration when seek time is near end", () => {
    const { end } = clipTimings(119.0, 120.0);
    expect(end).toBe(120.0);
  });

  it("produces a 3-second clip in the middle of a video", () => {
    const { start, end } = clipTimings(60.0, 120.0);
    expect(end - start).toBeCloseTo(3.0);
  });

  it("handles seek time at exactly 0", () => {
    const { start, end } = clipTimings(0, 120.0);
    expect(start).toBe(0);
    expect(end).toBe(2.5);
  });

  it("handles seek time at exactly the video duration", () => {
    const { start, end } = clipTimings(120.0, 120.0);
    expect(start).toBe(119.5);
    expect(end).toBe(120.0);
  });

  it("handles very short videos", () => {
    const { start, end } = clipTimings(1.0, 2.0);
    expect(start).toBe(0.5);
    expect(end).toBe(2.0); // clamped
  });

  it("handles zero-duration video gracefully", () => {
    const { start, end } = clipTimings(0, 0);
    expect(start).toBe(0);
    expect(end).toBe(0);
  });

  it("start is always <= end", () => {
    const cases = [
      [0, 0],
      [0.1, 0.2],
      [5, 10],
      [100, 120],
    ];
    for (const [seekTime, duration] of cases) {
      const { start, end } = clipTimings(seekTime, duration);
      expect(start).toBeLessThanOrEqual(end);
    }
  });

  it("clip duration is at most 3 seconds", () => {
    const { start, end } = clipTimings(50, 200);
    expect(end - start).toBeLessThanOrEqual(3.0);
  });

  it("clip duration is at most 3 seconds even near end", () => {
    const { start, end } = clipTimings(199, 200);
    expect(end - start).toBeLessThanOrEqual(3.0);
  });
});

// ── Integration: seekTimeForMove + clipTimings ────────────────────────────────

describe("seekTimeForMove + clipTimings integration", () => {
  it("produces a valid clip for a mid-game move", () => {
    const seekTime = seekTimeForMove(4, TIMESTAMPS); // move 3 white at 35.1s
    expect(seekTime).not.toBeNull();
    const { start, end } = clipTimings(seekTime!, 300.0);
    expect(start).toBeCloseTo(34.6);
    expect(end).toBeCloseTo(37.6);
  });

  it("produces a valid clip for the first move", () => {
    const seekTime = seekTimeForMove(0, TIMESTAMPS); // move 1 white at 5.0s
    expect(seekTime).not.toBeNull();
    const { start, end } = clipTimings(seekTime!, 300.0);
    expect(start).toBeCloseTo(4.5);
    expect(end).toBeCloseTo(7.5);
  });

  it("returns null seekTime for starting position, skipping clip", () => {
    const seekTime = seekTimeForMove(-1, TIMESTAMPS);
    expect(seekTime).toBeNull();
    // No clip should be created
  });
});

// ── Edge cases: moveTimestamps JSON parsing ───────────────────────────────────

describe("moveTimestamps JSON parsing edge cases", () => {
  it("handles empty array", () => {
    const ts: MoveTimestamp[] = JSON.parse("[]");
    expect(seekTimeForMove(0, ts)).toBeNull();
  });

  it("handles timestamps with extra fields", () => {
    const ts = JSON.parse(
      '[{"moveNumber":1,"color":"w","timestamp":5.0,"confidence":0.95}]'
    ) as MoveTimestamp[];
    expect(seekTimeForMove(0, ts)).toBe(5.0);
  });

  it("handles timestamps with string timestamps (coercion)", () => {
    // In practice the server stores numbers, but test robustness
    const ts = [{ moveNumber: 1, color: "w", timestamp: 5.0 }];
    expect(seekTimeForMove(0, ts)).toBe(5.0);
  });

  it("handles large move numbers correctly", () => {
    const ts: MoveTimestamp[] = [
      { moveNumber: 50, color: "w", timestamp: 600.0 },
      { moveNumber: 50, color: "b", timestamp: 615.0 },
    ];
    // moveIndex 98 = move 50 white
    expect(seekTimeForMove(98, ts)).toBe(600.0);
    // moveIndex 99 = move 50 black
    expect(seekTimeForMove(99, ts)).toBe(615.0);
  });
});
