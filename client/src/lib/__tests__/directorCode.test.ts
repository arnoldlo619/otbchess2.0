/**
 * Tests for the director code system in tournamentRegistry.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock localStorage ────────────────────────────────────────────────────────
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

import {
  generateDirectorCode,
  registerTournament,
  resolveByDirectorCode,
  grantDirectorSession,
  hasDirectorSession,
  clearDirectorSession as revokeDirectorSession,
} from "../tournamentRegistry";

// ─── generateDirectorCode ─────────────────────────────────────────────────────
describe("generateDirectorCode", () => {
  it("returns a string in the format DIR-XXXXXX (6 uppercase alphanumeric chars)", () => {
    const code = generateDirectorCode();
    expect(code).toMatch(/^DIR-[A-Z0-9]{6}$/);
  });

  it("generates unique codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateDirectorCode()));
    expect(codes.size).toBeGreaterThan(15);
  });
});

// ─── resolveByDirectorCode ────────────────────────────────────────────────────
describe("resolveByDirectorCode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no tournaments exist", () => {
    expect(resolveByDirectorCode("ABCD1234")).toBeNull();
  });

  it("returns the tournament when the director code matches (case-insensitive)", () => {
    const directorCode = generateDirectorCode();
    registerTournament({
      id: "test-slug",
      name: "Test Tournament",
      inviteCode: "INVITE01",
      directorCode,
      format: "swiss",
      rounds: 5,
      maxPlayers: 16,
      timePreset: "10+5",
      timeBase: 10,
      timeIncrement: 5,
      ratingSystem: "chess.com",
      players: [],
      rounds_data: [],
      status: "registration",
      createdAt: Date.now(),
    });

    const result = resolveByDirectorCode(directorCode.toLowerCase());
    expect(result).not.toBeNull();
    expect(result?.id).toBe("test-slug");
  });

  it("returns null when the director code does not match any tournament", () => {
    registerTournament({
      id: "test-slug-2",
      name: "Another Tournament",
      inviteCode: "INVITE02",
      directorCode: "REALCODE",
      format: "swiss",
      rounds: 5,
      maxPlayers: 16,
      timePreset: "10+5",
      timeBase: 10,
      timeIncrement: 5,
      ratingSystem: "chess.com",
      players: [],
      rounds_data: [],
      status: "registration",
      createdAt: Date.now(),
    });

    expect(resolveByDirectorCode("WRONGCOD")).toBeNull();
  });
});

// ─── Director session helpers ─────────────────────────────────────────────────
describe("grantDirectorSession / hasDirectorSession / revokeDirectorSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hasDirectorSession returns false before granting", () => {
    expect(hasDirectorSession("my-tournament")).toBe(false);
  });

  it("hasDirectorSession returns true after granting", () => {
    grantDirectorSession("my-tournament");
    expect(hasDirectorSession("my-tournament")).toBe(true);
  });

  it("hasDirectorSession returns false for a different tournament", () => {
    grantDirectorSession("tournament-a");
    expect(hasDirectorSession("tournament-b")).toBe(false);
  });

  it("revokeDirectorSession removes access", () => {
    grantDirectorSession("my-tournament");
    revokeDirectorSession("my-tournament");
    expect(hasDirectorSession("my-tournament")).toBe(false);
  });

  it("revoking one tournament does not affect another", () => {
    grantDirectorSession("tournament-a");
    grantDirectorSession("tournament-b");
    revokeDirectorSession("tournament-a");
    expect(hasDirectorSession("tournament-b")).toBe(true);
  });
});
