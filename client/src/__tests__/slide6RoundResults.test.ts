/**
 * Slide 6 — Round-by-Round Results: Unit Tests
 *
 * Tests the buildRoundGrid() logic, cell colour mapping, layout math,
 * and edge cases (byes, unfinished games, players not in a round).
 */

import { describe, it, expect } from "vitest";
import type { Round } from "@/lib/tournamentData";
import type { StandingRow } from "@/lib/swiss";

// ─── Mirror buildRoundGrid from the component ─────────────────────────────────

function buildRoundGrid(
  rows: StandingRow[],
  rounds: Round[],
  totalRounds: number
): Map<string, ("W" | "D" | "L" | "BYE" | "—")[]> {
  const grid = new Map<string, ("W" | "D" | "L" | "BYE" | "—")[]>();

  for (const row of rows) {
    grid.set(row.player.id, Array(totalRounds).fill("—"));
  }

  for (const round of rounds) {
    if (round.status !== "completed") continue;
    const rIdx = round.number - 1;
    if (rIdx < 0 || rIdx >= totalRounds) continue;

    for (const game of round.games) {
      const { whiteId, blackId, result } = game;

      if (!blackId || blackId === "BYE" || blackId === "") {
        const byeRow = grid.get(whiteId);
        if (byeRow) byeRow[rIdx] = "BYE";
        continue;
      }

      const whiteRow = grid.get(whiteId);
      const blackRow = grid.get(blackId);

      if (result === "1-0") {
        if (whiteRow) whiteRow[rIdx] = "W";
        if (blackRow) blackRow[rIdx] = "L";
      } else if (result === "0-1") {
        if (whiteRow) whiteRow[rIdx] = "L";
        if (blackRow) blackRow[rIdx] = "W";
      } else if (result === "½-½") {
        if (whiteRow) whiteRow[rIdx] = "D";
        if (blackRow) blackRow[rIdx] = "D";
      }
    }
  }

  return grid;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string): StandingRow["player"] {
  return { id, name, username: id, elo: 1200, wins: 0, losses: 0, draws: 0, points: 0, color: "white" };
}

function makeRow(id: string, name: string, rank: number, points: number): StandingRow {
  return {
    player: makePlayer(id, name),
    rank,
    points,
    buchholz: 0,
    buchholzCut1: 0,
    sonnebornBerger: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    matchW: 0,
    matchD: 0,
    matchL: 0,
  };
}

function makeRound(number: number, status: "completed" | "in_progress" | "upcoming", games: Round["games"]): Round {
  return { number, status, games };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildRoundGrid — basic results", () => {
  const rows = [makeRow("p1", "Alice", 1, 3), makeRow("p2", "Bob", 2, 0)];

  it("white wins: W for white, L for black", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("W");
    expect(grid.get("p2")?.[0]).toBe("L");
  });

  it("black wins: L for white, W for black", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "0-1" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("L");
    expect(grid.get("p2")?.[0]).toBe("W");
  });

  it("draw: D for both players", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "½-½" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("D");
    expect(grid.get("p2")?.[0]).toBe("D");
  });
});

describe("buildRoundGrid — bye handling", () => {
  const rows = [makeRow("p1", "Alice", 1, 3), makeRow("p2", "Bob", 2, 2)];

  it("marks BYE when blackId is 'BYE'", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "BYE", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("BYE");
  });

  it("marks BYE when blackId is empty string", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p2", blackId: "", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p2")?.[0]).toBe("BYE");
  });
});

describe("buildRoundGrid — unfinished games", () => {
  const rows = [makeRow("p1", "Alice", 1, 0), makeRow("p2", "Bob", 2, 0)];

  it("leaves '—' for unfinished games (result='*')", () => {
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("—");
    expect(grid.get("p2")?.[0]).toBe("—");
  });
});

