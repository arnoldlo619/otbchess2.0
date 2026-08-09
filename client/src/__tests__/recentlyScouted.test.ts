/**
 * Tests for recentlyScouted.ts utility (v2 composite record API)
 *
 * Covers:
 *  - getRecentlyScouted: returns empty array when nothing stored
 *  - addRecentlyScouted: prepends entry, deduplicates by username+provider, trims to MAX_ENTRIES
 *  - removeRecentlyScouted: removes by username+provider
 *  - clearRecentlyScouted: wipes all entries
 *  - MAX_ENTRIES cap: never exceeds 5 entries
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentlyScouted,
  addRecentlyScouted,
  removeRecentlyScouted,
  clearRecentlyScouted,
  MAX_ENTRIES,
  type RecentScoutEntry,
} from "../lib/recentlyScouted";

// ── Mock localStorage ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
});

const makeEntry = (username: string, provider: "chesscom" | "lichess" = "chesscom"): Omit<RecentScoutEntry, "scoutedAt"> => ({
  username,
  provider,
  myColor: "not_sure",
  tcFilter: "all",
  gameCount: "50",
});

// ── getRecentlyScouted ────────────────────────────────────────────────────────

describe("getRecentlyScouted", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns an empty array when stored value is invalid JSON", () => {
    localStorage.setItem("otb_recently_scouted_v2", "not-json");
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns an empty array when stored value is not an array", () => {
    localStorage.setItem("otb_recently_scouted_v2", JSON.stringify({ user: "hikaru" }));
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns the stored entries when valid", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    const result = getRecentlyScouted();
    expect(result.length).toBe(1);
    expect(result[0].username).toBe("hikaru");
    expect(result[0].provider).toBe("chesscom");
  });
});

// ── addRecentlyScouted ────────────────────────────────────────────────────────

describe("addRecentlyScouted", () => {
  it("adds the first entry and returns it as a single-element array", () => {
    const result = addRecentlyScouted(makeEntry("hikaru"));
    expect(result.length).toBe(1);
    expect(result[0].username).toBe("hikaru");
  });

  it("prepends new entries so newest is first", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    const result = addRecentlyScouted(makeEntry("magnuscarlsen"));
    expect(result[0].username).toBe("magnuscarlsen");
    expect(result[1].username).toBe("hikaru");
  });

  it("deduplicates case-insensitively by username+provider and moves to front", () => {
    addRecentlyScouted(makeEntry("Hikaru"));
    addRecentlyScouted(makeEntry("magnuscarlsen"));
    const result = addRecentlyScouted(makeEntry("hikaru")); // same username+provider
    expect(result[0].username).toBe("hikaru");
    expect(result.filter(e => e.username.toLowerCase() === "hikaru").length).toBe(1);
  });

  it("does NOT deduplicate same username on different providers", () => {
    addRecentlyScouted(makeEntry("hikaru", "chesscom"));
    const result = addRecentlyScouted(makeEntry("hikaru", "lichess"));
    expect(result.length).toBe(2);
    expect(result[0].provider).toBe("lichess");
    expect(result[1].provider).toBe("chesscom");
  });

  it("trims whitespace from username before storing", () => {
    const result = addRecentlyScouted(makeEntry("  hikaru  "));
    expect(result[0].username).toBe("hikaru");
  });

  it("does not add an empty string", () => {
    const result = addRecentlyScouted(makeEntry("   "));
    expect(result).toEqual([]);
  });

  it("caps the list at MAX_ENTRIES", () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      addRecentlyScouted(makeEntry(`player${i}`));
    }
    const result = getRecentlyScouted();
    expect(result.length).toBe(MAX_ENTRIES);
  });

  it("newest entry is always at index 0 after cap", () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      addRecentlyScouted(makeEntry(`player${i}`));
    }
    const result = getRecentlyScouted();
    expect(result[0].username).toBe(`player${MAX_ENTRIES + 2}`);
  });
});

// ── removeRecentlyScouted ─────────────────────────────────────────────────────

describe("removeRecentlyScouted", () => {
  it("removes the specified username", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    addRecentlyScouted(makeEntry("magnuscarlsen"));
    const result = removeRecentlyScouted("hikaru");
    expect(result.map(e => e.username)).not.toContain("hikaru");
    expect(result.map(e => e.username)).toContain("magnuscarlsen");
  });

  it("is case-insensitive when removing", () => {
    addRecentlyScouted(makeEntry("Hikaru"));
    const result = removeRecentlyScouted("hikaru");
    expect(result.map(e => e.username.toLowerCase())).not.toContain("hikaru");
  });

  it("returns the unchanged list when username is not found", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    const result = removeRecentlyScouted("unknownplayer");
    expect(result.length).toBe(1);
    expect(result[0].username).toBe("hikaru");
  });

  it("returns an empty array when the only entry is removed", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    const result = removeRecentlyScouted("hikaru");
    expect(result).toEqual([]);
  });
});

// ── clearRecentlyScouted ──────────────────────────────────────────────────────

describe("clearRecentlyScouted", () => {
  it("wipes all entries", () => {
    addRecentlyScouted(makeEntry("hikaru"));
    addRecentlyScouted(makeEntry("magnuscarlsen"));
    clearRecentlyScouted();
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("is safe to call when list is already empty", () => {
    expect(() => clearRecentlyScouted()).not.toThrow();
    expect(getRecentlyScouted()).toEqual([]);
  });
});

// ── MAX_ENTRIES constant ──────────────────────────────────────────────────────

describe("MAX_ENTRIES", () => {
  it("is 5", () => {
    expect(MAX_ENTRIES).toBe(5);
  });
});
