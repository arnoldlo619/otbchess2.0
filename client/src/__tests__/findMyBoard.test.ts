/**
 * Tests for the findMyBoard helper in PlayerView.tsx
 * Verifies that a player can correctly locate their game, color, and opponent
 * from the Round 1 pairings broadcast by the server.
 */
import { describe, it, expect } from "vitest";
import { findMyBoard } from "../pages/PlayerView";
import type { Game, Player } from "../lib/tournamentData";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const players: Player[] = [
  {
    id: "p1", username: "magnus", name: "Magnus C", elo: 2800,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "NO", platform: "chesscom",
  },
  {
    id: "p2", username: "hikaru", name: "Hikaru N", elo: 2750,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
  {
    id: "p3", username: "fabiano", name: "Fabiano C", elo: 2720,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
  {
    id: "p4", username: "ding", name: "Ding L", elo: 2700,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "CN", platform: "chesscom",
  },
];

const games: Game[] = [
  { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" },
  { id: "g2", round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "*" },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("findMyBoard", () => {
  it("returns the correct game and color for the white player", () => {
    const result = findMyBoard("magnus", games, players);
    expect(result).not.toBeNull();
    expect(result!.game.id).toBe("g1");
    expect(result!.game.board).toBe(1);
    expect(result!.myColor).toBe("white");
    expect(result!.opponent?.username).toBe("hikaru");
  });

  it("returns the correct game and color for the black player", () => {
    const result = findMyBoard("hikaru", games, players);
    expect(result).not.toBeNull();
    expect(result!.game.id).toBe("g1");
    expect(result!.myColor).toBe("black");
    expect(result!.opponent?.username).toBe("magnus");
  });

  it("works for a player on board 2", () => {
    const result = findMyBoard("fabiano", games, players);
    expect(result).not.toBeNull();
    expect(result!.game.board).toBe(2);
    expect(result!.myColor).toBe("white");
    expect(result!.opponent?.username).toBe("ding");
  });

  it("is case-insensitive for username lookup", () => {
    const result = findMyBoard("MAGNUS", games, players);
    expect(result).not.toBeNull();
    expect(result!.myColor).toBe("white");
  });

  it("returns null when the player is not in the player list", () => {
    const result = findMyBoard("unknown_player", games, players);
    expect(result).toBeNull();
  });

  it("returns null when the player is in the list but has no game (should not happen in valid data)", () => {
    const extraPlayer: Player = {
      id: "p99", username: "ghost", name: "Ghost", elo: 1000,
      points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
      colorHistory: [], country: "", platform: "chesscom",
    };
    const result = findMyBoard("ghost", games, [...players, extraPlayer]);
    expect(result).toBeNull();
  });

  it("returns undefined opponent when opponent id is not in players list", () => {
    const orphanGames: Game[] = [
      { id: "g99", round: 1, board: 3, whiteId: "p1", blackId: "p-missing", result: "*" },
    ];
    const result = findMyBoard("magnus", orphanGames, players);
    expect(result).not.toBeNull();
    expect(result!.opponent).toBeUndefined();
  });
});
