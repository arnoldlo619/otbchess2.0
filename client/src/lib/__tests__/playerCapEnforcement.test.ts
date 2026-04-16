/**
 * @vitest-environment jsdom
 *
 * Tests for player cap enforcement in addPlayerToTournament.
 */
import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {addPlayerToTournament} from "../directorState";
import type { Player } from "../tournamentData";

// ── helpers ────────────────────────────────────────────────────────────────────

function makePlayer(username: string): Player {
  return {
    id: `player-${username}-1`,
    name: username,
    username,
    elo: 1200,
    title: undefined,
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    platform: "chesscom",
    joinedAt: Date.now(),
  };
}

const TOURNAMENT_ID = "test-cap-tournament";
const REGISTRY_KEY = "otb-tournament-registry-v1"; // matches tournamentRegistry.ts
const SCHEMA_VERSION = 3; // matches directorState.ts
const STATE_KEY = `otb-director-state-v${SCHEMA_VERSION}-${TOURNAMENT_ID}`;

function seedRegistry(maxPlayers: number) {
  const config = {
    id: TOURNAMENT_ID,
    name: "Cap Test",
    inviteCode: "CAPTEST",
    directorCode: "DIR123",
    format: "swiss",
    rounds: 5,
    maxPlayers,
    ratingSystem: "chesscom",
    timeBase: 600,
    timeIncrement: 5,
    timePreset: "Rapid 10+5",
    date: "2026-02-27",
    venue: "Test Venue",
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(REGISTRY_KEY, JSON.stringify([config]));
}

function seedState(players: Player[]) {
  const persisted = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    state: {
      tournamentId: TOURNAMENT_ID,
      tournamentName: "Cap Test",
      totalRounds: 5,
      currentRound: 0,
      status: "registration",
      players,
      rounds: [],
    },
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(persisted));
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe("addPlayerToTournament — cap enforcement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns { success: true, reason: 'ok' } when tournament has room", () => {
    seedRegistry(4);
    seedState([makePlayer("alice"), makePlayer("bob")]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("charlie"));
    expect(result).toEqual({ success: true, reason: "ok" });
  });

  it("adds the player to storage when there is room", () => {
    seedRegistry(4);
    seedState([makePlayer("alice")]);
    addPlayerToTournament(TOURNAMENT_ID, makePlayer("bob"));
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.state.players).toHaveLength(2);
    expect(parsed.state.players[1].username).toBe("bob");
  });

  it("returns { success: false, reason: 'full' } when at cap", () => {
    seedRegistry(2);
    seedState([makePlayer("alice"), makePlayer("bob")]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("charlie"));
    expect(result).toEqual({ success: false, reason: "full" });
  });

  it("does NOT add the player to storage when at cap", () => {
    seedRegistry(2);
    seedState([makePlayer("alice"), makePlayer("bob")]);
    addPlayerToTournament(TOURNAMENT_ID, makePlayer("charlie"));
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.state.players).toHaveLength(2);
  });

  it("returns { success: false, reason: 'full' } when over cap", () => {
    seedRegistry(1);
    seedState([makePlayer("alice"), makePlayer("bob")]); // already over cap
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("charlie"));
    expect(result).toEqual({ success: false, reason: "full" });
  });

  it("allows exactly maxPlayers players (boundary: last slot)", () => {
    seedRegistry(3);
    seedState([makePlayer("alice"), makePlayer("bob")]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("charlie"));
    expect(result).toEqual({ success: true, reason: "ok" });
  });

  it("blocks the (maxPlayers + 1)th player", () => {
    seedRegistry(3);
    seedState([makePlayer("alice"), makePlayer("bob"), makePlayer("charlie")]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("dave"));
    expect(result).toEqual({ success: false, reason: "full" });
  });

  it("returns { success: false, reason: 'duplicate' } for same username", () => {
    seedRegistry(10);
    seedState([makePlayer("alice")]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("alice"));
    expect(result).toEqual({ success: false, reason: "duplicate" });
  });

  it("returns { success: false, reason: 'unknown' } for unregistered tournament", () => {
    // No registry seeded
    const result = addPlayerToTournament("nonexistent-id", makePlayer("alice"));
    expect(result).toEqual({ success: false, reason: "unknown" });
  });

  it("bootstraps state from registry when no persisted state exists", () => {
    seedRegistry(5);
    // No state seeded — addPlayerToTournament should bootstrap from registry
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("alice"));
    expect(result).toEqual({ success: true, reason: "ok" });
    const raw = localStorage.getItem(STATE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.players).toHaveLength(1);
  });

  it("cap of 0 blocks all registrations", () => {
    seedRegistry(0);
    seedState([]);
    const result = addPlayerToTournament(TOURNAMENT_ID, makePlayer("alice"));
    expect(result).toEqual({ success: false, reason: "full" });
  });

  it("cap of 1 allows exactly one player", () => {
    seedRegistry(1);
    seedState([]);
    const first = addPlayerToTournament(TOURNAMENT_ID, makePlayer("alice"));
    expect(first).toEqual({ success: true, reason: "ok" });
    const second = addPlayerToTournament(TOURNAMENT_ID, makePlayer("bob"));
    expect(second).toEqual({ success: false, reason: "full" });
  });

  it("large cap (32) allows many players", () => {
    seedRegistry(32);
    seedState([]);
    for (let i = 0; i < 32; i++) {
      const r = addPlayerToTournament(TOURNAMENT_ID, makePlayer(`player${i}`));
      expect(r.success).toBe(true);
    }
    const overflow = addPlayerToTournament(TOURNAMENT_ID, makePlayer("overflow"));
    expect(overflow).toEqual({ success: false, reason: "full" });
  });
});
