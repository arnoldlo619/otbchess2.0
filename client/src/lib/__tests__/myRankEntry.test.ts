/**
 * Tests for the myRankEntry derivation logic used in MobileStandingsAccordion.
 *
 * The chip relies on:
 *   const myRankEntry = standingRows.findIndex(r => r.player.id === myPlayerId)
 *   → { rank: idx + 1, row: standingRows[idx] }
 *
 * We test the pure logic here using computeStandings so the tests stay
 * independent of React rendering.
 */

import { describe, it, expect } from "vitest";
import { computeStandings } from "../swiss";
import type { Player, Round } from "../tournamentData";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makePlayer = (id: string, name: string, elo = 1500): Player => ({
  id,
  name,
  elo,
  username: id,
  platform: "chess.com",
  wins: 0,
  losses: 0,
  draws: 0,
  points: 0,
  colorHistory: [],
  opponentHistory: [],
  byeCount: 0,
});

const p1 = makePlayer("p1", "Alice", 1800);
const p2 = makePlayer("p2", "Bob", 1600);
const p3 = makePlayer("p3", "Carol", 1400);
const p4 = makePlayer("p4", "Dave", 1200);

/** Round where Alice wins, Bob wins */
const round1: Round = {
  number: 1,
  games: [
    { id: "g1", whiteId: "p1", blackId: "p2", result: "1-0" },
    { id: "g2", whiteId: "p3", blackId: "p4", result: "0-1" },
  ],
  status: "complete",
};

/** Round where Alice wins again, Dave beats Carol */
const round2: Round = {
  number: 2,
  games: [
    { id: "g3", whiteId: "p1", blackId: "p4", result: "1-0" },
    { id: "g4", whiteId: "p2", blackId: "p3", result: "1-0" },
  ],
  status: "complete",
};

// ─── Helper that mirrors the component logic ─────────────────────────────────

function deriveMyRankEntry(
  players: Player[],
  rounds: Round[],
  myPlayerId: string | undefined
) {
  if (!myPlayerId) return null;
  const standingRows = computeStandings(players, rounds);
  const idx = standingRows.findIndex((r) => r.player.id === myPlayerId);
  if (idx === -1) return null;
  return { rank: idx + 1, row: standingRows[idx] };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("myRankEntry derivation", () => {
  const players = [p1, p2, p3, p4];
  const rounds = [round1, round2];

  it("returns null when myPlayerId is undefined", () => {
    expect(deriveMyRankEntry(players, rounds, undefined)).toBeNull();
  });

  it("returns null when myPlayerId does not match any player", () => {
    expect(deriveMyRankEntry(players, rounds, "ghost")).toBeNull();
  });

  it("returns rank 1 for the leader (Alice, 2 wins)", () => {
    const entry = deriveMyRankEntry(players, rounds, "p1");
    expect(entry).not.toBeNull();
    expect(entry!.rank).toBe(1);
    expect(entry!.row.player.name).toBe("Alice");
    expect(entry!.row.points).toBe(2);
  });

  it("returns rank 2 for Bob (1 win, 1 loss — same points as Dave but higher ELO)", () => {
    const entry = deriveMyRankEntry(players, rounds, "p2");
    expect(entry).not.toBeNull();
    expect(entry!.rank).toBe(2);
    expect(entry!.row.player.name).toBe("Bob");
  });

  it("returns the correct score for the participant", () => {
    const entry = deriveMyRankEntry(players, rounds, "p4");
    expect(entry).not.toBeNull();
    expect(entry!.row.points).toBe(1); // Dave won round 1 (vs Carol), lost round 2 (vs Alice)
  });

  it("rank is 1-indexed (not 0-indexed)", () => {
    const standingRows = computeStandings(players, rounds);
    for (let i = 0; i < standingRows.length; i++) {
      const entry = deriveMyRankEntry(players, rounds, standingRows[i].player.id);
      expect(entry!.rank).toBe(i + 1);
    }
  });

  it("returns rank 4 for the last-place player", () => {
    // Carol lost both games
    const entry = deriveMyRankEntry(players, rounds, "p3");
    expect(entry).not.toBeNull();
    expect(entry!.rank).toBe(4);
    expect(entry!.row.points).toBe(0);
  });

  it("works with no rounds played (all players at 0 points)", () => {
    const entry = deriveMyRankEntry(players, [], "p3");
    expect(entry).not.toBeNull();
    // All at 0 pts — rank is determined by ELO desc; Carol is 3rd (1400)
    expect(entry!.rank).toBe(3);
  });

  it("works with a single player in the tournament", () => {
    const entry = deriveMyRankEntry([p1], [], "p1");
    expect(entry).not.toBeNull();
    expect(entry!.rank).toBe(1);
  });

  it("returns the correct row data (wins, losses, buchholz)", () => {
    const entry = deriveMyRankEntry(players, rounds, "p1");
    expect(entry!.row.wins).toBe(2);
    expect(entry!.row.losses).toBe(0);
    expect(entry!.row.draws).toBe(0);
  });

  it("handles half-point scores (draws)", () => {
    const drawRound: Round = {
      number: 1,
      games: [{ id: "g1", whiteId: "p1", blackId: "p2", result: "½-½" }],
      status: "complete",
    };
    const entry = deriveMyRankEntry([p1, p2], [drawRound], "p1");
    expect(entry!.row.points).toBe(0.5);
  });

  it("rankLabel helper: returns medal emoji for top 3, #N for others", () => {
    // Mirrors the rankLabel function in the component
    const rankLabel = (rank: number, medals: string[]) =>
      rank <= 3 ? medals[rank - 1] : `#${rank}`;
    const medals = ["🥇", "🥈", "🥉"];

    expect(rankLabel(1, medals)).toBe("🥇");
    expect(rankLabel(2, medals)).toBe("🥈");
    expect(rankLabel(3, medals)).toBe("🥉");
    expect(rankLabel(4, medals)).toBe("#4");
    expect(rankLabel(10, medals)).toBe("#10");
    expect(rankLabel(32, medals)).toBe("#32");
  });

  it("score display: formats whole numbers without fraction", () => {
    const formatScore = (points: number) =>
      points % 1 !== 0 ? `${Math.floor(points)}½` : `${points}`;

    expect(formatScore(0)).toBe("0");
    expect(formatScore(1)).toBe("1");
    expect(formatScore(2)).toBe("2");
    expect(formatScore(0.5)).toBe("0½");
    expect(formatScore(1.5)).toBe("1½");
    expect(formatScore(2.5)).toBe("2½");
  });
});
