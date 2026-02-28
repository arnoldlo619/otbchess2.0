/**
 * Unit tests for generateResultsPdf helper functions.
 *
 * We test the pure data-preparation helpers (getCrossTableCell,
 * buildCrossTableMatrix, buildStandingsRows) without invoking jsPDF itself,
 * since jsPDF requires a DOM canvas context not available in Node.
 */

import { describe, it, expect } from "vitest";
import {
  getCrossTableCell,
  buildCrossTableMatrix,
  buildStandingsRows,
} from "../generateResultsPdf";
import type { Player, Round } from "../tournamentData";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Alice",
    username: "alice",
    elo: 1800,
    country: "US",
    points: 2,
    wins: 2,
    draws: 0,
    losses: 0,
    buchholz: 4.0,
    colorHistory: ["W", "B"],
    ...overrides,
  };
}

const p1 = makePlayer({ id: "p1", name: "Alice", elo: 1800, points: 2.5, wins: 2, draws: 1, losses: 0, buchholz: 5.0 });
const p2 = makePlayer({ id: "p2", name: "Bob",   elo: 1750, points: 2.0, wins: 2, draws: 0, losses: 1, buchholz: 4.5 });
const p3 = makePlayer({ id: "p3", name: "Carol", elo: 1700, points: 1.0, wins: 1, draws: 0, losses: 2, buchholz: 3.0 });

const rounds: Round[] = [
  {
    number: 1,
    status: "completed",
    games: [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
      { id: "g2", round: 1, board: 2, whiteId: "p3", blackId: "p1", result: "0-1" },
    ],
  },
  {
    number: 2,
    status: "completed",
    games: [
      { id: "g3", round: 2, board: 1, whiteId: "p2", blackId: "p3", result: "1-0" },
      { id: "g4", round: 2, board: 2, whiteId: "p1", blackId: "p3", result: "½-½" },
    ],
  },
];

// ─── getCrossTableCell ────────────────────────────────────────────────────────

describe("getCrossTableCell", () => {
  it("returns '1' when row player wins as white", () => {
    expect(getCrossTableCell(rounds, "p1", "p2")).toBe("1");
  });

  it("returns '0' when row player loses as white", () => {
    // p2 played p3 as white and won (1-0), so p3 vs p2 should be '0'
    expect(getCrossTableCell(rounds, "p3", "p2")).toBe("0");
  });

  it("returns '1' when row player wins as black", () => {
    // p3 played p1 as black (0-1), so p1 wins — p1 vs p3 from round 1 (white p3, black p1 → 0-1 means black wins)
    // Actually game: whiteId=p3, blackId=p1, result=0-1 → p1 (black) wins → p1 vs p3 = '1'
    expect(getCrossTableCell(rounds, "p1", "p3")).toBe("1");
  });

  it("returns '0' when row player loses as black", () => {
    // p3 played p1 as black (0-1) → p3 loses → p3 vs p1 = '0'
    expect(getCrossTableCell(rounds, "p3", "p1")).toBe("0");
  });

  it("returns '½' for a draw (white perspective)", () => {
    // p1 white vs p3 black in round 2, result ½-½
    expect(getCrossTableCell(rounds, "p1", "p3")).toBe("1"); // from round 1 already
    // Use a fresh round to test draw
    const drawRounds: Round[] = [{
      number: 1, status: "completed",
      games: [{ id: "d1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "½-½" }],
    }];
    expect(getCrossTableCell(drawRounds, "p1", "p2")).toBe("½");
  });

  it("returns '½' for a draw (black perspective)", () => {
    const drawRounds: Round[] = [{
      number: 1, status: "completed",
      games: [{ id: "d1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "½-½" }],
    }];
    expect(getCrossTableCell(drawRounds, "p2", "p1")).toBe("½");
  });

  it("returns '' when the game is pending (*)", () => {
    const pendingRounds: Round[] = [{
      number: 1, status: "in_progress",
      games: [{ id: "x1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" }],
    }];
    expect(getCrossTableCell(pendingRounds, "p1", "p2")).toBe("");
  });

  it("returns '' when the players have not been paired", () => {
    expect(getCrossTableCell([], "p1", "p2")).toBe("");
  });
});

// ─── buildCrossTableMatrix ────────────────────────────────────────────────────

describe("buildCrossTableMatrix", () => {
  const players = [p1, p2, p3];

  it("produces the correct number of header columns", () => {
    const { headers } = buildCrossTableMatrix(players, rounds);
    // "#" + "Player" + 3 player cols + "Pts" = 6
    expect(headers).toHaveLength(6);
    expect(headers[0]).toBe("#");
    expect(headers[1]).toBe("Player");
    expect(headers[headers.length - 1]).toBe("Pts");
  });

  it("produces the correct number of rows", () => {
    const { rows } = buildCrossTableMatrix(players, rounds);
    expect(rows).toHaveLength(3);
  });

  it("diagonal cells contain '—'", () => {
    const { rows } = buildCrossTableMatrix(players, rounds);
    rows.forEach((row, i) => {
      // diagonal is at column index i + 2 (after "#" and "Player")
      expect(row[i + 2]).toBe("—");
    });
  });

  it("row 0 starts with rank '1' and player name", () => {
    const { rows } = buildCrossTableMatrix(players, rounds);
    expect(rows[0][0]).toBe("1");
    expect(rows[0][1]).toBe("Alice");
  });

  it("last column contains the player's points", () => {
    const { rows } = buildCrossTableMatrix(players, rounds);
    expect(rows[0][rows[0].length - 1]).toBe("2.5");
    expect(rows[1][rows[1].length - 1]).toBe("2");
  });
});

// ─── buildStandingsRows ───────────────────────────────────────────────────────

describe("buildStandingsRows", () => {
  it("returns one row per player", () => {
    const rows = buildStandingsRows([p1, p2, p3]);
    expect(rows).toHaveLength(3);
  });

  it("rank column is 1-indexed", () => {
    const rows = buildStandingsRows([p1, p2, p3]);
    expect(rows[0][0]).toBe("1");
    expect(rows[2][0]).toBe("3");
  });

  it("includes title prefix when player has a title", () => {
    const titled = makePlayer({ id: "t1", name: "Magnus", title: "GM", points: 3, wins: 3, draws: 0, losses: 0, buchholz: 6 });
    const rows = buildStandingsRows([titled]);
    expect(rows[0][1]).toBe("GM Magnus");
  });

  it("does not prefix name when no title", () => {
    const rows = buildStandingsRows([p1]);
    expect(rows[0][1]).toBe("Alice");
  });

  it("buchholz is formatted to 1 decimal place", () => {
    const rows = buildStandingsRows([p1]);
    expect(rows[0][7]).toBe("5.0");
  });

  it("W/D/L columns are correct", () => {
    const rows = buildStandingsRows([p1]);
    expect(rows[0][4]).toBe("2"); // wins
    expect(rows[0][5]).toBe("1"); // draws
    expect(rows[0][6]).toBe("0"); // losses
  });
});
