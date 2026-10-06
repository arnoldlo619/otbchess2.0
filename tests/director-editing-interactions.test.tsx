// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditPlayerModal } from "../client/src/components/EditPlayerModal";
import { PairingSwapModal } from "../client/src/components/PairingSwapModal";
import { ThemeProvider } from "../client/src/contexts/ThemeContext";
import type { Game, Player } from "../client/src/lib/tournamentData";

const players: Player[] = [
  { id: "p1", name: "Alex Player", username: "alex", elo: 1520, rapidElo: 1540, blitzElo: 1490, pairingRating: 1540, ratingSource: "rapid" },
  { id: "p2", name: "Blair Player", username: "blair", elo: 1480, rapidElo: 1470, blitzElo: 1500, pairingRating: 1470, ratingSource: "rapid" },
  { id: "p3", name: "Casey Player", username: "casey", elo: 1430, rapidElo: 1420, blitzElo: 1450, pairingRating: 1420, ratingSource: "rapid" },
  { id: "p4", name: "Devon Player", username: "devon", elo: 1400, rapidElo: 1410, blitzElo: 1390, pairingRating: 1410, ratingSource: "rapid" },
];

const games: Game[] = [
  { id: "board-1", round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "*" },
  { id: "board-2", round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "*" },
];

function renderWithTheme(node: React.ReactNode) {
  return render(<ThemeProvider defaultTheme="dark">{node}</ThemeProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Director editing interactions", () => {
  it("saves a validated player edit with an explicit pairing override", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    renderWithTheme(
      <EditPlayerModal
        open
        player={players[0]}
        tournamentRatingType="rapid"
        onSave={onSave}
        onClose={onClose}
      />,
    );

    const name = screen.getByRole("textbox", { name: "Display Name" });
    await user.clear(name);
    await user.type(name, "Alex Tournament");
    await user.clear(screen.getByRole("spinbutton", { name: "Active ELO" }));
    await user.type(screen.getByRole("spinbutton", { name: "Active ELO" }), "1600");
    await user.type(screen.getByRole("spinbutton", { name: "Manual Pairing Rating" }), "1610");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: "p1",
      name: "Alex Tournament",
      elo: 1600,
      manualPairingRating: 1610,
      pairingRating: 1610,
      ratingSource: "manual",
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("previews and confirms a cross-board pairing swap", async () => {
    const user = userEvent.setup();
    const onSwap = vi.fn();
    const onClose = vi.fn();

    renderWithTheme(
      <PairingSwapModal
        open
        games={games}
        players={players}
        roundNumber={1}
        onSwap={onSwap}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Alex Player.*Board 1.*White/i }));
    await user.click(screen.getByRole("button", { name: /Devon Player.*Board 2.*Black/i }));

    expect(screen.getByText("Preview after swap")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm Swap" }));

    expect(onSwap).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: "board-1", whiteId: "p4", blackId: "p2" }),
      expect.objectContaining({ id: "board-2", whiteId: "p3", blackId: "p1" }),
    ]));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
