/**
 * Tests for the "my game" participant highlight logic.
 *
 * The core logic lives inline in TournamentPage (myPlayerId derived value)
 * and PairingsPanel (isMyGame + auto-scroll). We extract and test the pure
 * helper functions here:
 *
 *  1. findMyPlayerId(players, username) — matches a player by username
 *  2. findMyGame(games, playerId)       — finds the game for a given player
 */

// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import type { Player } from "@/lib/tournamentData";

// ─── Helpers (extracted from TournamentPage logic) ────────────────────────────

type MinimalPlayer = Pick<Player, "id" | "username">;

/** Find the player ID for the registered username (case-insensitive). */
function findMyPlayerId(
  players: MinimalPlayer[],
  username: string | undefined
): string | undefined {
  if (!username) return undefined;
  return players.find(
    (p) => p.username?.toLowerCase() === username.toLowerCase()
  )?.id;
}

interface MinimalGame {
  id: string;
  whiteId: string;
  blackId: string;
}

/** Find the game that involves the given player ID. */
function findMyGame(
  games: MinimalGame[],
  playerId: string | undefined
): MinimalGame | undefined {
  if (!playerId) return undefined;
  return games.find(
    (g) => g.whiteId === playerId || g.blackId === playerId
  );
}

// ─── Test data ────────────────────────────────────────────────────────────────

const players: MinimalPlayer[] = [
  { id: "p1", username: "hikaru" },
  { id: "p2", username: "Magnus" },
  { id: "p3", username: "firouzja2003" },
  { id: "p4", username: "LevonAronian" },
];

const games: MinimalGame[] = [
  { id: "g1", whiteId: "p1", blackId: "p2" },
  { id: "g2", whiteId: "p3", blackId: "p4" },
];

// ─── findMyPlayerId ───────────────────────────────────────────────────────────

describe("findMyPlayerId", () => {
  it("returns the correct player id for an exact-case match", () => {
    expect(findMyPlayerId(players, "hikaru")).toBe("p1");
  });

  it("is case-insensitive", () => {
    expect(findMyPlayerId(players, "HIKARU")).toBe("p1");
    expect(findMyPlayerId(players, "hikARU")).toBe("p1");
  });

  it("matches a player whose stored username has mixed case", () => {
    expect(findMyPlayerId(players, "magnus")).toBe("p2");
    expect(findMyPlayerId(players, "MAGNUS")).toBe("p2");
  });

  it("returns undefined when no player matches", () => {
    expect(findMyPlayerId(players, "unknown_user")).toBeUndefined();
  });

  it("returns undefined when username is undefined", () => {
    expect(findMyPlayerId(players, undefined)).toBeUndefined();
  });

  it("returns undefined when username is empty string", () => {
    expect(findMyPlayerId(players, "")).toBeUndefined();
  });

  it("returns undefined when players array is empty", () => {
    expect(findMyPlayerId([], "hikaru")).toBeUndefined();
  });

  it("handles players without a username field gracefully", () => {
    const sparse = [{ id: "px", username: undefined as unknown as string }];
    expect(findMyPlayerId(sparse, "hikaru")).toBeUndefined();
  });

  it("returns the first match when duplicate usernames exist", () => {
    const dupes: MinimalPlayer[] = [
      { id: "pa", username: "hikaru" },
      { id: "pb", username: "hikaru" },
    ];
    expect(findMyPlayerId(dupes, "hikaru")).toBe("pa");
  });

  it("handles long usernames", () => {
    const longUser = "a".repeat(50);
    const p = [{ id: "px", username: longUser }];
    expect(findMyPlayerId(p, longUser.toUpperCase())).toBe("px");
  });
});

// ─── findMyGame ───────────────────────────────────────────────────────────────

describe("findMyGame", () => {
  it("finds the game where the player is White", () => {
    expect(findMyGame(games, "p1")).toEqual({ id: "g1", whiteId: "p1", blackId: "p2" });
  });

  it("finds the game where the player is Black", () => {
    expect(findMyGame(games, "p2")).toEqual({ id: "g1", whiteId: "p1", blackId: "p2" });
  });

  it("finds the correct game for the second pairing", () => {
    expect(findMyGame(games, "p3")).toEqual({ id: "g2", whiteId: "p3", blackId: "p4" });
    expect(findMyGame(games, "p4")).toEqual({ id: "g2", whiteId: "p3", blackId: "p4" });
  });

  it("returns undefined when player has no game (bye)", () => {
    expect(findMyGame(games, "p99")).toBeUndefined();
  });

  it("returns undefined when playerId is undefined", () => {
    expect(findMyGame(games, undefined)).toBeUndefined();
  });

  it("returns undefined when games array is empty", () => {
    expect(findMyGame([], "p1")).toBeUndefined();
  });

  it("returns the first matching game when a player appears in multiple games", () => {
    const multiGames: MinimalGame[] = [
      { id: "ga", whiteId: "p1", blackId: "p2" },
      { id: "gb", whiteId: "p1", blackId: "p3" }, // shouldn't happen in Swiss, but guard it
    ];
    expect(findMyGame(multiGames, "p1")).toEqual({ id: "ga", whiteId: "p1", blackId: "p2" });
  });
});

// ─── Integration: findMyPlayerId + findMyGame pipeline ────────────────────────

describe("findMyPlayerId + findMyGame pipeline", () => {
  it("resolves from username to game in two steps", () => {
    const id = findMyPlayerId(players, "firouzja2003");
    const game = findMyGame(games, id);
    expect(game?.id).toBe("g2");
  });

  it("returns undefined game when username is not registered", () => {
    const id = findMyPlayerId(players, "notaplayer");
    const game = findMyGame(games, id);
    expect(game).toBeUndefined();
  });

  it("returns undefined game when player has a bye (no game)", () => {
    const byePlayers: MinimalPlayer[] = [...players, { id: "p5", username: "byeplayer" }];
    const id = findMyPlayerId(byePlayers, "byeplayer");
    const game = findMyGame(games, id);
    expect(game).toBeUndefined();
  });

  it("works correctly when username casing differs between registration and player list", () => {
    const id = findMyPlayerId(players, "LEVONARONIAN");
    const game = findMyGame(games, id);
    expect(game?.id).toBe("g2");
  });
});
