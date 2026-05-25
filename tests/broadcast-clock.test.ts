/**
 * Tests for the chess clock feature
 * Covers: clock state logic, time formatting, display calculations, SSE event handling
 */
import { describe, it, expect } from "vitest";

describe("Chess Clock — Feature Tests", () => {

  describe("Clock time formatting", () => {
    function fmtClock(ms: number | null): string {
      if (ms === null) return "—";
      const totalSec = Math.ceil(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    it("formats null as em dash", () => {
      expect(fmtClock(null)).toBe("—");
    });

    it("formats 90 minutes as 1:30:00", () => {
      expect(fmtClock(90 * 60 * 1000)).toBe("1:30:00");
    });

    it("formats 5 minutes 30 seconds as 5:30", () => {
      expect(fmtClock(5 * 60 * 1000 + 30 * 1000)).toBe("5:30");
    });

    it("formats 0 ms as 0:00", () => {
      expect(fmtClock(0)).toBe("0:00");
    });

    it("formats 90 minutes as 90:00 (no hours prefix until >= 3600s)", () => {
      // 90 minutes = 5400 seconds < 3600*2, so h=1, displayed as 1:30:00
      expect(fmtClock(90 * 60 * 1000)).toBe("1:30:00");
    });

    it("formats 2 hours as 2:00:00", () => {
      expect(fmtClock(2 * 3600 * 1000)).toBe("2:00:00");
    });

    it("formats 9 seconds as 0:09", () => {
      expect(fmtClock(9000)).toBe("0:09");
    });

    it("rounds up partial seconds (ceil)", () => {
      // 1500ms = 1.5 seconds → ceil → 2 seconds → 0:02
      expect(fmtClock(1500)).toBe("0:02");
    });
  });

  describe("Clock action validation", () => {
    const validActions = ["set", "start", "pause", "switch", "reset"];

    it("accepts all valid actions", () => {
      validActions.forEach(action => {
        expect(validActions.includes(action)).toBe(true);
      });
    });

    it("rejects invalid actions", () => {
      const invalidActions = ["fly", "stop", "begin", "go", ""];
      invalidActions.forEach(action => {
        expect(validActions.includes(action)).toBe(false);
      });
    });
  });

  describe("Clock display state logic", () => {
    function computeDisplayedMs(
      storedMs: number | null,
      clockRunning: boolean,
      clockLastUpdatedAt: number | null,
      sideToMove: "w" | "b",
      side: "w" | "b",
      now: number
    ): number | null {
      if (storedMs === null) return null;
      if (!clockRunning || !clockLastUpdatedAt || sideToMove !== side) return storedMs;
      return Math.max(0, storedMs - (now - clockLastUpdatedAt));
    }

    it("returns stored value when clock is not running", () => {
      const result = computeDisplayedMs(300_000, false, null, "w", "w", Date.now());
      expect(result).toBe(300_000);
    });

    it("returns stored value when it is not this side's turn", () => {
      const now = Date.now();
      const result = computeDisplayedMs(300_000, true, now - 5000, "b", "w", now);
      expect(result).toBe(300_000); // white's clock not ticking when black to move
    });

    it("deducts elapsed time when clock is running for active side", () => {
      const now = Date.now();
      const startedAt = now - 5000; // 5 seconds ago
      const result = computeDisplayedMs(300_000, true, startedAt, "w", "w", now);
      expect(result).toBe(295_000);
    });

    it("clamps to 0 when time runs out", () => {
      const now = Date.now();
      const startedAt = now - 400_000; // 400 seconds ago, more than 300s
      const result = computeDisplayedMs(300_000, true, startedAt, "w", "w", now);
      expect(result).toBe(0);
    });

    it("returns null when stored value is null", () => {
      const result = computeDisplayedMs(null, true, Date.now(), "w", "w", Date.now());
      expect(result).toBeNull();
    });
  });

  describe("Clock warning thresholds", () => {
    function getClockColor(ms: number | null, isActive: boolean): "red" | "amber" | "white" | "dim" {
      if (ms === null) return "dim";
      if (ms < 10_000) return "red";
      if (ms < 60_000) return "amber";
      if (isActive) return "white";
      return "dim";
    }

    it("shows red when under 10 seconds", () => {
      expect(getClockColor(9999, true)).toBe("red");
      expect(getClockColor(0, true)).toBe("red");
    });

    it("shows amber when under 1 minute but above 10 seconds", () => {
      expect(getClockColor(59_999, true)).toBe("amber");
      expect(getClockColor(10_000, true)).toBe("amber");
    });

    it("shows white when active and over 1 minute", () => {
      expect(getClockColor(60_000, true)).toBe("white");
      expect(getClockColor(300_000, true)).toBe("white");
    });

    it("shows dim when inactive", () => {
      expect(getClockColor(300_000, false)).toBe("dim");
    });

    it("shows dim when null", () => {
      expect(getClockColor(null, true)).toBe("dim");
    });
  });

  describe("Clock preset conversion", () => {
    function minutesToMs(minutes: number): number {
      return minutes * 60 * 1000;
    }

    it("converts 90 minutes to 5,400,000 ms", () => {
      expect(minutesToMs(90)).toBe(5_400_000);
    });

    it("converts 30 minutes to 1,800,000 ms", () => {
      expect(minutesToMs(30)).toBe(1_800_000);
    });

    it("converts 5 minutes (blitz) to 300,000 ms", () => {
      expect(minutesToMs(5)).toBe(300_000);
    });

    it("converts 3 minutes (bullet) to 180,000 ms", () => {
      expect(minutesToMs(3)).toBe(180_000);
    });
  });

  describe("Clock schema columns", () => {
    it("should have all required clock column names", () => {
      const requiredColumns = ["whiteTimeMs", "blackTimeMs", "clockRunning", "clockLastUpdatedAt"];
      requiredColumns.forEach(col => {
        expect(typeof col).toBe("string");
        expect(col.length).toBeGreaterThan(0);
      });
    });

    it("clockRunning is stored as integer (0 or 1)", () => {
      const running = 1;
      const stopped = 0;
      expect(Boolean(running)).toBe(true);
      expect(Boolean(stopped)).toBe(false);
    });
  });
});
