// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForecastWalkthrough } from "../client/src/components/prep/ForecastWalkthrough";
import type { ForecastBranch } from "../shared/prepTypes";

vi.mock("react-chessboard", () => ({
  Chessboard: ({ options }: { options: { position: string; boardOrientation: string; pieces: Record<string, unknown> } }) => (
    <div data-testid="legal-line-board" data-position={options.position} data-orientation={options.boardOrientation} data-piece-count={Object.keys(options.pieces).length} />
  ),
}));

const tokens = { card: "rounded-xl border", textPrimary: "text-slate-950", textSecondary: "text-slate-600", textTertiary: "text-slate-500" };

const rootBranch: ForecastBranch = {
  moveSan: "e4",
  previewPath: ["e4"],
  moveUci: "e2e4",
  actor: "opponent",
  count: 12,
  pct: 0.6,
  score: 0.5,
  wins: 6,
  draws: 0,
  losses: 6,
  parentGames: 20,
  label: "Most observed first move",
  children: [{
    moveSan: "c5",
    previewPath: ["e4", "c5"],
    moveUci: "c7c5",
    actor: "user",
    count: 7,
    pct: 0.58,
    score: 0.5,
    wins: 3,
    draws: 1,
    losses: 3,
    parentGames: 12,
    label: "Observed response",
    children: [],
  }],
};

const whiteRootBranch: ForecastBranch = {
  ...rootBranch,
  moveSan: "d4",
  previewPath: ["d4"],
  moveUci: "d2d4",
  label: "Most observed White first move",
  children: [{ ...rootBranch.children[0], moveSan: "d5", previewPath: ["d4", "d5"], moveUci: "d7d5" }],
};

describe("Legal Line Explorer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the self-hosted Livius set and keeps move selection synchronized with legal replay", () => {
    render(<ForecastWalkthrough openingForecast={{ white: [], black: [rootBranch] }} myColor="white" isDark t={tokens} opponentUsername="opponent" opponentRating={1520} />);
    const board = screen.getByTestId("legal-line-board");
    expect(board.dataset.pieceCount).toBe("12");
    expect(screen.getByRole("heading", { name: "Legal line explorer" })).toBeTruthy();
    expect(screen.queryByText("Your Rehearsal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /opponent's tendency: e4/i }));
    expect(screen.getByText("c5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /your candidate: c5/i }));
    expect(board.dataset.position).toContain("rnbqkbnr");
    expect(screen.getAllByText(/1\. e4 c5/).length).toBeGreaterThanOrEqual(1);
  });

  it("provides explicit orientation and FEN-copy controls", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ForecastWalkthrough openingForecast={{ white: [], black: [rootBranch] }} myColor="white" isDark={false} t={tokens} opponentUsername="opponent" />);

    const flip = screen.getByRole("button", { name: /flip/i });
    expect(flip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(flip);
    expect(flip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("legal-line-board").dataset.orientation).toBe("black");

    fireEvent.click(screen.getByRole("button", { name: /copy fen/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy());
  });

  it("keeps the playing-color switch inside the explorer and swaps the opponent tree without altering report identity", () => {
    render(<ForecastWalkthrough openingForecast={{ white: [whiteRootBranch], black: [rootBranch] }} isDark t={tokens} opponentUsername="opponent" />);

    const white = screen.getByRole("button", { name: "White" });
    const black = screen.getByRole("button", { name: "Black" });
    expect(white.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /opponent's tendency: e4/i })).toBeTruthy();

    fireEvent.click(black);
    expect(black.getAttribute("aria-pressed")).toBe("true");
    expect(white.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /opponent's tendency: d4/i })).toBeTruthy();
    expect(screen.getByTestId("legal-line-board").dataset.orientation).toBe("black");
  });
});
