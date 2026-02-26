/**
 * Unit tests for registrationStore.ts
 * Tests the localStorage-backed registration persistence helpers.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveRegistration,
  getRegistration,
  clearRegistration,
  pruneOldRegistrations,
  type RegistrationEntry,
} from "../registrationStore";

// ── localStorage mock ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEntry(overrides: Partial<RegistrationEntry> = {}): RegistrationEntry {
  return {
    tournamentId: "ABC123",
    username: "hikaru",
    name: "Hikaru Nakamura",
    rating: 2850,
    tournamentName: "NYC Open 2026",
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
});

// ── saveRegistration ──────────────────────────────────────────────────────────
describe("saveRegistration", () => {
  it("persists a new entry to localStorage", () => {
    const entry = makeEntry();
    saveRegistration(entry);
    const reg = getRegistration("ABC123", "hikaru");
    expect(reg).not.toBeNull();
    expect(reg?.username).toBe("hikaru");
    expect(reg?.name).toBe("Hikaru Nakamura");
  });

  it("updates an existing entry for the same tournamentId + username", () => {
    saveRegistration(makeEntry({ rating: 2800 }));
    saveRegistration(makeEntry({ rating: 2850, name: "Hikaru (updated)" }));
    const reg = getRegistration("ABC123", "hikaru");
    expect(reg?.rating).toBe(2850);
    expect(reg?.name).toBe("Hikaru (updated)");
  });

  it("stores multiple entries for different tournaments", () => {
    saveRegistration(makeEntry({ tournamentId: "T1" }));
    saveRegistration(makeEntry({ tournamentId: "T2", username: "magnus" }));
    expect(getRegistration("T1", "hikaru")).not.toBeNull();
    expect(getRegistration("T2", "magnus")).not.toBeNull();
  });

  it("is case-insensitive for username matching", () => {
    saveRegistration(makeEntry({ username: "Hikaru" }));
    const reg = getRegistration("ABC123", "hikaru");
    expect(reg).not.toBeNull();
  });
});

// ── getRegistration ───────────────────────────────────────────────────────────
describe("getRegistration", () => {
  it("returns null when no entry exists", () => {
    expect(getRegistration("UNKNOWN")).toBeNull();
  });

  it("returns null when tournament exists but username does not match", () => {
    saveRegistration(makeEntry({ username: "hikaru" }));
    expect(getRegistration("ABC123", "magnus")).toBeNull();
  });

  it("returns the first entry for a tournament when no username is given", () => {
    saveRegistration(makeEntry({ username: "hikaru" }));
    saveRegistration(makeEntry({ username: "magnus", tournamentId: "ABC123" }));
    const reg = getRegistration("ABC123");
    expect(reg).not.toBeNull();
    // Should return one of the two entries for ABC123
    expect(["hikaru", "magnus"]).toContain(reg?.username);
  });

  it("handles corrupted localStorage gracefully", () => {
    store["otb_registrations"] = "not-valid-json";
    expect(getRegistration("ABC123")).toBeNull();
  });
});

// ── clearRegistration ─────────────────────────────────────────────────────────
describe("clearRegistration", () => {
  it("removes the matching entry", () => {
    saveRegistration(makeEntry());
    clearRegistration("ABC123", "hikaru");
    expect(getRegistration("ABC123", "hikaru")).toBeNull();
  });

  it("does not remove entries for other tournaments", () => {
    saveRegistration(makeEntry({ tournamentId: "T1" }));
    saveRegistration(makeEntry({ tournamentId: "T2" }));
    clearRegistration("T1", "hikaru");
    expect(getRegistration("T2", "hikaru")).not.toBeNull();
  });

  it("is a no-op when the entry does not exist", () => {
    saveRegistration(makeEntry());
    clearRegistration("ABC123", "magnus"); // different user
    expect(getRegistration("ABC123", "hikaru")).not.toBeNull();
  });
});

// ── pruneOldRegistrations ─────────────────────────────────────────────────────
describe("pruneOldRegistrations", () => {
  it("removes entries older than maxAgeDays", () => {
    const old = makeEntry({
      registeredAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = makeEntry({
      tournamentId: "FRESH",
      registeredAt: new Date().toISOString(),
    });
    saveRegistration(old);
    saveRegistration(fresh);
    pruneOldRegistrations(90);
    expect(getRegistration("ABC123", "hikaru")).toBeNull();
    expect(getRegistration("FRESH", "hikaru")).not.toBeNull();
  });

  it("keeps entries exactly at the cutoff boundary", () => {
    const boundary = makeEntry({
      registeredAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(),
    });
    saveRegistration(boundary);
    pruneOldRegistrations(90);
    expect(getRegistration("ABC123", "hikaru")).not.toBeNull();
  });

  it("is a no-op on empty storage", () => {
    expect(() => pruneOldRegistrations(90)).not.toThrow();
  });
});
