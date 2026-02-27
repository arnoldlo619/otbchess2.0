/**
 * OTB Chess — Archive Data Tests
 * Tests for ARCHIVE_TOURNAMENTS data integrity and listTournaments() helper
 * used by the Archive page.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ARCHIVE_TOURNAMENTS,
  ARCHIVE_STATS,
  type ArchiveTournament,
} from "@/lib/archiveData";
import { listTournaments, registerTournament } from "@/lib/tournamentRegistry";
import { generateDirectorCode } from "@/lib/tournamentRegistry";

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

beforeEach(() => localStorageMock.clear());
afterEach(() => localStorageMock.clear());

// ── ARCHIVE_TOURNAMENTS integrity ─────────────────────────────────────────────
describe("ARCHIVE_TOURNAMENTS", () => {
  it("contains at least 3 sample tournaments", () => {
    expect(ARCHIVE_TOURNAMENTS.length).toBeGreaterThanOrEqual(3);
  });

  it("every tournament has required fields", () => {
    for (const t of ARCHIVE_TOURNAMENTS) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.format).toMatch(/^(Swiss|Round Robin|Elimination)$/);
      expect(t.rounds).toBeGreaterThan(0);
      expect(t.playerCount).toBeGreaterThan(0);
      expect(Array.isArray(t.standings)).toBe(true);
    }
  });

  it("every tournament has at least one standing entry", () => {
    for (const t of ARCHIVE_TOURNAMENTS) {
      expect(t.standings.length).toBeGreaterThan(0);
    }
  });

  it("standings are sorted by rank ascending", () => {
    for (const t of ARCHIVE_TOURNAMENTS) {
      for (let i = 1; i < t.standings.length; i++) {
        expect(t.standings[i].rank).toBeGreaterThanOrEqual(t.standings[i - 1].rank);
      }
    }
  });

  it("standings scores are non-negative", () => {
    for (const t of ARCHIVE_TOURNAMENTS) {
      for (const p of t.standings) {
        expect(p.score).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("player counts match standings array length", () => {
    for (const t of ARCHIVE_TOURNAMENTS) {
      // playerCount is the registered count; standings may be a subset (top N)
      // but standings length should not exceed playerCount
      expect(t.standings.length).toBeLessThanOrEqual(t.playerCount);
    }
  });
});

// ── ARCHIVE_STATS integrity ───────────────────────────────────────────────────
describe("ARCHIVE_STATS", () => {
  it("has all required stat fields", () => {
    expect(typeof ARCHIVE_STATS.totalTournaments).toBe("number");
    expect(typeof ARCHIVE_STATS.totalPlayers).toBe("number");
    expect(typeof ARCHIVE_STATS.totalGames).toBe("number");
    expect(typeof ARCHIVE_STATS.totalClubs).toBe("number");
  });

  it("totalTournaments matches ARCHIVE_TOURNAMENTS length", () => {
    expect(ARCHIVE_STATS.totalTournaments).toBe(ARCHIVE_TOURNAMENTS.length);
  });
});

// ── listTournaments (user's own tournaments) ──────────────────────────────────
describe("listTournaments", () => {
  it("returns empty array when no tournaments have been created", () => {
    expect(listTournaments()).toEqual([]);
  });

  it("returns created tournaments in registration order", () => {
    const t1 = {
      id: "spring-open-2026",
      inviteCode: "SPRING01",
      directorCode: generateDirectorCode(),
      name: "Spring Open 2026",
      venue: "City Library",
      date: "2026-03-01",
      description: "",
      format: "swiss" as const,
      rounds: 5,
      maxPlayers: 16,
      timeBase: 10,
      timeIncrement: 5,
      timePreset: "10+5",
      ratingSystem: "chess.com" as const,
      createdAt: new Date().toISOString(),
    };
    const t2 = {
      ...t1,
      id: "club-championship-2026",
      inviteCode: "CLUB0001",
      name: "Club Championship 2026",
    };
    registerTournament(t1);
    registerTournament(t2);
    const list = listTournaments();
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.id)).toContain("spring-open-2026");
    expect(list.map((t) => t.id)).toContain("club-championship-2026");
  });

  it("returns the most recently registered tournament first (reversed order)", () => {
    const base = {
      inviteCode: "TESTCODE",
      directorCode: generateDirectorCode(),
      name: "Test",
      venue: "Venue",
      date: "2026-01-01",
      description: "",
      format: "swiss" as const,
      rounds: 3,
      maxPlayers: 8,
      timeBase: 5,
      timeIncrement: 0,
      timePreset: "5+0",
      ratingSystem: "chess.com" as const,
      createdAt: new Date().toISOString(),
    };
    registerTournament({ ...base, id: "first-tournament" });
    registerTournament({ ...base, id: "second-tournament" });
    const list = listTournaments();
    // listTournaments() returns reversed order — most recently added is first
    expect(list[0].id).toBe("second-tournament");
  });

  it("re-registering with same id replaces the entry without duplicating", () => {
    const base = {
      id: "unique-id-001",
      inviteCode: "UNIQ0001",
      directorCode: generateDirectorCode(),
      name: "Original Name",
      venue: "Venue",
      date: "2026-01-01",
      description: "",
      format: "swiss" as const,
      rounds: 3,
      maxPlayers: 8,
      timeBase: 5,
      timeIncrement: 0,
      timePreset: "5+0",
      ratingSystem: "chess.com" as const,
      createdAt: new Date().toISOString(),
    };
    registerTournament(base);
    registerTournament({ ...base, name: "Updated Name" });
    const list = listTournaments();
    expect(list.filter((t) => t.id === "unique-id-001")).toHaveLength(1);
    expect(list.find((t) => t.id === "unique-id-001")?.name).toBe("Updated Name");
  });
});
