/**
 * Unit tests for updateTournamentConfig — the helper that persists
 * tournament settings edits from the Director Dashboard Settings panel.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTournament,
  updateTournamentConfig,
  getTournamentConfig,
  type TournamentConfig,
} from "../tournamentRegistry";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: "test-open-2026",
    inviteCode: "TEST1234",
    directorCode: "DIR-ABCDEF",
    name: "Test Open 2026",
    venue: "Test Club",
    date: "2026-03-01",
    description: "",
    format: "swiss",
    rounds: 5,
    maxPlayers: 16,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("updateTournamentConfig", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("returns null when tournament does not exist", () => {
    const result = updateTournamentConfig("nonexistent-id", { name: "New Name" });
    expect(result).toBeNull();
  });

  it("updates the tournament name", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { name: "Updated Open 2026" });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated Open 2026");
  });

  it("persists the name update to localStorage", () => {
    registerTournament(makeConfig());
    updateTournamentConfig("test-open-2026", { name: "Persisted Name" });
    const loaded = getTournamentConfig("test-open-2026");
    expect(loaded?.name).toBe("Persisted Name");
  });

  it("updates the venue", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { venue: "Marshall Chess Club" });
    expect(updated!.venue).toBe("Marshall Chess Club");
  });

  it("updates the date", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { date: "2026-06-15" });
    expect(updated!.date).toBe("2026-06-15");
  });

  it("updates the description", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { description: "Prizes for top 3" });
    expect(updated!.description).toBe("Prizes for top 3");
  });

  it("updates the format", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { format: "roundrobin" });
    expect(updated!.format).toBe("roundrobin");
  });

  it("updates the rounds count", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { rounds: 7 });
    expect(updated!.rounds).toBe(7);
  });

  it("updates the maxPlayers", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { maxPlayers: 32 });
    expect(updated!.maxPlayers).toBe(32);
  });

  it("updates the time control fields", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", {
      timeBase: 15,
      timeIncrement: 10,
      timePreset: "15+10",
    });
    expect(updated!.timeBase).toBe(15);
    expect(updated!.timeIncrement).toBe(10);
    expect(updated!.timePreset).toBe("15+10");
  });

  it("updates the rating system", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { ratingSystem: "lichess" });
    expect(updated!.ratingSystem).toBe("lichess");
  });

  it("does not modify immutable fields (id, inviteCode, directorCode, createdAt)", () => {
    const original = makeConfig();
    registerTournament(original);
    const updated = updateTournamentConfig("test-open-2026", { name: "Changed" });
    expect(updated!.id).toBe(original.id);
    expect(updated!.inviteCode).toBe(original.inviteCode);
    expect(updated!.directorCode).toBe(original.directorCode);
    expect(updated!.createdAt).toBe(original.createdAt);
  });

  it("applies multiple fields in a single patch", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", {
      name: "Multi-field Update",
      venue: "New Venue",
      rounds: 9,
      ratingSystem: "fide",
    });
    expect(updated!.name).toBe("Multi-field Update");
    expect(updated!.venue).toBe("New Venue");
    expect(updated!.rounds).toBe(9);
    expect(updated!.ratingSystem).toBe("fide");
  });

  it("does not affect other tournaments in the registry", () => {
    registerTournament(makeConfig({ id: "tournament-a", inviteCode: "AAAA1111" }));
    registerTournament(makeConfig({ id: "tournament-b", inviteCode: "BBBB2222", name: "Tournament B" }));
    updateTournamentConfig("tournament-a", { name: "Updated A" });
    const b = getTournamentConfig("tournament-b");
    expect(b?.name).toBe("Tournament B");
  });

  it("preserves unchanged fields after a partial update", () => {
    const original = makeConfig();
    registerTournament(original);
    updateTournamentConfig("test-open-2026", { name: "Only Name Changed" });
    const loaded = getTournamentConfig("test-open-2026");
    expect(loaded?.venue).toBe(original.venue);
    expect(loaded?.rounds).toBe(original.rounds);
    expect(loaded?.timeBase).toBe(original.timeBase);
    expect(loaded?.ratingSystem).toBe(original.ratingSystem);
  });

  it("returns the full updated config object", () => {
    registerTournament(makeConfig());
    const updated = updateTournamentConfig("test-open-2026", { name: "Full Return Test" });
    // Should have all TournamentConfig fields
    expect(updated).toHaveProperty("id");
    expect(updated).toHaveProperty("inviteCode");
    expect(updated).toHaveProperty("directorCode");
    expect(updated).toHaveProperty("rounds");
    expect(updated).toHaveProperty("createdAt");
  });

  it("handles empty string values for optional text fields", () => {
    registerTournament(makeConfig({ venue: "Old Venue", description: "Old desc" }));
    const updated = updateTournamentConfig("test-open-2026", { venue: "", description: "" });
    expect(updated!.venue).toBe("");
    expect(updated!.description).toBe("");
  });

  it("handles updating a tournament that was previously updated", () => {
    registerTournament(makeConfig());
    updateTournamentConfig("test-open-2026", { name: "First Update" });
    const second = updateTournamentConfig("test-open-2026", { name: "Second Update" });
    expect(second!.name).toBe("Second Update");
    const loaded = getTournamentConfig("test-open-2026");
    expect(loaded?.name).toBe("Second Update");
  });

  it("handles all rating system values", () => {
    const systems: TournamentConfig["ratingSystem"][] = ["chess.com", "lichess", "fide", "unrated"];
    for (const system of systems) {
      registerTournament(makeConfig({ id: `test-${system}`, inviteCode: system.toUpperCase().slice(0, 8) }));
      const updated = updateTournamentConfig(`test-${system}`, { ratingSystem: system });
      expect(updated!.ratingSystem).toBe(system);
    }
  });

  it("handles all format values", () => {
    const formats: TournamentConfig["format"][] = ["swiss", "roundrobin", "elimination"];
    for (const format of formats) {
      registerTournament(makeConfig({ id: `test-${format}`, inviteCode: format.toUpperCase().slice(0, 8) }));
      const updated = updateTournamentConfig(`test-${format}`, { format });
      expect(updated!.format).toBe(format);
    }
  });
});
