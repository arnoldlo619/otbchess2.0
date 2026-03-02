/**
 * Unit tests for the spectator view SSE state-merge logic.
 *
 * These tests exercise the pure merge functions used inside the
 * TournamentPage SSE event handlers without needing a DOM or browser.
 */
import { describe, it, expect } from "vitest";
import type { Player, Round, Game } from "../lib/tournamentData";
import type { DirectorState } from "../lib/directorState";

// ─── Helpers (mirrors Tournament.tsx SSE handler logic) ──────────────────────

type LiveStatePayload = {
  players?: Player[];
  status?: string;
  currentRound?: number;
  totalRounds?: number;
  tournamentName?: string;
};

function mergeLiveState(prev: DirectorState, data: LiveStatePayload): DirectorState {
  return {
    ...prev,
    players: (data.players as Player[]) ?? prev.players,
    status: (data.status as DirectorState["status"]) ?? prev.status,
    currentRound: data.currentRound ?? prev.currentRound,
    totalRounds: data.totalRounds ?? prev.totalRounds,
    tournamentName: data.tournamentName ?? prev.tournamentName,
  };
}

function mergeStandingsUpdated(
  prev: DirectorState,
  payload: { players: Player[]; currentRound: number; status: string }
): DirectorState {
  return {
    ...prev,
    players: payload.players,
    currentRound: payload.currentRound,
    status: payload.status as DirectorState["status"],
  };
}

function mergeRoundStarted(
  prev: DirectorState,
  payload: { round: number; games: Game[]; players: Player[] }
): DirectorState {
  const existingRounds = prev.rounds.filter((r) => r.number !== payload.round);
  const newRound: Round = {
  number: payload.round,
    status: "in_progress",
    games: payload.games,
  };
  return {
    ...prev,
    players: payload.players,
    currentRound: payload.round,
    rounds: [...existingRounds, newRound].sort((a, b) => a.number - b.number),
  };
}

function mergeTournamentEnded(
  prev: DirectorState,
  payload: { players: Player[] }
): DirectorState {
  return { ...prev, players: payload.players, status: "completed" };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, points = 0): Player {
  return {
    id,
    name,
    username: name.toLowerCase(),
    elo: 1200,
    platform: "chesscom",
    points,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    opponentHistory: [],
  };
}

function makeGame(id: string, board: number, whiteId: string, blackId: string): Game {
  return { id, board, whiteId, blackId, result: "*" };
}

function makeRound(number: number, games: Game[], status: Round["status"] = "in_progress"): Round {
  return { number, status, games };
}

const baseState: DirectorState = {
  tournamentId: "t1",
  tournamentName: "Test Open",
  totalRounds: 5,
  currentRound: 1,
  status: "in_progress",
  players: [makePlayer("p1", "Alice", 1), makePlayer("p2", "Bob", 0.5)],
  rounds: [makeRound(1, [makeGame("g1", 1, "p1", "p2")])],
};

