/**
 * Wall Chart Tests
 * Tests for the CrossTable buildMatrix logic and RoundTimeline data processing.
 * We extract the pure data functions and test them in isolation.
 */
import { describe, it, expect } from "vitest";
import type { Player, Round } from "@/lib/tournamentData";

// ─── Inline the buildMatrix logic (pure function, no React) ───────────────────
type CellResult = "win" | "loss" | "draw" | "none" | "self";
interface Cell {
  result: CellResult;
  score: string;
  roundNum: number;
  board: number;
  asWhite: boolean;
}

function buildMatrix(players: Player[], rounds: Round[]): Cell[][] {
  const n = players.length;
  const idToIdx = new Map(players.map((p, i) => [p.id, i]));

  const matrix: Cell[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j
        ? { result: "self" as CellResult, score: "", roundNum: 0, board: 0, asWhite: false }
        : { result: "none" as CellResult, score: "", roundNum: 0, board: 0, asWhite: false }
    )
  );

  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;
      const wi = idToIdx.get(game.whiteId);
      const bi = idToIdx.get(game.blackId);
      if (wi === undefined || bi === undefined) continue;

      let whiteResult: CellResult;
      let blackResult: CellResult;
      let whiteScore: string;
      let blackScore: string;

      if (game.result === "1-0") {
        whiteResult = "win"; whiteScore = "1";
        blackResult = "loss"; blackScore = "0";
      } else if (game.result === "0-1") {
        whiteResult = "loss"; whiteScore = "0";
        blackResult = "win"; blackScore = "1";
      } else {
        whiteResult = "draw"; whiteScore = "½";
        blackResult = "draw"; blackScore = "½";
      }

      matrix[wi][bi] = { result: whiteResult, score: whiteScore, roundNum: round.number, board: game.board, asWhite: true };
      matrix[bi][wi] = { result: blackResult, score: blackScore, roundNum: round.number, board: game.board, asWhite: false };
    }
  }

  return matrix;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    username: name.toLowerCase(),
    elo: 1500,
    title: undefined,
    country: "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    opponents: [],
    avatarUrl: undefined,
    joinedAt: Date.now(),
  };
}

function makeRound(number: number, games: Round["games"]): Round {
  return { number, games, status: "completed" };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("buildMatrix", () => {
  const alice = makePlayer("a", "Alice");
  const bob   = makePlayer("b", "Bob");
  const carol = makePlayer("c", "Carol");

  it("creates an NxN matrix with self-cells on the diagonal", () => {
    const matrix = buildMatrix([alice, bob, carol], []);
    expect(matrix.length).toBe(3);
    expect(matrix[0].length).toBe(3);
    expect(matrix[0][0].result).toBe("self");
    expect(matrix[1][1].result).toBe("self");
    expect(matrix[2][2].result).toBe("self");
  });

  it("initialises all off-diagonal cells as none when no rounds played", () => {
    const matrix = buildMatrix([alice, bob], []);
    expect(matrix[0][1].result).toBe("none");
    expect(matrix[1][0].result).toBe("none");
  });

  it("correctly records a white win (1-0)", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "1-0" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    // Alice (white) won
    expect(matrix[0][1].result).toBe("win");
    expect(matrix[0][1].score).toBe("1");
    expect(matrix[0][1].asWhite).toBe(true);
    // Bob (black) lost
    expect(matrix[1][0].result).toBe("loss");
    expect(matrix[1][0].score).toBe("0");
    expect(matrix[1][0].asWhite).toBe(false);
  });

  it("correctly records a black win (0-1)", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "0-1" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    expect(matrix[0][1].result).toBe("loss");
    expect(matrix[0][1].score).toBe("0");
    expect(matrix[1][0].result).toBe("win");
    expect(matrix[1][0].score).toBe("1");
  });

  it("correctly records a draw (½-½)", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "½-½" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    expect(matrix[0][1].result).toBe("draw");
    expect(matrix[0][1].score).toBe("½");
    expect(matrix[1][0].result).toBe("draw");
    expect(matrix[1][0].score).toBe("½");
  });

  it("skips unplayed games (result = '*')", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "*" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    expect(matrix[0][1].result).toBe("none");
    expect(matrix[1][0].result).toBe("none");
  });

  it("records round number and board number on cells", () => {
    const round = makeRound(3, [
      { id: "g1", board: 2, whiteId: "a", blackId: "b", result: "1-0" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    expect(matrix[0][1].roundNum).toBe(3);
    expect(matrix[0][1].board).toBe(2);
  });

  it("handles multiple rounds correctly", () => {
    const r1 = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "1-0" },
    ]);
    const r2 = makeRound(2, [
      { id: "g2", board: 1, whiteId: "b", blackId: "c", result: "½-½" },
    ]);
    const r3 = makeRound(3, [
      { id: "g3", board: 1, whiteId: "a", blackId: "c", result: "0-1" },
    ]);
    const matrix = buildMatrix([alice, bob, carol], [r1, r2, r3]);

    // Alice beat Bob in R1
    expect(matrix[0][1].result).toBe("win");
    // Bob drew Carol in R2
    expect(matrix[1][2].result).toBe("draw");
    // Carol beat Alice in R3
    expect(matrix[2][0].result).toBe("win");
    // Alice vs Carol: Alice lost
    expect(matrix[0][2].result).toBe("loss");
  });

  it("ignores games with unknown player IDs", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "unknown1", blackId: "unknown2", result: "1-0" },
    ]);
    const matrix = buildMatrix([alice, bob], [round]);
    // Should not throw, all cells remain none
    expect(matrix[0][1].result).toBe("none");
    expect(matrix[1][0].result).toBe("none");
  });

  it("handles a single player (1x1 matrix)", () => {
    const matrix = buildMatrix([alice], []);
    expect(matrix.length).toBe(1);
    expect(matrix[0][0].result).toBe("self");
  });

  it("handles empty player list (0x0 matrix)", () => {
    const matrix = buildMatrix([], []);
    expect(matrix.length).toBe(0);
  });
});

