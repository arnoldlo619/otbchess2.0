// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useDirectorState, type DirectorState } from "../client/src/lib/directorState";
import type { Player } from "../client/src/lib/tournamentData";

const TOURNAMENT_ID = "otb-demo-2026";
const STORAGE_KEY = `otb-director-state-v3-${TOURNAMENT_ID}`;

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `quads-start-${index + 1}`,
    name: `Quads Player ${index + 1}`,
    username: `quads_player_${index + 1}`,
    elo: 2200 - index * 50,
    pairingRating: 2200 - index * 50,
    ratingSource: "rapid",
    platform: "chess.com",
  }));
}

function saveRegistrationState(players: Player[]): void {
  const state: DirectorState = {
    tournamentId: TOURNAMENT_ID,
    tournamentName: "18 Player Quads",
    totalRounds: 3,
    format: "quads",
    players,
    rounds: [],
    currentRound: 0,
    status: "registration",
    roundMinutes: 25,
    quadSettings: { ratingSource: "rapid", ratingType: "rapid", colorAssignment: "deterministic" },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    state,
  }));
}

afterEach(() => {
  localStorage.clear();
});

describe("Quads Director start flow", () => {
  it("enables and starts an eighteen-player roster as three Quads plus a bottom Swiss section", () => {
    saveRegistrationState(makePlayers(18));

    const { result } = renderHook(() => useDirectorState(TOURNAMENT_ID));

    expect(result.current.canStart).toBe(true);

    act(() => {
      result.current.startTournament();
    });

    expect(result.current.state).toEqual(expect.objectContaining({
      status: "in_progress",
      currentRound: 1,
      totalRounds: 3,
    }));
    expect(result.current.state.quadSections?.map((section) => ({
      type: section.type,
      players: section.playerIds.length,
    }))).toEqual([
      { type: "quad", players: 4 },
      { type: "quad", players: 4 },
      { type: "quad", players: 4 },
      { type: "bottom_swiss", players: 6 },
    ]);
    expect(result.current.state.rounds).toHaveLength(3);
    expect(result.current.state.rounds[0]?.games).toHaveLength(9);
  });
});
