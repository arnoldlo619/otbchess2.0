/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { loadTournamentState, useDirectorState } from "../directorState";

const DEMO_ID = "otb-demo-2026";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("Director withdrawal lifecycle", () => {
  it("persists a withdrawal while retaining the player and their prior tournament data", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDirectorState(DEMO_ID));
    const target = result.current.state.players[0];
    const priorPoints = target.points;

    act(() => result.current.withdrawPlayer(target.id));
    act(() => vi.advanceTimersByTime(350));

    const withdrawn = result.current.state.players.find((player) => player.id === target.id);
    const persisted = loadTournamentState(DEMO_ID)?.players.find((player) => player.id === target.id);

    expect(withdrawn).toMatchObject({ id: target.id, withdrawn: true, points: priorPoints });
    expect(withdrawn?.withdrawnAt).toEqual(expect.any(String));
    expect(persisted).toMatchObject({ id: target.id, withdrawn: true, points: priorPoints });
  });

  it("allows a director to reinstate a withdrawn player for the next generated round", () => {
    const { result } = renderHook(() => useDirectorState(DEMO_ID));
    const target = result.current.state.players[0];

    act(() => result.current.withdrawPlayer(target.id));
    expect(result.current.state.players.find((player) => player.id === target.id)?.withdrawn).toBe(true);

    act(() => result.current.reinstatePlayer(target.id));
    const reinstated = result.current.state.players.find((player) => player.id === target.id);

    expect(reinstated).toMatchObject({ id: target.id, withdrawn: false });
    expect(reinstated?.withdrawnAt).toBeUndefined();
  });
});
