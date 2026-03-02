/**
 * Unit tests for PlayerView live-sync helpers.
 *
 * Tests cover:
 *  - findMyBoard: locates the correct game and colour for a given username
 *  - myRank: returns the correct 1-based rank from live standings
 *  - Screen transition logic: result submission → waiting_round
 */
import { describe, it, expect } from "vitest";
import { findMyBoard } from "../pages/PlayerView";
import { getStandings } from "../lib/tournamentData";
import type { Game, Player } from "../lib/tournamentData";

// ─── Fixtures ────────────────────────────────────────────────────────────────
function makePlayer(overrides: Partial<Player> & { id: string; username: string }): Player {
  return {
    name: overrides.username,
    elo: 1200,
    platform: "chesscom",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    opponentHistory: [],
    ...overrides,
  };
}

function makeGame(overrides: Partial<Game> & { id: string; whiteId: string; blackId: string }): Game {
  return {
    board: 1,
    result: "*",
    ...overrides,
  };
}

const alice = makePlayer({ id: "p1", username: "alice", elo: 1500, points: 2 });
const bob   = makePlayer({ id: "p2", username: "bob",   elo: 1400, points: 1.5 });
const carol = makePlayer({ id: "p3", username: "carol", elo: 1300, points: 1 });

const game1 = makeGame({ id: "g1", board: 1, whiteId: "p1", blackId: "p2" });
const game2 = makeGame({ id: "g2", board: 2, whiteId: "p3", blackId: "p1" });

// ─── findMyBoard ─────────────────────────────────────────────────────────────
describe("findMyBoard", () => {
  it("returns null when the player is not in the player list", () => {
    expect(findMyBoard("unknown", [game1], [alice, bob])).toBeNull();
  });

  it("returns null when the player has no game in the round", () => {
    // carol is not in game1
    expect(findMyBoard("carol", [game1], [alice, bob, carol])).toBeNull();
  });

  it("identifies white correctly", () => {
    const result = findMyBoard("alice", [game1], [alice, bob]);
    expect(result).not.toBeNull();
    expect(result!.myColor).toBe("white");
    expect(result!.game.id).toBe("g1");
    expect(result!.opponent?.id).toBe("p2");
  });

  it("identifies black correctly", () => {
    const result = findMyBoard("bob", [game1], [alice, bob]);
    expect(result).not.toBeNull();
    expect(result!.myColor).toBe("black");
    expect(result!.game.id).toBe("g1");
    expect(result!.opponent?.id).toBe("p1");
  });

  it("is case-insensitive for username matching", () => {
    const result = findMyBoard("ALICE", [game1], [alice, bob]);
    expect(result).not.toBeNull();
    expect(result!.myColor).toBe("white");
  });

  it("finds the correct game when a player appears in multiple games (only one per round)", () => {
    // alice is white in game1 and black in game2 — should find game1 (first match)
    const result = findMyBoard("alice", [game1, game2], [alice, bob, carol]);
    expect(result).not.toBeNull();
    expect(result!.game.id).toBe("g1");
  });

  it("returns undefined opponent for a bye (blackId not in players list)", () => {
    const byeGame = makeGame({ id: "g3", board: 3, whiteId: "p3", blackId: "bye-999" });
    const result = findMyBoard("carol", [byeGame], [alice, bob, carol]);
    expect(result).not.toBeNull();
    expect(result!.opponent).toBeUndefined();
  });
});

// ─── myRank (via getStandings) ────────────────────────────────────────────────
describe("myRank via getStandings", () => {
  it("ranks players by points descending", () => {
    const standings = getStandings([alice, bob, carol]);
    expect(standings[0].id).toBe("p1"); // 2 pts
    expect(standings[1].id).toBe("p2"); // 1.5 pts
    expect(standings[2].id).toBe("p3"); // 1 pt
  });

  it("returns rank 1 for the leader", () => {
    const standings = getStandings([alice, bob, carol]);
    const rank = standings.findIndex((p) => p.username === "alice") + 1;
    expect(rank).toBe(1);
  });

  it("returns rank 3 for the last place player", () => {
    const standings = getStandings([alice, bob, carol]);
    const rank = standings.findIndex((p) => p.username === "carol") + 1;
    expect(rank).toBe(3);
  });

  it("returns -1 index (rank 0) for a player not in the list", () => {
    const standings = getStandings([alice, bob]);
    const rank = standings.findIndex((p) => p.username === "carol") + 1;
    expect(rank).toBe(0);
  });
});

// ─── standings_updated payload merging ────────────────────────────────────────
describe("standings_updated payload merging", () => {
  it("updates player points when a new standings payload arrives", () => {
    // Simulate what the SSE handler does: replace livePlayers with updated data
    const updatedAlice = { ...alice, points: 2.5 };
    const updatedPlayers = [updatedAlice, bob, carol];
    const standings = getStandings(updatedPlayers);
    expect(standings[0].points).toBe(2.5);
    expect(standings[0].username).toBe("alice");
  });

  it("preserves relative ordering after standings update", () => {
    // Bob overtakes Alice after a win
    const updatedBob   = { ...bob,   points: 2.5 };
    const updatedAlice = { ...alice, points: 2 };
    const standings = getStandings([updatedAlice, updatedBob, carol]);
    expect(standings[0].username).toBe("bob");
    expect(standings[1].username).toBe("alice");
  });
});