// ─── mergeLiveState ───────────────────────────────────────────────────────────
describe("mergeLiveState (catch-up fetch)", () => {
  it("updates players from server payload", () => {
    const updatedPlayers = [makePlayer("p1", "Alice", 2), makePlayer("p2", "Bob", 1)];
    const result = mergeLiveState(baseState, { players: updatedPlayers });
    expect(result.players[0].points).toBe(2);
    expect(result.players[1].points).toBe(1);
  });

  it("updates status from server payload", () => {
    const result = mergeLiveState(baseState, { status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("updates currentRound from server payload", () => {
    const result = mergeLiveState(baseState, { currentRound: 3 });
    expect(result.currentRound).toBe(3);
  });

  it("preserves existing values when payload fields are absent", () => {
    const result = mergeLiveState(baseState, {});
    expect(result.tournamentName).toBe("Test Open");
    expect(result.totalRounds).toBe(5);
    expect(result.players).toHaveLength(2);
  });

  it("does not mutate the original state object", () => {
    const original = { ...baseState };
    mergeLiveState(baseState, { currentRound: 99 });
    expect(baseState.currentRound).toBe(original.currentRound);
  });
});

// ─── mergeStandingsUpdated ────────────────────────────────────────────────────
describe("mergeStandingsUpdated (SSE standings_updated event)", () => {
  it("replaces players with updated standings", () => {
    const updated = [makePlayer("p1", "Alice", 2), makePlayer("p2", "Bob", 1)];
    const result = mergeStandingsUpdated(baseState, {
      players: updated,
      currentRound: 1,
      status: "in_progress",
    });
    expect(result.players[0].points).toBe(2);
    expect(result.players[1].points).toBe(1);
  });

  it("updates status to completed when tournament ends", () => {
    const result = mergeStandingsUpdated(baseState, {
      players: baseState.players,
      currentRound: 5,
      status: "completed",
    });
    expect(result.status).toBe("completed");
    expect(result.currentRound).toBe(5);
  });

  it("preserves rounds when standings_updated fires", () => {
    const result = mergeStandingsUpdated(baseState, {
      players: baseState.players,
      currentRound: 1,
      status: "in_progress",
    });
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].number).toBe(1);
  });
});

// ─── mergeRoundStarted ────────────────────────────────────────────────────────
describe("mergeRoundStarted (SSE round_started event)", () => {
  it("adds a new round to the rounds list", () => {
    const newGames = [makeGame("g2", 1, "p1", "p2")];
    const result = mergeRoundStarted(baseState, {
      round: 2,
      games: newGames,
      players: baseState.players,
    });
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[1].number).toBe(2);
  });

  it("advances currentRound to the new round number", () => {
    const result = mergeRoundStarted(baseState, {
      round: 2,
      games: [],
      players: baseState.players,
    });
    expect(result.currentRound).toBe(2);
  });

  it("replaces an existing round with the same number (idempotent)", () => {
    const newGames = [makeGame("g1b", 1, "p2", "p1")];
    const result = mergeRoundStarted(baseState, {
      round: 1,
      games: newGames,
      players: baseState.players,
    });
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].games[0].id).toBe("g1b");
  });

  it("keeps rounds sorted by number", () => {
    // Start with rounds 1 and 3, add round 2
    const stateWith3Rounds: DirectorState = {
      ...baseState,
      rounds: [
        makeRound(1, [makeGame("g1", 1, "p1", "p2")], "completed"),
        makeRound(3, [makeGame("g3", 1, "p1", "p2")]),
      ],
      currentRound: 3,
    };
    const result = mergeRoundStarted(stateWith3Rounds, {
      round: 2,
      games: [makeGame("g2", 1, "p2", "p1")],
      players: baseState.players,
    });
    expect(result.rounds.map((r) => r.number)).toEqual([1, 2, 3]);
  });

  it("sets the new round status to in_progress", () => {
    const result = mergeRoundStarted(baseState, {
      round: 2,
      games: [],
      players: baseState.players,
    });
    const newRound = result.rounds.find((r) => r.number === 2);
    expect(newRound?.status).toBe("in_progress");
  });
});

// ─── mergeTournamentEnded ─────────────────────────────────────────────────────
describe("mergeTournamentEnded (SSE tournament_ended event)", () => {
  it("sets status to completed", () => {
    const result = mergeTournamentEnded(baseState, { players: baseState.players });
    expect(result.status).toBe("completed");
  });

  it("replaces players with final standings", () => {
    const finalPlayers = [makePlayer("p1", "Alice", 3.5), makePlayer("p2", "Bob", 1.5)];
    const result = mergeTournamentEnded(baseState, { players: finalPlayers });
    expect(result.players[0].points).toBe(3.5);
    expect(result.players[1].points).toBe(1.5);
  });

  it("preserves rounds and other fields", () => {
    const result = mergeTournamentEnded(baseState, { players: baseState.players });
    expect(result.rounds).toHaveLength(1);
    expect(result.tournamentName).toBe("Test Open");
    expect(result.totalRounds).toBe(5);
  });
});

// ─── RoundProgressBar helper ──────────────────────────────────────────────────
describe("round progress percentage calculation", () => {
  function calcPct(games: Game[]): number {
    const total = games.length;
    const done = games.filter((g) => g.result !== "*").length;
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  it("returns 0% when no games are done", () => {
    const games = [makeGame("g1", 1, "p1", "p2"), makeGame("g2", 2, "p3", "p4")];
    expect(calcPct(games)).toBe(0);
  });

  it("returns 50% when half the games are done", () => {
    const games = [
      { ...makeGame("g1", 1, "p1", "p2"), result: "1-0" as const },
      makeGame("g2", 2, "p3", "p4"),
    ];
    expect(calcPct(games)).toBe(50);
  });

  it("returns 100% when all games are done", () => {
    const games = [
      { ...makeGame("g1", 1, "p1", "p2"), result: "1-0" as const },
      { ...makeGame("g2", 2, "p3", "p4"), result: "0-1" as const },
    ];
    expect(calcPct(games)).toBe(100);
  });

  it("returns 0 for empty game list", () => {
    expect(calcPct([])).toBe(0);
  });
});
