/**
 * lnmSave.test.ts
 * Unit tests for the useLnmSave hook logic, sessionStorage helpers, and
 * auto-save debounce behaviour.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDraftPgn, getDraftTimestamp, clearDraftPgn } from "../hooks/useLnmSave";

// ─── sessionStorage helpers ───────────────────────────────────────────────────

describe("getDraftPgn / clearDraftPgn", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("returns null when no draft exists", () => {
    expect(getDraftPgn("ABC123")).toBeNull();
  });

  it("returns null for a different battle code", () => {
    sessionStorage.setItem("lnm_draft_ABC123", "1. e4 e5");
    expect(getDraftPgn("XYZ999")).toBeNull();
  });

  it("is case-insensitive for battle codes", () => {
    sessionStorage.setItem("lnm_draft_ABC123", "1. e4 e5");
    expect(getDraftPgn("abc123")).toBe("1. e4 e5");
    expect(getDraftPgn("ABC123")).toBe("1. e4 e5");
  });

  it("returns the stored PGN", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. d4 d5 2. c4");
    expect(getDraftPgn("ROOM1")).toBe("1. d4 d5 2. c4");
  });

  it("clearDraftPgn removes the draft", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. e4 e5");
    clearDraftPgn("ROOM1");
    expect(getDraftPgn("ROOM1")).toBeNull();
  });

  it("clearDraftPgn removes the timestamp too", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. e4 e5");
    sessionStorage.setItem("lnm_draft_ts_ROOM1", new Date().toISOString());
    clearDraftPgn("ROOM1");
    expect(getDraftTimestamp("ROOM1")).toBeNull();
  });

  it("clearDraftPgn is a no-op when no draft exists", () => {
    expect(() => clearDraftPgn("NONEXISTENT")).not.toThrow();
  });
});

// ─── getDraftTimestamp ────────────────────────────────────────────────────────

describe("getDraftTimestamp", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("returns null when no timestamp exists", () => {
    expect(getDraftTimestamp("ROOM1")).toBeNull();
  });

  it("returns a Date when timestamp is stored", () => {
    const iso = "2026-03-24T04:00:00.000Z";
    sessionStorage.setItem("lnm_draft_ts_ROOM1", iso);
    const result = getDraftTimestamp("ROOM1");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe(iso);
  });

  it("is case-insensitive for battle codes", () => {
    const iso = "2026-03-24T04:00:00.000Z";
    sessionStorage.setItem("lnm_draft_ts_ROOM1", iso);
    expect(getDraftTimestamp("room1")).toBeInstanceOf(Date);
  });
});

// ─── Auto-save debounce state machine ────────────────────────────────────────
// Mirrors the debounce logic from useLnmSave without React

interface SaveCall { pgn: string; }

function makeAutoSaveMachine(debounceMs = 30_000) {
  const saveCalls: SaveCall[] = [];
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function onPgnChange(pgn: string, active: boolean, battleCode: string) {
    if (!active || !pgn) return;
    // Write to sessionStorage immediately
    sessionStorage.setItem(`lnm_draft_${battleCode.toUpperCase()}`, pgn);
    // Debounce server call
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      saveCalls.push({ pgn });
      timerId = null;
    }, debounceMs);
  }

  function flush() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return { saveCalls, onPgnChange, flush };
}

describe("auto-save debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("does not save when LNM is inactive", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4 e5", false, "ROOM1");
    vi.advanceTimersByTime(30_000);
    expect(m.saveCalls).toHaveLength(0);
  });

  it("does not save when PGN is empty", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("", true, "ROOM1");
    vi.advanceTimersByTime(30_000);
    expect(m.saveCalls).toHaveLength(0);
  });

  it("saves after debounce period elapses", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    vi.advanceTimersByTime(30_000);
    expect(m.saveCalls).toHaveLength(1);
    expect(m.saveCalls[0].pgn).toBe("1. e4 e5");
  });

  it("does not save before debounce period elapses", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    vi.advanceTimersByTime(29_999);
    expect(m.saveCalls).toHaveLength(0);
  });

  it("resets debounce on each PGN change", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4", true, "ROOM1");
    vi.advanceTimersByTime(20_000);
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    vi.advanceTimersByTime(20_000); // 40s total, but timer reset at 20s
    expect(m.saveCalls).toHaveLength(0); // 20s since last change, not 30s yet
    vi.advanceTimersByTime(10_000); // now 30s since last change
    expect(m.saveCalls).toHaveLength(1);
    expect(m.saveCalls[0].pgn).toBe("1. e4 e5");
  });

  it("saves only the latest PGN after multiple rapid changes", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4", true, "ROOM1");
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    m.onPgnChange("1. e4 e5 2. Nf3", true, "ROOM1");
    vi.advanceTimersByTime(30_000);
    expect(m.saveCalls).toHaveLength(1);
    expect(m.saveCalls[0].pgn).toBe("1. e4 e5 2. Nf3");
  });

  it("writes to sessionStorage immediately (before debounce fires)", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    // No time advance — sessionStorage should already have the draft
    expect(sessionStorage.getItem("lnm_draft_ROOM1")).toBe("1. e4 e5");
    expect(m.saveCalls).toHaveLength(0); // server call not yet
  });

  it("flush cancels pending debounce", () => {
    const m = makeAutoSaveMachine(30_000);
    m.onPgnChange("1. e4 e5", true, "ROOM1");
    m.flush();
    vi.advanceTimersByTime(30_000);
    expect(m.saveCalls).toHaveLength(0);
  });
});

// ─── Save status transitions ──────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function makeStatusMachine() {
  let status: SaveStatus = "idle";
  let lastSavedAt: Date | null = null;
  let saveError: string | null = null;

  async function save(shouldFail = false): Promise<void> {
    status = "saving";
    saveError = null;
    await Promise.resolve(); // simulate async
    if (shouldFail) {
      status = "error";
      saveError = "Network error";
    } else {
      status = "saved";
      lastSavedAt = new Date();
    }
  }

  function resetStatus() {
    status = "idle";
    saveError = null;
  }

  return { get status() { return status; }, get lastSavedAt() { return lastSavedAt; }, get saveError() { return saveError; }, save, resetStatus };
}

describe("save status transitions", () => {
  it("transitions idle → saving → saved on success", async () => {
    const m = makeStatusMachine();
    expect(m.status).toBe("idle");
    const p = m.save(false);
    expect(m.status).toBe("saving");
    await p;
    expect(m.status).toBe("saved");
    expect(m.lastSavedAt).toBeInstanceOf(Date);
  });

  it("transitions idle → saving → error on failure", async () => {
    const m = makeStatusMachine();
    await m.save(true);
    expect(m.status).toBe("error");
    expect(m.saveError).toBe("Network error");
    expect(m.lastSavedAt).toBeNull();
  });

  it("resetStatus clears error and returns to idle", async () => {
    const m = makeStatusMachine();
    await m.save(true);
    m.resetStatus();
    expect(m.status).toBe("idle");
    expect(m.saveError).toBeNull();
  });
});

// ─── Draft recovery detection ─────────────────────────────────────────────────

describe("draft recovery detection", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("detects existing draft for a room", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. e4 e5 2. Nf3");
    expect(getDraftPgn("ROOM1")).not.toBeNull();
  });

  it("no draft detected for a fresh room", () => {
    expect(getDraftPgn("FRESHROOM")).toBeNull();
  });

  it("draft is cleared after successful save & exit", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. e4 e5");
    clearDraftPgn("ROOM1");
    expect(getDraftPgn("ROOM1")).toBeNull();
  });

  it("draft persists across simulated page reloads (sessionStorage)", () => {
    sessionStorage.setItem("lnm_draft_ROOM1", "1. d4 d5 2. c4 e6");
    // Simulate re-reading after reload
    const recovered = getDraftPgn("ROOM1");
    expect(recovered).toBe("1. d4 d5 2. c4 e6");
  });
});
