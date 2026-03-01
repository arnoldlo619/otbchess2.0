/**
 * Tests for the Tournament Complete screen logic.
 *
 * Verifies:
 * 1. Standings are sorted correctly (points desc, buchholz tiebreak, ELO tiebreak).
 * 2. The current player's rank is found correctly in various positions.
 * 3. Podium order is correct (2nd, 1st, 3rd for visual left-center-right layout).
 * 4. Edge cases: single player, tied scores, player not in list.
 */
import { describe, it, expect } from "vitest";
import type { Player } from "../lib/tournamentData";

// ─── Helpers (mirror the logic in TournamentCompleteScreen) ──────────────────

function sortStandings(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.elo - a.elo;
  });
}

function findMyRank(sorted: Player[], username: string): number {
  return (
    sorted.findIndex(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    ) + 1
  );
}

function buildPodiumOrder(sorted: Player[]): (Player | undefined)[] {
  return [sorted[1], sorted[0], sorted[2]];
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  username: string,
  points: number,
  buchholz: number,
  elo: number
): Player {
  return {
    id,
    username,
    name: username,
    elo,
    points,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz,
    colorHistory: [],
    country: "US",
    platform: "chesscom",
  };
}

const alice = makePlayer("p1", "alice", 3.5, 8.0, 1800);
const bob = makePlayer("p2", "bob", 2.5, 7.0, 1750);
const carol = makePlayer("p3", "carol", 2.5, 6.5, 1700);
const dave = makePlayer("p4", "dave", 2.0, 6.0, 1650);
const eve = makePlayer("p5", "eve", 1.0, 4.0, 1600);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Tournament Complete — standings sorting", () => {
  it("sorts by points descending", () => {
    const sorted = sortStandings([dave, alice, eve, bob, carol]);
    expect(sorted[0].username).toBe("alice");
    expect(sorted[4].username).toBe("eve");
  });

  it("uses buchholz as tiebreak when points are equal", () => {
    const sorted = sortStandings([carol, bob, alice, dave, eve]);
    // bob (2.5, 7.0) should beat carol (2.5, 6.5)
    const bobIdx = sorted.findIndex((p) => p.username === "bob");
    const carolIdx = sorted.findIndex((p) => p.username === "carol");
    expect(bobIdx).toBeLessThan(carolIdx);
  });

  it("uses ELO as final tiebreak when points and buchholz are equal", () => {
    const p1 = makePlayer("x1", "higher_elo", 2.0, 5.0, 1900);
    const p2 = makePlayer("x2", "lower_elo", 2.0, 5.0, 1700);
    const sorted = sortStandings([p2, p1]);
    expect(sorted[0].username).toBe("higher_elo");
  });

  it("preserves order of a single player", () => {
    const sorted = sortStandings([alice]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].username).toBe("alice");
  });

  it("handles an empty player list", () => {
    const sorted = sortStandings([]);
    expect(sorted).toHaveLength(0);
  });
});

describe("Tournament Complete — player rank detection", () => {
  const sorted = sortStandings([dave, alice, eve, bob, carol]);

  it("finds rank 1 for the winner", () => {
    expect(findMyRank(sorted, "alice")).toBe(1);
  });

  it("finds rank 5 for the last place player", () => {
    expect(findMyRank(sorted, "eve")).toBe(5);
  });

  it("finds middle ranks correctly", () => {
    expect(findMyRank(sorted, "bob")).toBe(2);
    expect(findMyRank(sorted, "carol")).toBe(3);
    expect(findMyRank(sorted, "dave")).toBe(4);
  });

  it("returns 0 when the player is not in the standings", () => {
    expect(findMyRank(sorted, "ghost")).toBe(0);
  });

  it("is case-insensitive for username matching", () => {
    expect(findMyRank(sorted, "ALICE")).toBe(1);
    expect(findMyRank(sorted, "Alice")).toBe(1);
  });
});

describe("Tournament Complete — podium order (2nd, 1st, 3rd)", () => {
  const sorted = sortStandings([dave, alice, eve, bob, carol]);

  it("places 2nd on the left, 1st in center, 3rd on the right", () => {
    const podium = buildPodiumOrder(sorted);
    expect(podium[0]?.username).toBe("bob");   // 2nd — left
    expect(podium[1]?.username).toBe("alice"); // 1st — center
    expect(podium[2]?.username).toBe("carol"); // 3rd — right
  });

  it("handles a 2-player tournament (no 3rd podium slot)", () => {
    const twoPlayers = sortStandings([bob, alice]);
    const podium = buildPodiumOrder(twoPlayers);
    expect(podium[0]?.username).toBe("bob");   // 2nd
    expect(podium[1]?.username).toBe("alice"); // 1st
    expect(podium[2]).toBeUndefined();          // no 3rd
  });

  it("handles a 1-player tournament gracefully", () => {
    const onePlayer = sortStandings([alice]);
    const podium = buildPodiumOrder(onePlayer);
    expect(podium[0]).toBeUndefined(); // no 2nd
    expect(podium[1]?.username).toBe("alice"); // 1st
    expect(podium[2]).toBeUndefined(); // no 3rd
  });
});
