// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("../client/src/components/PlayerAvatar", () => ({
  PlayerAvatar: ({ name }: { name: string }) => <div aria-label={`${name} avatar`} />,
}));

import { ClubTournamentLeaderboard } from "../client/src/components/club/ClubTournamentLeaderboard";

const leaderboard = {
  completedTournamentsCount: 2,
  playersRankedCount: 3,
  entries: [
    { rank: 1, memberUserId: "member-1", displayName: "Alex", avatarUrl: null, totalPoints: 3, totalWins: 3, tournamentsPlayed: 2, latestEarnedAt: "2026-10-05T20:00:00.000Z", isViewer: true },
    { rank: 1, memberUserId: "member-2", displayName: "Blair", avatarUrl: null, totalPoints: 3, totalWins: 2, tournamentsPlayed: 1, latestEarnedAt: "2026-10-04T20:00:00.000Z", isViewer: false },
    { rank: 3, memberUserId: "member-3", displayName: "Casey", avatarUrl: null, totalPoints: 1, totalWins: 1, tournamentsPlayed: 1, latestEarnedAt: "2026-10-03T20:00:00.000Z", isViewer: false },
  ],
};

function renderLeaderboard(overrides: Partial<ComponentProps<typeof ClubTournamentLeaderboard>> = {}) {
  const onReconcile = vi.fn();
  const view = render(
    <ClubTournamentLeaderboard
      leaderboard={leaderboard}
      loading={false}
      isDark
      accent="#4CAF50"
      viewerHasChesscomUsername
      canReconcile
      reconciling={false}
      onReconcile={onReconcile}
      {...overrides}
    />,
  );
  return { ...view, onReconcile };
}

afterEach(cleanup);

describe("ClubTournamentLeaderboard", () => {
  it("renders tournament points, competition ranks, and a subtle viewer marker", () => {
    renderLeaderboard();

    expect(screen.getByRole("heading", { name: "Tournament Leaderboard" })).toBeTruthy();
    expect(screen.getByText("1 win = 1 point")).toBeTruthy();
    expect(screen.getAllByText("3 points")).toHaveLength(2);
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByLabelText("Rank 3: Casey, 1 point")).toBeTruthy();
  });

  it("provides the organizer reconciliation action with loading feedback", async () => {
    const user = userEvent.setup();
    const { onReconcile } = renderLeaderboard();

    await user.click(screen.getByRole("button", { name: "Refresh results" }));
    expect(onReconcile).toHaveBeenCalledOnce();

    renderLeaderboard({ reconciling: true });
    expect(screen.getByRole("button", { name: "Refreshing results" })).toHaveProperty("disabled", true);
  });

  it("keeps the empty state informative without inventing scores", () => {
    renderLeaderboard({ leaderboard: { entries: [], completedTournamentsCount: 0, playersRankedCount: 0 }, viewerHasChesscomUsername: false });

    expect(screen.getByText("No tournament points yet")).toBeTruthy();
    expect(screen.getByText(/Add your Chess\.com username to be credited automatically/)).toBeTruthy();
  });

  it("uses a structural loading state instead of an empty leaderboard", () => {
    renderLeaderboard({ leaderboard: null, loading: true });
    expect(screen.getByLabelText("Loading tournament leaderboard")).toBeTruthy();
    expect(screen.queryByText("No tournament points yet")).toBeNull();
  });
});
