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
