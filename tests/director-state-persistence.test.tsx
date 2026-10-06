// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDirectorState, type DirectorState } from "../client/src/lib/directorState";

const initialState: DirectorState = {
  tournamentId: "director-edit-persist",
  tournamentName: "Director edit persistence",
  totalRounds: 3,
  format: "swiss",
  status: "in_progress",
  currentRound: 1,
  roundMinutes: 25,
  players: [
    { id: "p1", name: "Alex Player", username: "alex", elo: 1500, pairingRating: 1500, ratingSource: "rapid" },
    { id: "p2", name: "Blair Player", username: "blair", elo: 1450, pairingRating: 1450, ratingSource: "rapid" },
    { id: "p3", name: "Casey Player", username: "casey", elo: 1400, pairingRating: 1400, ratingSource: "rapid" },
    { id: "p4", name: "Devon Player", username: "devon", elo: 1350, pairingRating: 1350, ratingSource: "rapid" },
  ],
  rounds: [{
    number: 1,
    status: "in_progress",
    games: [
      { id: "board-1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" },
      { id: "board-2", round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "*" },
    ],
  }],
};

function DirectorStateHarness() {
  const { state, updatePlayer, replaceRoundGames } = useDirectorState("director-edit-persist");
  const player = state.players.find((candidate) => candidate.id === "p1");

  return (
    <div>
      <output data-testid="player-name">{player?.name ?? "loading"}</output>
      <button type="button" onClick={() => updatePlayer("p1", { name: "Alex Edited", manualPairingRating: 1600, pairingRating: 1600, ratingSource: "manual" })}>
        Save player edit
      </button>
      <button type="button" onClick={() => replaceRoundGames([
        { ...initialState.rounds[0].games[0], whiteId: "p4" },
        { ...initialState.rounds[0].games[1], blackId: "p1" },
      ])}>
        Save pairing swap
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Director state persistence", () => {
  it("writes edited players and pairing swaps through the revision-protected state endpoint", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: initialState, updatedAt: "2026-10-06T00:00:00.000Z", revision: 7 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, revision: 8 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<DirectorStateHarness />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("player-name").textContent).toBe("Alex Player");
    fireEvent.click(screen.getByRole("button", { name: "Save player edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save pairing swap" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/tournament/director-edit-persist/state",
      expect.objectContaining({ method: "PUT" }),
    );

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const saved = JSON.parse(String(request.body)) as { state: DirectorState; baseRevision: number };
    expect(saved.baseRevision).toBe(7);
    expect(saved.state.players.find((player) => player.id === "p1")).toEqual(expect.objectContaining({
      name: "Alex Edited",
      manualPairingRating: 1600,
      pairingRating: 1600,
      ratingSource: "manual",
    }));
    expect(saved.state.rounds[0].games).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "board-1", whiteId: "p4", blackId: "p2" }),
      expect.objectContaining({ id: "board-2", whiteId: "p3", blackId: "p1" }),
    ]));
  });
});
