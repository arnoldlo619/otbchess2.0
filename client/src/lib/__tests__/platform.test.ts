/**
 * OTB Chess Platform — Core Logic Unit Tests
 * Covers: tournamentRegistry, swiss pairing engine, directorState helpers
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Mock localStorage ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });
Object.defineProperty(global, "window", {
  value: { localStorage: localStorageMock, dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} },
  writable: true,
});

// ─── Import modules after mocking ─────────────────────────────────────────────
import {
  registerTournament,
  getTournamentConfig,
  getTournamentByCode,
  listTournaments,
  resolveTournament,
  type TournamentConfig,
} from "../tournamentRegistry";

import {
  computeStandings,
} from "../swiss";

import {
  addPlayerToTournament,
  loadTournamentState,
} from "../directorState";

import type { Player } from "../tournamentData";

// ─── Test Fixtures ─────────────────────────────────────────────────────────────
const SAMPLE_CONFIG: TournamentConfig = {
  id: "test-open-2026",
  inviteCode: "TESTCODE",
  name: "Test Open 2026",
  venue: "Test Venue",
  date: "March 1, 2026",
  description: "A test tournament",
  format: "swiss",
  rounds: 5,
  maxPlayers: 32,
  timeBase: 10,
  timeIncrement: 5,
  timePreset: "10+5",
  ratingSystem: "chess.com",
  createdAt: new Date().toISOString(),
};

const SAMPLE_PLAYER: Player = {
  id: "player-1",
  name: "Magnus Carlsen",
  username: "magnuscarlsen",
  elo: 2850,
  country: "NO",
  title: "GM",
  points: 0,
  buchholz: 0,
  colorHistory: [],
  opponents: [],
};

// ─── Tournament Registry Tests ─────────────────────────────────────────────────
describe("Tournament Registry", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => localStorageMock.clear());

  it("registers a tournament and retrieves it by ID", () => {
    registerTournament(SAMPLE_CONFIG);
    const config = getTournamentConfig("test-open-2026");
    expect(config).not.toBeNull();
    expect(config?.name).toBe("Test Open 2026");
    expect(config?.inviteCode).toBe("TESTCODE");
  });

  it("retrieves a tournament by invite code", () => {
    registerTournament(SAMPLE_CONFIG);
    const config = getTournamentByCode("TESTCODE");
    expect(config).not.toBeNull();
    expect(config?.id).toBe("test-open-2026");
  });

  it("returns null for unknown tournament ID", () => {
    const config = getTournamentConfig("nonexistent-tournament");
    expect(config).toBeNull();
  });

  it("returns null for unknown invite code", () => {
    const config = getTournamentByCode("XXXXXXXX");
    expect(config).toBeNull();
  });

  it("lists all registered tournaments", () => {
    registerTournament(SAMPLE_CONFIG);
    registerTournament({ ...SAMPLE_CONFIG, id: "test-open-2027", inviteCode: "TEST2027", name: "Test Open 2027" });
    const list = listTournaments();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("resolveTournament resolves by invite code", () => {
    registerTournament(SAMPLE_CONFIG);
    const config = resolveTournament("TESTCODE");
    expect(config?.id).toBe("test-open-2026");
  });

  it("resolveTournament resolves by slug/ID", () => {
    registerTournament(SAMPLE_CONFIG);
    const config = resolveTournament("test-open-2026");
    expect(config?.inviteCode).toBe("TESTCODE");
  });

  it("resolveTournament returns null for unknown code", () => {
    const config = resolveTournament("ZZZZZZZZZ");
    expect(config).toBeNull();
  });
});

// ─── Player Registration Tests ─────────────────────────────────────────────────
describe("Player Registration (addPlayerToTournament)", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => localStorageMock.clear());

  it("adds a player to a new tournament state", () => {
    registerTournament(SAMPLE_CONFIG);
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER);
    const state = loadTournamentState("test-open-2026");
    expect(state).not.toBeNull();
    expect(state?.players).toHaveLength(1);
    expect(state?.players[0].name).toBe("Magnus Carlsen");
  });

  it("adds multiple players without duplicates", () => {
    registerTournament(SAMPLE_CONFIG);
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER);
    addPlayerToTournament("test-open-2026", { ...SAMPLE_PLAYER, id: "player-2", name: "Hikaru Nakamura", username: "hikaru" });
    const state = loadTournamentState("test-open-2026");
    expect(state?.players).toHaveLength(2);
  });

  it("does not add duplicate players (same ID)", () => {
    registerTournament(SAMPLE_CONFIG);
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER);
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER); // same player again
    const state = loadTournamentState("test-open-2026");
    expect(state?.players).toHaveLength(1);
  });

  it("stamps joinedAt on the player", () => {
    registerTournament(SAMPLE_CONFIG);
    const before = Date.now();
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER);
    const after = Date.now();
    const state = loadTournamentState("test-open-2026");
    const joinedAt = state?.players[0].joinedAt;
    expect(joinedAt).toBeDefined();
    expect(joinedAt).toBeGreaterThanOrEqual(before);
    expect(joinedAt).toBeLessThanOrEqual(after);
  });
});

// ─── Swiss Engine Tests ────────────────────────────────────────────────────────
describe("computeStandings (Swiss Engine)", () => {
  const makePlayers = (n: number): Player[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      username: `player${i + 1}`,
      elo: 2000 - i * 50,
      country: "US",
      title: undefined,
      points: i % 2 === 0 ? 1 : 0,
      buchholz: 0,
      colorHistory: [],
      opponents: [],
    }));

  it("returns standings sorted by points descending", () => {
    const players = makePlayers(6);
    const standings = computeStandings(players, []);
    for (let i = 0; i < standings.length - 1; i++) {
      expect(standings[i].points).toBeGreaterThanOrEqual(standings[i + 1].points);
    }
  });

  it("returns one row per player", () => {
    const players = makePlayers(8);
    const standings = computeStandings(players, []);
    expect(standings).toHaveLength(8);
  });

  it("returns rank starting from 1", () => {
    const players = makePlayers(4);
    const standings = computeStandings(players, []);
    expect(standings[0].rank).toBe(1);
    expect(standings[standings.length - 1].rank).toBe(standings.length);
  });

  it("handles empty player list gracefully", () => {
    const standings = computeStandings([], []);
    expect(standings).toHaveLength(0);
  });
});

// ─── loadTournamentState Tests ─────────────────────────────────────────────────
describe("loadTournamentState", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => localStorageMock.clear());

  it("returns null for unknown tournament", () => {
    const state = loadTournamentState("nonexistent-id");
    expect(state).toBeNull();
  });

  it("returns a valid state after player registration", () => {
    registerTournament(SAMPLE_CONFIG);
    addPlayerToTournament("test-open-2026", SAMPLE_PLAYER);
    const state = loadTournamentState("test-open-2026");
    expect(state?.status).toBe("registration");
    expect(state?.currentRound).toBe(0);
    expect(state?.totalRounds).toBe(5);
  });
});
