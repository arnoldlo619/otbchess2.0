// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDirectorState, type DirectorState } from "@/lib/directorState";
import type { Player } from "@/lib/tournamentData";

const TOURNAMENT_ID = "late-registration-double-swiss";
const STORAGE_KEY = `otb-director-state-v3-${TOURNAMENT_ID}`;

function player(id: string, elo: number): Player {
  return {
    id,
    name: `Player ${id}`,
    username: `player-${id}`,
    country: "US",
    elo,
    pairingRating: elo,
    ratingSource: "manual",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
  };
}

function saveRoundOneState(withRecordedBoard = false): void {
  const players = Array.from({ length: 6 }, (_, index) => player(`p${index + 1}`, 1800 - index * 50));
  const games = [
    { id: "r1b1a", round: 1, board: 1, gameIndex: 0 as const, whiteId: "p1", blackId: "p4", result: withRecordedBoard ? "1-0" as const : "*" as const },
    { id: "r1b1b", round: 1, board: 1, gameIndex: 1 as const, whiteId: "p4", blackId: "p1", result: "*" as const },
    { id: "r1b2a", round: 1, board: 2, gameIndex: 0 as const, whiteId: "p2", blackId: "p5", result: "*" as const },
    { id: "r1b2b", round: 1, board: 2, gameIndex: 1 as const, whiteId: "p5", blackId: "p2", result: "*" as const },
    { id: "r1b3a", round: 1, board: 3, gameIndex: 0 as const, whiteId: "p3", blackId: "p6", result: "*" as const },
    { id: "r1b3b", round: 1, board: 3, gameIndex: 1 as const, whiteId: "p6", blackId: "p3", result: "*" as const },
  ];
  const state: DirectorState = {
    tournamentId: TOURNAMENT_ID,
    tournamentName: "Late Registration Double Swiss",
    totalRounds: 3,
    format: "doubleswiss",
    status: "in_progress",
    currentRound: 1,
    roundMinutes: 25,
    players,
    rounds: [{ number: 1, status: "in_progress", games }],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    state,
  }));
}

function expectReportableDoubleSwissBoards(state: DirectorState): void {
  const games = state.rounds[0]?.games ?? [];
  const gamesByBoard = new Map<number, typeof games>();
  for (const game of games) {
    gamesByBoard.set(game.board, [...(gamesByBoard.get(game.board) ?? []), game]);
  }

  for (const boardGames of Array.from(gamesByBoard.values())) {
    const isBye = boardGames.some((game) => game.whiteId === "BYE" || game.blackId === "BYE");
    if (isBye) {
      expect(boardGames).toHaveLength(1);
      expect(boardGames[0]?.gameIndex).toBe(0);
      continue;
    }

    expect(boardGames).toHaveLength(2);
    expect(boardGames.map((game) => game.gameIndex).sort()).toEqual([0, 1]);
    expect(boardGames[0]?.whiteId).toBe(boardGames[1]?.blackId);
    expect(boardGames[0]?.blackId).toBe(boardGames[1]?.whiteId);
  }
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Double Swiss late registration", () => {
  it("keeps every Round 1 pairing reportable after consecutive walk-ins", () => {
    saveRoundOneState();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => useDirectorState(TOURNAMENT_ID));

    let firstOutcome: ReturnType<typeof result.current.addLatePlayer>;
    act(() => {
      firstOutcome = result.current.addLatePlayer(player("p7", 1450));
    });
    expect(firstOutcome!).toEqual({ bye: true });
    expect(result.current.state.players).toHaveLength(7);
    expect(result.current.state.status).toBe("in_progress");
    expect(result.current.state.currentRound).toBe(1);
    expect(result.current.state.rounds.find((round) => round.number === 1)).toBeDefined();
    expectReportableDoubleSwissBoards(result.current.state);

    let secondOutcome: ReturnType<typeof result.current.addLatePlayer>;
    act(() => {
      secondOutcome = result.current.addLatePlayer(player("p8", 1400));
    });
    expect(secondOutcome!).toEqual(expect.objectContaining({ paired: true }));
    expect(result.current.state.players).toHaveLength(8);
    expect(result.current.state.rounds[0]?.games).toHaveLength(8);
    expectReportableDoubleSwissBoards(result.current.state);
  });

  it("preserves both colors of any board with a recorded result", () => {
    saveRoundOneState(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => useDirectorState(TOURNAMENT_ID));

    act(() => {
      result.current.addLatePlayer(player("p7", 1450));
    });

    const firstBoard = result.current.state.rounds[0]?.games.filter((game) => game.board === 1) ?? [];
    expect(firstBoard).toEqual([
      expect.objectContaining({ id: "r1b1a", result: "1-0", gameIndex: 0 }),
      expect.objectContaining({ id: "r1b1b", result: "*", gameIndex: 1 }),
    ]);
    expectReportableDoubleSwissBoards(result.current.state);
  });
});
