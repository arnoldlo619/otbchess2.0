// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CutoffOverrideModal } from "../client/src/components/CutoffOverrideModal";
import { useDirectorState, type DirectorState } from "../client/src/lib/directorState";
import type { Player } from "../client/src/lib/tournamentData";

const players: Player[] = Array.from({ length: 8 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Player ${index + 1}`,
  username: `player${index + 1}`,
  elo: 2000 - index * 50,
  wins: 3 - Math.floor(index / 3),
  draws: 0,
  losses: Math.floor(index / 3),
  points: 3 - Math.floor(index / 3),
}));

function makeState(withEliminationResult = false): DirectorState {
  return {
    tournamentId: "cutoff-override",
    tournamentName: "Swiss Elimination Override",
    totalRounds: 6,
    format: "swiss_elim",
    swissRounds: 3,
    elimPhase: "elimination",
    elimCutoff: 8,
    elimRoundLabelText: "Quarterfinals",
    elimPlayers: players,
    players,
    currentRound: 4,
    status: "in_progress",
    roundMinutes: 25,
    rounds: [
      { number: 1, status: "completed", games: [] },
      { number: 2, status: "completed", games: [] },
      { number: 3, status: "completed", games: [] },
      {
        number: 4,
        status: "in_progress",
        games: [
          { id: "elim-1", round: 4, board: 1, whiteId: "p1", blackId: "p8", result: withEliminationResult ? "1-0" : "*" },
          { id: "elim-2", round: 4, board: 2, whiteId: "p4", blackId: "p5", result: "*" },
          { id: "elim-3", round: 4, board: 3, whiteId: "p2", blackId: "p7", result: "*" },
          { id: "elim-4", round: 4, board: 4, whiteId: "p3", blackId: "p6", result: "*" },
        ],
      },
    ],
  };
}

function OverrideHarness({ withEliminationResult = false }: { withEliminationResult?: boolean }) {
  const { state, resetElimination } = useDirectorState("cutoff-override");

  return (
    <div>
      <output data-testid="cutoff">{state.elimCutoff}</output>
      <output data-testid="round-count">{state.rounds.length}</output>
      <output data-testid="advancer-count">{state.elimPlayers?.length ?? 0}</output>
      <button type="button" onClick={() => resetElimination(4)}>
        Reset to top four
      </button>
      {withEliminationResult ? <span data-testid="fixture-result">resulted</span> : null}
    </div>
  );
}

function seedState(withEliminationResult = false) {
  localStorage.setItem("otb-director-state-v3-cutoff-override", JSON.stringify({
    schemaVersion: 3,
    savedAt: "2026-10-06T00:00:00.000Z",
    state: makeState(withEliminationResult),
  }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Cutoff override", () => {
  it("regenerates an untouched Swiss-elimination bracket from the selected cutoff", async () => {
    seedState();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<OverrideHarness />);

    expect(screen.getByTestId("cutoff").textContent).toBe("8");
    expect(screen.getByTestId("round-count").textContent).toBe("4");

    await act(async () => {
      screen.getByRole("button", { name: "Reset to top four" }).click();
    });

    expect(screen.getByTestId("cutoff").textContent).toBe("4");
    expect(screen.getByTestId("advancer-count").textContent).toBe("4");
    expect(screen.getByTestId("round-count").textContent).toBe("4");
  });

  it("does not replace a bracket after a non-bye elimination result is recorded", async () => {
    seedState(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<OverrideHarness withEliminationResult />);

    await act(async () => {
      screen.getByRole("button", { name: "Reset to top four" }).click();
    });

    expect(screen.getByTestId("cutoff").textContent).toBe("8");
    expect(screen.getByTestId("advancer-count").textContent).toBe("8");
  });

  it("offers power-of-two cutoff options and applies a selected override", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <CutoffOverrideModal
        mode="change"
        currentCutoff={8}
        totalPlayers={8}
        hasResults={false}
        isDark
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Change Bracket Cutoff" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /4.*2R elim/i }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onConfirm).toHaveBeenCalledWith(4);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks cutoff controls once an elimination result exists", () => {
    render(
      <CutoffOverrideModal
        mode="change"
        currentCutoff={8}
        totalPlayers={8}
        hasResults
        isDark={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/cannot be changed once play has begun/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /4.*2R elim/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
