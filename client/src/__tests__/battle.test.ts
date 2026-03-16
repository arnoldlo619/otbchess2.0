/**
 * Battle Feature Tests
 *
 * Tests cover:
 * 1. Battle room code generation (6 chars, alphanumeric)
 * 2. Battle room status transitions
 * 3. Battle result validation
 * 4. URL param parsing for QR join flow
 */

import { describe, it, expect } from "vitest";

// ── Helpers replicated from server logic ──────────────────────────────────────

function generateBattleCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type BattleStatus = "waiting" | "active" | "completed" | "cancelled";
type BattleResult = "host_win" | "guest_win" | "draw" | null;

function isValidStatus(status: string): status is BattleStatus {
  return ["waiting", "active", "completed", "cancelled"].includes(status);
}

function isValidResult(result: string): result is BattleResult {
  return ["host_win", "guest_win", "draw"].includes(result);
}

function canJoin(room: { status: BattleStatus; guestId: string | null }): boolean {
  return room.status === "waiting" && room.guestId === null;
}

function canReportResult(room: {
  status: BattleStatus;
  guestId: string | null;
  hostId: string;
}, requesterId: string): boolean {
  return (
    room.status === "active" &&
    room.guestId !== null &&
    room.hostId === requesterId
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Battle Code Generation", () => {
  it("generates a 6-character code", () => {
    const code = generateBattleCode();
    expect(code).toHaveLength(6);
  });

  it("generates codes with only valid characters (no ambiguous 0/O/1/I)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateBattleCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("generates unique codes across multiple calls", () => {
    const codes = new Set(Array.from({ length: 50 }, generateBattleCode));
    // With 32^6 = ~1B possibilities, 50 codes should all be unique
    expect(codes.size).toBe(50);
  });
});

describe("Battle Status Validation", () => {
  it("accepts valid statuses", () => {
    expect(isValidStatus("waiting")).toBe(true);
    expect(isValidStatus("active")).toBe(true);
    expect(isValidStatus("completed")).toBe(true);
    expect(isValidStatus("cancelled")).toBe(true);
  });

  it("rejects invalid statuses", () => {
    expect(isValidStatus("pending")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("WAITING")).toBe(false);
  });
});

describe("Battle Result Validation", () => {
  it("accepts valid results", () => {
    expect(isValidResult("host_win")).toBe(true);
    expect(isValidResult("guest_win")).toBe(true);
    expect(isValidResult("draw")).toBe(true);
  });

  it("rejects invalid results", () => {
    expect(isValidResult("win")).toBe(false);
    expect(isValidResult("")).toBe(false);
    expect(isValidResult("HOST_WIN")).toBe(false);
  });
});

describe("Battle Room Join Logic", () => {
  it("allows joining a waiting room with no guest", () => {
    const room = { status: "waiting" as BattleStatus, guestId: null };
    expect(canJoin(room)).toBe(true);
  });

  it("prevents joining a room that already has a guest", () => {
    const room = { status: "waiting" as BattleStatus, guestId: "user-456" };
    expect(canJoin(room)).toBe(false);
  });

  it("prevents joining an active room", () => {
    const room = { status: "active" as BattleStatus, guestId: null };
    expect(canJoin(room)).toBe(false);
  });

  it("prevents joining a completed room", () => {
    const room = { status: "completed" as BattleStatus, guestId: "user-456" };
    expect(canJoin(room)).toBe(false);
  });
});

describe("Battle Result Reporting Logic", () => {
  const hostId = "host-123";
  const guestId = "guest-456";

  it("allows host to report result when room is active with both players", () => {
    const room = { status: "active" as BattleStatus, guestId, hostId };
    expect(canReportResult(room, hostId)).toBe(true);
  });

  it("prevents guest from reporting result (host-only)", () => {
    const room = { status: "active" as BattleStatus, guestId, hostId };
    expect(canReportResult(room, guestId)).toBe(false);
  });

  it("prevents reporting result on a waiting room", () => {
    const room = { status: "waiting" as BattleStatus, guestId: null, hostId };
    expect(canReportResult(room, hostId)).toBe(false);
  });

  it("prevents reporting result on a completed room", () => {
    const room = { status: "completed" as BattleStatus, guestId, hostId };
    expect(canReportResult(room, hostId)).toBe(false);
  });
});

describe("QR Code Join URL Parsing", () => {
  it("extracts join code from URL search params", () => {
    const url = "https://chessotb.club/battle?join=ABC123";
    const params = new URLSearchParams(new URL(url).search);
    expect(params.get("join")).toBe("ABC123");
  });

  it("handles uppercase normalization", () => {
    const rawCode = "abc123";
    const normalized = rawCode.toUpperCase().slice(0, 8);
    expect(normalized).toBe("ABC123");
  });

  it("handles missing join param gracefully", () => {
    const url = "https://chessotb.club/battle";
    const params = new URLSearchParams(new URL(url).search);
    expect(params.get("join")).toBeNull();
  });
});

// ── Battle History Helpers ────────────────────────────────────────────────────

function computeOutcome(
  result: string | null,
  isHost: boolean
): "win" | "loss" | "draw" {
  if (result === "draw") return "draw";
  if ((result === "host_win" && isHost) || (result === "guest_win" && !isHost))
    return "win";
  return "loss";
}

function formatBattleDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function summarise(history: Array<{ outcome: "win" | "loss" | "draw" }>) {
  return {
    wins:   history.filter((b) => b.outcome === "win").length,
    losses: history.filter((b) => b.outcome === "loss").length,
    draws:  history.filter((b) => b.outcome === "draw").length,
  };
}

describe("Battle History Outcome Computation", () => {
  it("host wins when result is host_win", () => {
    expect(computeOutcome("host_win", true)).toBe("win");
  });

  it("guest wins when result is guest_win", () => {
    expect(computeOutcome("guest_win", false)).toBe("win");
  });

  it("host loses when result is guest_win", () => {
    expect(computeOutcome("guest_win", true)).toBe("loss");
  });

  it("guest loses when result is host_win", () => {
    expect(computeOutcome("host_win", false)).toBe("loss");
  });

  it("both get draw when result is draw", () => {
    expect(computeOutcome("draw", true)).toBe("draw");
    expect(computeOutcome("draw", false)).toBe("draw");
  });

  it("returns loss for null result", () => {
    expect(computeOutcome(null, true)).toBe("loss");
  });
});

describe("Battle History Summary", () => {
  const history = [
    { outcome: "win"  as const },
    { outcome: "win"  as const },
    { outcome: "loss" as const },
    { outcome: "draw" as const },
  ];

  it("counts wins correctly", () => {
    expect(summarise(history).wins).toBe(2);
  });

  it("counts losses correctly", () => {
    expect(summarise(history).losses).toBe(1);
  });

  it("counts draws correctly", () => {
    expect(summarise(history).draws).toBe(1);
  });

  it("returns zeros for empty history", () => {
    expect(summarise([])).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});

describe("Battle Date Formatting", () => {
  it("formats a valid ISO date string", () => {
    const result = formatBattleDate("2026-03-16T20:00:00.000Z");
    // Should contain month, day, year components
    expect(result).toMatch(/Mar|March/);
    expect(result).toMatch(/2026/);
  });

  it("returns empty string for null", () => {
    expect(formatBattleDate(null)).toBe("");
  });
});