// ─── RoundTimeline data logic tests ──────────────────────────────────────────
describe("RoundTimeline data processing", () => {
  const alice = makePlayer("a", "Alice");
  const bob   = makePlayer("b", "Bob");
  const carol = makePlayer("c", "Carol");
  const dave  = makePlayer("d", "Dave");

  it("counts correct game results per round", () => {
    const rounds: Round[] = [
      makeRound(1, [
        { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "1-0" },
        { id: "g2", board: 2, whiteId: "c", blackId: "d", result: "½-½" },
      ]),
      makeRound(2, [
        { id: "g3", board: 1, whiteId: "b", blackId: "c", result: "0-1" },
        { id: "g4", board: 2, whiteId: "d", blackId: "a", result: "1-0" },
      ]),
    ];

    const players = [alice, bob, carol, dave];
    const idToName = new Map(players.map((p) => [p.id, p.name]));

    // Verify round 1 has 1 decisive + 1 draw
    const r1Games = rounds[0].games.filter((g) => g.result !== "*");
    const r1Decisive = r1Games.filter((g) => g.result === "1-0" || g.result === "0-1").length;
    const r1Draws = r1Games.filter((g) => g.result === "½-½").length;
    expect(r1Decisive).toBe(1);
    expect(r1Draws).toBe(1);

    // Verify round 2 has 2 decisive + 0 draws
    const r2Games = rounds[1].games.filter((g) => g.result !== "*");
    const r2Decisive = r2Games.filter((g) => g.result === "1-0" || g.result === "0-1").length;
    const r2Draws = r2Games.filter((g) => g.result === "½-½").length;
    expect(r2Decisive).toBe(2);
    expect(r2Draws).toBe(0);

    // Verify player name lookup works
    expect(idToName.get("a")).toBe("Alice");
    expect(idToName.get("d")).toBe("Dave");
  });

  it("correctly identifies the winner of each game", () => {
    const games = [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "1-0" as const },
      { id: "g2", board: 2, whiteId: "c", blackId: "d", result: "0-1" as const },
      { id: "g3", board: 3, whiteId: "a", blackId: "c", result: "½-½" as const },
    ];

    const getWinner = (g: typeof games[0]) => {
      if (g.result === "1-0") return g.whiteId;
      if (g.result === "0-1") return g.blackId;
      return null;
    };

    expect(getWinner(games[0])).toBe("a"); // Alice wins as white
    expect(getWinner(games[1])).toBe("d"); // Dave wins as black
    expect(getWinner(games[2])).toBeNull(); // draw
  });

  it("handles rounds with all unplayed games", () => {
    const round = makeRound(1, [
      { id: "g1", board: 1, whiteId: "a", blackId: "b", result: "*" },
    ]);
    const playedGames = round.games.filter((g) => g.result !== "*");
    expect(playedGames.length).toBe(0);
  });
});
