/**
 * Tests for the "Forgot your director code?" feature.
 * Covers: listTournaments returning all local tournaments with directorCode,
 * resolveByDirectorCode case-insensitive lookup, and the modal's
 * "Use this code" flow.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTournament,
  listTournaments,
  resolveByDirectorCode,
  generateDirectorCode,
  type TournamentConfig,
} from "@/lib/tournamentRegistry";

function makeTournament(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    inviteCode: "TEST1234",
    directorCode: generateDirectorCode(),
    name: "Test Open",
    venue: "Club Room",
    date: "2026-03-01",
    description: "",
    format: "swiss",
    rounds: 5,
    maxPlayers: 32,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Forgot director code — listTournaments", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty array when no tournaments exist", () => {
    expect(listTournaments()).toHaveLength(0);
  });

  it("returns all registered tournaments in reverse-creation order", () => {
    const t1 = makeTournament({ name: "Spring Open" });
    const t2 = makeTournament({ name: "Summer Cup" });
    registerTournament(t1);
    registerTournament(t2);
    const list = listTournaments();
    expect(list).toHaveLength(2);
    // Most recent first
    expect(list[0].name).toBe("Summer Cup");
    expect(list[1].name).toBe("Spring Open");
  });

  it("each tournament in the list has a directorCode", () => {
    registerTournament(makeTournament());
    registerTournament(makeTournament());
    listTournaments().forEach((t) => {
      expect(t.directorCode).toMatch(/^DIR-[A-Z0-9]{6}$/);
    });
  });
});

describe("Forgot director code — resolveByDirectorCode (case-insensitive)", () => {
  beforeEach(() => localStorage.clear());

  it("resolves a tournament by its exact director code", () => {
    const t = makeTournament({ directorCode: "DIR-ABC123" });
    registerTournament(t);
    expect(resolveByDirectorCode("DIR-ABC123")).not.toBeNull();
  });

  it("resolves case-insensitively (lowercase input)", () => {
    const t = makeTournament({ directorCode: "DIR-ABC123" });
    registerTournament(t);
    expect(resolveByDirectorCode("dir-abc123")).not.toBeNull();
  });

  it("returns null for an unknown code", () => {
    expect(resolveByDirectorCode("DIR-XXXXXX")).toBeNull();
  });

  it("returns the correct tournament when multiple exist", () => {
    const t1 = makeTournament({ name: "Alpha", directorCode: "DIR-AAAA11" });
    const t2 = makeTournament({ name: "Beta",  directorCode: "DIR-BBBB22" });
    registerTournament(t1);
    registerTournament(t2);
    expect(resolveByDirectorCode("DIR-AAAA11")?.name).toBe("Alpha");
    expect(resolveByDirectorCode("DIR-BBBB22")?.name).toBe("Beta");
  });
});

describe("Forgot director code — modal use-this-code flow simulation", () => {
  beforeEach(() => localStorage.clear());

  it("filling the input with a retrieved code allows dashboard access", () => {
    const t = makeTournament({ directorCode: "DIR-USE123" });
    registerTournament(t);

    // Simulate: user opens modal, clicks "Use this", code fills input
    const tournaments = listTournaments();
    const found = tournaments.find((x) => x.directorCode === "DIR-USE123");
    expect(found).toBeDefined();

    // Simulate: code is passed to resolveByDirectorCode
    const resolved = resolveByDirectorCode(found!.directorCode);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(t.id);
  });
});
