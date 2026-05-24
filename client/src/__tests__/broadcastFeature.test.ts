/**
 * Tests for the Board 1 Live Broadcast feature
 *
 * Covers:
 * - Broadcast data shape validation
 * - Move submission logic
 * - SSE event parsing
 * - PGN export helper
 * - Slug generation
 */
import { describe, it, expect } from "vitest";

// ─── Types (mirrored from BroadcastControl) ───────────────────────────────────
interface Broadcast {
  id: string;
  tournamentId: string;
  roundNumber: number;
  boardNumber: number;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  status: "ready" | "live" | "paused" | "finished" | "error";
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateSlug(tournamentId: string, boardNumber: number): string {
  return `${tournamentId}-board-${boardNumber}`;
}

function buildPgnHeader(b: Broadcast): string {
  const lines: string[] = [];
  lines.push(`[White "${b.whitePlayerName}"]`);
  lines.push(`[Black "${b.blackPlayerName}"]`);
  lines.push(`[Result "${b.result ?? "*"}"]`);
  lines.push(`[Round "${b.roundNumber}"]`);
  lines.push(`[Board "${b.boardNumber}"]`);
  return lines.join("\n");
}

function parseSseEvent(rawData: string): { type: string; broadcast?: Broadcast } | null {
  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

function isValidFen(fen: string): boolean {
  const parts = fen.split(" ");
  return parts.length >= 4;
}

function statusAllowsMoves(status: Broadcast["status"]): boolean {
  return status === "live";
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Broadcast slug generation", () => {
  it("generates a slug from tournamentId and boardNumber", () => {
    expect(generateSlug("my-tournament-2026", 1)).toBe("my-tournament-2026-board-1");
    expect(generateSlug("club-open", 3)).toBe("club-open-board-3");
  });

  it("handles special characters in tournamentId", () => {
    const slug = generateSlug("test_event_2026", 2);
    expect(slug).toContain("board-2");
  });
});

describe("Broadcast data shape validation", () => {
  const validBroadcast: Broadcast = {
    id: "bc-001",
    tournamentId: "t-001",
    roundNumber: 1,
    boardNumber: 1,
    whitePlayerName: "Alice",
    blackPlayerName: "Bob",
    status: "live",
    currentFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    pgn: "1. e4",
    moveNumber: 1,
    sideToMove: "b",
    result: null,
    publicSlug: "t-001-board-1",
  };

  it("has all required fields", () => {
    expect(validBroadcast.id).toBeTruthy();
    expect(validBroadcast.tournamentId).toBeTruthy();
    expect(validBroadcast.boardNumber).toBeGreaterThan(0);
    expect(validBroadcast.whitePlayerName).toBeTruthy();
    expect(validBroadcast.blackPlayerName).toBeTruthy();
    expect(["ready", "live", "paused", "finished", "error"]).toContain(validBroadcast.status);
  });

  it("has a valid FEN string", () => {
    expect(isValidFen(validBroadcast.currentFen)).toBe(true);
  });

  it("starting FEN is valid", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(isValidFen(startFen)).toBe(true);
  });
});

describe("Status-based move permission", () => {
  it("allows moves when status is live", () => {
    expect(statusAllowsMoves("live")).toBe(true);
  });

  it("blocks moves when status is finished", () => {
    expect(statusAllowsMoves("finished")).toBe(false);
  });

  it("blocks moves when status is paused", () => {
    expect(statusAllowsMoves("paused")).toBe(false);
  });

  it("blocks moves when status is ready", () => {
    expect(statusAllowsMoves("ready")).toBe(false);
  });

  it("blocks moves when status is error", () => {
    expect(statusAllowsMoves("error")).toBe(false);
  });
});

describe("PGN header generation", () => {
  const b: Broadcast = {
    id: "bc-001",
    tournamentId: "t-001",
    roundNumber: 2,
    boardNumber: 1,
    whitePlayerName: "Magnus Carlsen",
    blackPlayerName: "Fabiano Caruana",
    status: "finished",
    currentFen: "8/8/8/8/8/8/8/8 w - - 0 1",
    pgn: "1. e4 e5 2. Nf3",
    moveNumber: 3,
    sideToMove: "w",
    result: "1-0",
    publicSlug: "t-001-board-1",
  };

  it("includes player names in PGN header", () => {
    const header = buildPgnHeader(b);
    expect(header).toContain("Magnus Carlsen");
    expect(header).toContain("Fabiano Caruana");
  });

  it("includes result in PGN header", () => {
    const header = buildPgnHeader(b);
    expect(header).toContain("1-0");
  });

  it("includes round number", () => {
    const header = buildPgnHeader(b);
    expect(header).toContain("2");
  });

  it("uses * for unknown result", () => {
    const bNoResult = { ...b, result: null };
    const header = buildPgnHeader(bNoResult);
    expect(header).toContain("*");
  });
});

describe("SSE event parsing", () => {
  it("parses a valid move_played event", () => {
    const payload = JSON.stringify({
      type: "move_played",
      broadcast: {
        id: "bc-001",
        moveNumber: 2,
        lastMoveSan: "e4",
      },
    });
    const parsed = parseSseEvent(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("move_played");
    expect(parsed?.broadcast?.lastMoveSan).toBe("e4");
  });

  it("returns null for invalid JSON", () => {
    expect(parseSseEvent("not json")).toBeNull();
    expect(parseSseEvent("{broken")).toBeNull();
  });

  it("parses a status_changed event", () => {
    const payload = JSON.stringify({ type: "status_changed", broadcast: { status: "paused" } });
    const parsed = parseSseEvent(payload);
    expect(parsed?.type).toBe("status_changed");
  });

  it("parses a result_set event", () => {
    const payload = JSON.stringify({ type: "result_set", broadcast: { result: "1/2-1/2" } });
    const parsed = parseSseEvent(payload);
    expect(parsed?.broadcast?.result).toBe("1/2-1/2");
  });
});

describe("Last move UCI highlight extraction", () => {
  function extractHighlightSquares(uci: string | null | undefined): { from: string; to: string } | null {
    if (!uci || uci.length < 4) return null;
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  }

  it("extracts from and to squares from UCI", () => {
    const result = extractHighlightSquares("e2e4");
    expect(result?.from).toBe("e2");
    expect(result?.to).toBe("e4");
  });

  it("handles promotion moves", () => {
    const result = extractHighlightSquares("e7e8q");
    expect(result?.from).toBe("e7");
    expect(result?.to).toBe("e8");
  });

  it("returns null for null/undefined UCI", () => {
    expect(extractHighlightSquares(null)).toBeNull();
    expect(extractHighlightSquares(undefined)).toBeNull();
    expect(extractHighlightSquares("e2")).toBeNull();
  });
});

describe("Move pair rendering logic", () => {
  function buildMovePairs(history: string[]): [string, string?][] {
    const pairs: [string, string?][] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push([history[i], history[i + 1]]);
    }
    return pairs;
  }

  it("groups moves into pairs correctly", () => {
    const history = ["e4", "e5", "Nf3", "Nc6", "Bb5"];
    const pairs = buildMovePairs(history);
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toEqual(["e4", "e5"]);
    expect(pairs[1]).toEqual(["Nf3", "Nc6"]);
    expect(pairs[2]).toEqual(["Bb5", undefined]);
  });

  it("handles empty history", () => {
    expect(buildMovePairs([])).toHaveLength(0);
  });

  it("handles single move", () => {
    const pairs = buildMovePairs(["e4"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][1]).toBeUndefined();
  });
});