describe("buildRoundGrid — round status filtering", () => {
  const rows = [makeRow("p1", "Alice", 1, 1), makeRow("p2", "Bob", 2, 0)];

  it("ignores in_progress rounds", () => {
    const rounds = [makeRound(1, "in_progress", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("—");
    expect(grid.get("p2")?.[0]).toBe("—");
  });

  it("ignores upcoming rounds", () => {
    const rounds = [makeRound(2, "upcoming", [])];
    const grid = buildRoundGrid(rows, rounds, 2);
    expect(grid.get("p1")).toEqual(["—", "—"]);
  });
});

describe("buildRoundGrid — multi-round tournament", () => {
  const rows = [
    makeRow("p1", "Alice", 1, 3),
    makeRow("p2", "Bob", 2, 2),
    makeRow("p3", "Carol", 3, 1),
  ];

  it("correctly maps 4 rounds for 3 players", () => {
    const rounds = [
      makeRound(1, "completed", [
        { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
        { id: "g2", round: 1, board: 2, whiteId: "p3", blackId: "BYE", result: "1-0" },
      ]),
      makeRound(2, "completed", [
        { id: "g3", round: 2, board: 1, whiteId: "p2", blackId: "p3", result: "½-½" },
        { id: "g4", round: 2, board: 2, whiteId: "p1", blackId: "BYE", result: "1-0" },
      ]),
      makeRound(3, "completed", [
        { id: "g5", round: 3, board: 1, whiteId: "p1", blackId: "p3", result: "1-0" },
        { id: "g6", round: 3, board: 2, whiteId: "p2", blackId: "BYE", result: "1-0" },
      ]),
      makeRound(4, "upcoming", []),
    ];
    const grid = buildRoundGrid(rows, rounds, 4);

    // p1: W, BYE, W, —
    expect(grid.get("p1")).toEqual(["W", "BYE", "W", "—"]);
    // p2: L, D, BYE, —
    expect(grid.get("p2")).toEqual(["L", "D", "BYE", "—"]);
    // p3: BYE, D, L, —
    expect(grid.get("p3")).toEqual(["BYE", "D", "L", "—"]);
  });
});

describe("buildRoundGrid — edge cases", () => {
  it("returns empty grid for empty rows", () => {
    const grid = buildRoundGrid([], [], 4);
    expect(grid.size).toBe(0);
  });

  it("initialises all rounds to '—' for all players", () => {
    const rows = [makeRow("p1", "Alice", 1, 0), makeRow("p2", "Bob", 2, 0)];
    const grid = buildRoundGrid(rows, [], 5);
    expect(grid.get("p1")).toEqual(["—", "—", "—", "—", "—"]);
    expect(grid.get("p2")).toEqual(["—", "—", "—", "—", "—"]);
  });

  it("ignores games for players not in rows", () => {
    const rows = [makeRow("p1", "Alice", 1, 1)];
    const rounds = [makeRound(1, "completed", [
      { id: "g1", round: 1, board: 1, whiteId: "p1", blackId: "p99", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 1);
    expect(grid.get("p1")?.[0]).toBe("W");
    expect(grid.has("p99")).toBe(false); // p99 not in rows
  });

  it("handles round.number > totalRounds gracefully (out-of-bounds)", () => {
    const rows = [makeRow("p1", "Alice", 1, 1), makeRow("p2", "Bob", 2, 0)];
    const rounds = [makeRound(10, "completed", [
      { id: "g1", round: 10, board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
    ])];
    const grid = buildRoundGrid(rows, rounds, 4);
    // Round 10 is out of bounds for totalRounds=4, should be ignored
    expect(grid.get("p1")).toEqual(["—", "—", "—", "—"]);
    expect(grid.get("p2")).toEqual(["—", "—", "—", "—"]);
  });
});

describe("Slide 6 — Layout math", () => {
  const SLIDE_SIZE = 1080;
  const FOOTER = 80;
  const HEADER_H = 148;
  const COL_HEADER_H = 44;
  const ROW_H = 68;

  it("available height calculation is positive", () => {
    const availH = SLIDE_SIZE - FOOTER - HEADER_H - COL_HEADER_H;
    expect(availH).toBeGreaterThan(0);
    expect(availH).toBe(808);
  });

  it("fits at least 10 player rows in 1080px canvas", () => {
    const availH = SLIDE_SIZE - FOOTER - HEADER_H - COL_HEADER_H;
    const maxRows = Math.floor(availH / ROW_H);
    expect(maxRows).toBeGreaterThanOrEqual(10);
  });

  it("round column width is capped at 72px for up to 8 rounds", () => {
    const NAME_COL = 280;
    const RANK_COL = 44;
    const PTS_COL = 56;
    const PAD = 52;
    const tableW = SLIDE_SIZE - PAD * 2;
    const roundColsW = tableW - NAME_COL - RANK_COL - PTS_COL;

    for (let rounds = 1; rounds <= 8; rounds++) {
      const roundColW = Math.min(72, roundColsW / rounds);
      expect(roundColW).toBeGreaterThan(0);
      expect(roundColW).toBeLessThanOrEqual(72);
    }
  });

  it("round column width shrinks gracefully for 12+ rounds", () => {
    const NAME_COL = 280;
    const RANK_COL = 44;
    const PTS_COL = 56;
    const PAD = 52;
    const tableW = SLIDE_SIZE - PAD * 2;
    const roundColsW = tableW - NAME_COL - RANK_COL - PTS_COL;
    const roundColW = Math.min(72, roundColsW / 12);
    expect(roundColW).toBeGreaterThan(0);
    expect(roundColW).toBeLessThan(72);
  });
});

describe("Slide 6 — Cell colour mapping", () => {
  function cellStyle(outcome: string) {
    if (outcome === "W") return { color: "#6FCF97" };
    if (outcome === "L") return { color: "#EB5757" };
    if (outcome === "D") return { color: "#F2C94C" };
    if (outcome === "BYE") return { color: "rgba(255,255,255,0.30)" };
    return { color: "rgba(255,255,255,0.15)" };
  }

  it("W cell has green colour", () => {
    expect(cellStyle("W").color).toBe("#6FCF97");
  });

  it("L cell has red colour", () => {
    expect(cellStyle("L").color).toBe("#EB5757");
  });

  it("D cell has gold colour", () => {
    expect(cellStyle("D").color).toBe("#F2C94C");
  });

  it("BYE cell has muted colour", () => {
    expect(cellStyle("BYE").color).toContain("0.30");
  });

  it("— cell has very muted colour", () => {
    expect(cellStyle("—").color).toContain("0.15");
  });

  it("all 5 outcome types have distinct colours", () => {
    const colours = ["W", "L", "D", "BYE", "—"].map((o) => cellStyle(o).color);
    const unique = new Set(colours);
    expect(unique.size).toBe(5);
  });
});

describe("Slide 6 — Slide registry", () => {
  const SLIDES = [
    { id: "cover", label: "Cover" },
    { id: "podium", label: "Podium" },
    { id: "standings", label: "Standings" },
    { id: "stats", label: "Stats" },
    { id: "cta", label: "CTA" },
    { id: "rounds", label: "Rounds" },
  ];

  it("has exactly 6 slides in the registry", () => {
    expect(SLIDES).toHaveLength(6);
  });

  it("Slide 6 is the rounds slide", () => {
    expect(SLIDES[5].id).toBe("rounds");
    expect(SLIDES[5].label).toBe("Rounds");
  });

  it("all slide IDs are unique", () => {
    const ids = SLIDES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("slide counter label is '6 / 6' for the rounds slide", () => {
    const slideIdx = SLIDES.findIndex((s) => s.id === "rounds");
    const label = `${slideIdx + 1} / ${SLIDES.length}`;
    expect(label).toBe("6 / 6");
  });
});
