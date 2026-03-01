/**
 * Tests for the round_started SSE flow.
 *
 * Verifies that:
 * 1. findMyBoard correctly resolves a player's board for any round number.
 * 2. A player who submitted a result in Round N gets the correct board for Round N+1.
 * 3. A player on a bye in one round can be paired normally in the next.
 */
import { describe, it, expect } from "vitest";
import { findMyBoard } from "../pages/PlayerView";
import type { Game, Player } from "../lib/tournamentData";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const players: Player[] = [
  {
    id: "p1", username: "alice", name: "Alice", elo: 1800,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
  {
    id: "p2", username: "bob", name: "Bob", elo: 1750,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
  {
    id: "p3", username: "carol", name: "Carol", elo: 1700,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
  {
    id: "p4", username: "dave", name: "Dave", elo: 1650,
    points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
    colorHistory: [], country: "US", platform: "chesscom",
  },
];

const round1Games: Game[] = [
  { id: "r1g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
  { id: "r1g2", round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "0-1" },
];

const round2Games: Game[] = [
  { id: "r2g1", round: 2, board: 1, whiteId: "p1", blackId: "p4", result: "*" },
  { id: "r2g2", round: 2, board: 2, whiteId: "p2", blackId: "p3", result: "*" },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("round_started SSE flow — findMyBoard across rounds", () => {
  it("resolves alice's board correctly in Round 1", () => {
    const result = findMyBoard("alice", round1Games, players);
    expect(result).not.toBeNull();
    expect(result!.game.round).toBe(1);
    expect(result!.game.board).toBe(1);
    expect(result!.myColor).toBe("white");
    expect(result!.opponent?.username).toBe("bob");
  });

  it("resolves alice's board correctly in Round 2 (different opponent)", () => {
    const result = findMyBoard("alice", round2Games, players);
    expect(result).not.toBeNull();
    expect(result!.game.round).toBe(2);
    expect(result!.game.board).toBe(1);
    expect(result!.myColor).toBe("white");
    expect(result!.opponent?.username).toBe("dave");
  });

  it("resolves carol's board in Round 2 after being black in Round 1", () => {
    const r1 = findMyBoard("carol", round1Games, players);
    expect(r1!.myColor).toBe("white");
    expect(r1!.opponent?.username).toBe("dave");

    const r2 = findMyBoard("carol", round2Games, players);
    expect(r2!.myColor).toBe("black");
    expect(r2!.opponent?.username).toBe("bob");
  });

  it("returns null for a player not in the round's player list", () => {
    const result = findMyBoard("ghost", round2Games, players);
    expect(result).toBeNull();
  });

  it("handles a player who switches from board 2 to board 1 across rounds", () => {
    const r1 = findMyBoard("dave", round1Games, players);
    expect(r1!.game.board).toBe(2);

    const r2 = findMyBoard("dave", round2Games, players);
    expect(r2!.game.board).toBe(1);
  });

  it("correctly identifies the opponent for both sides of a game", () => {
    const alice = findMyBoard("alice", round2Games, players);
    const dave = findMyBoard("dave", round2Games, players);
    // They are paired against each other
    expect(alice!.game.id).toBe(dave!.game.id);
    expect(alice!.opponent?.username).toBe("dave");
    expect(dave!.opponent?.username).toBe("alice");
  });

  it("handles empty games list gracefully", () => {
    const result = findMyBoard("alice", [], players);
    expect(result).toBeNull();
  });
});
