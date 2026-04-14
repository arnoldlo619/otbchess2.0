/**
 * Tests for recentlyScouted.ts utility
 *
 * Covers:
 *  - getRecentlyScouted: returns empty array when nothing stored
 *  - addRecentlyScouted: prepends username, deduplicates, trims to MAX_ENTRIES
 *  - addRecentlyScouted: case-insensitive deduplication preserves new casing
 *  - removeRecentlyScouted: removes a single entry by username (case-insensitive)
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

// ── getRecentlyScouted ────────────────────────────────────────────────────────

describe("getRecentlyScouted", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns an empty array when stored value is invalid JSON", () => {
    localStorage.setItem("otb_recently_scouted", "not-json");
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns an empty array when stored value is not an array", () => {
    localStorage.setItem("otb_recently_scouted", JSON.stringify({ user: "hikaru" }));
    expect(getRecentlyScouted()).toEqual([]);
  });

  it("returns the stored array when valid", () => {
    localStorage.setItem("otb_recently_scouted", JSON.stringify(["hikaru", "magnuscarlsen"]));
    expect(getRecentlyScouted()).toEqual(["hikaru", "magnuscarlsen"]);
  });
});

// ── addRecentlyScouted ────────────────────────────────────────────────────────

describe("addRecentlyScouted", () => {
  it("adds the first username and returns it as a single-element array", () => {
    const result = addRecentlyScouted("hikaru");
    expect(result).toEqual(["hikaru"]);
    expect(getRecentlyScouted()).toEqual(["hikaru"]);
  });

  it("prepends new entries so newest is first", () => {
    addRecentlyScouted("hikaru");
    const result = addRecentlyScouted("magnuscarlsen");
    expect(result[0]).toBe("magnuscarlsen");
    expect(result[1]).toBe("hikaru");
  });

  it("deduplicates case-insensitively and moves existing entry to front", () => {
    addRecentlyScouted("Hikaru");
    addRecentlyScouted("magnuscarlsen");
    const result = addRecentlyScouted("hikaru"); // same as first, different case
    expect(result[0]).toBe("hikaru");
    expect(result.filter((u) => u.toLowerCase() === "hikaru").length).toBe(1);
  });

  it("preserves the casing of the newly added entry after dedup", () => {
    addRecentlyScouted("HIKARU");
    const result = addRecentlyScouted("Hikaru");
    expect(result[0]).toBe("Hikaru");
  });

  it("trims whitespace from username before storing", () => {
    const result = addRecentlyScouted("  hikaru  ");
    expect(result[0]).toBe("hikaru");
  });

  it("does not add an empty string", () => {
    const result = addRecentlyScouted("   ");
    expect(result).toEqual([]);
  });

  it("caps the list at MAX_ENTRIES", () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      addRecentlyScouted(`player${i}`);
    }
    const result = getRecentlyScouted();
    expect(result.length).toBe(MAX_ENTRIES);
  });

  it("newest entry is always at index 0 after cap", () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      addRecentlyScouted(`player${i}`);
    }
    const result = getRecentlyScouted();
    expect(result[0]).toBe(`player${MAX_ENTRIES + 2}`);
  });
});

// ── removeRecentlyScouted ─────────────────────────────────────────────────────

describe("removeRecentlyScouted", () => {
  it("removes the specified username", () => {
    addRecentlyScouted("hikaru");
    addRecentlyScouted("magnuscarlsen");
    const result = removeRecentlyScouted("hikaru");
    expect(result).not.toContain("hikaru");
    expect(result).toContain("magnuscarlsen");
  });

  it("is case-insensitive when removing", () => {
    addRecentlyScouted("Hikaru");
    const result = removeRecentlyScouted("hikaru");
    expect(result.map((u) => u.toLowerCase())).not.toContain("hikaru");
  });

  it("returns the unchanged list when username is not found", () => {
    addRecentlyScouted("hikaru");
    const result = removeRecentlyScouted("unknownplayer");
    expect(result).toEqual(["hikaru"]);
  });

  it("returns an empty array when the only entry is removed", () => {
    addRecentlyScouted("hikaru");
    const result = removeRecentlyScouted("hikaru");
    expect(result).toEqual([]);
  });
});

// ── clearRecentlyScouted ──────────────────────────────────────────────────────

describe("clearRecentlyScouted", () => {
  it("wipes all entries", () => {
    addRecentlyScouted("hikaru");
    addRecentlyScouted("magnuscarlsen");
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
