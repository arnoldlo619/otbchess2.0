// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPuzzleRelaySession: vi.fn(),
  startPuzzleRelaySession: vi.fn(),
  submitPuzzleRelayAttempt: vi.fn(),
}));

vi.mock("react-chessboard", () => ({
  Chessboard: ({ options }: { options: { allowDragging: boolean; onPieceDrop: (move: { sourceSquare: string; targetSquare: string }) => boolean } }) => (
    <button
      type="button"
      aria-label="Make relay move"
      disabled={!options.allowDragging}
      onClick={() => options.onPieceDrop({ sourceSquare: "d1", targetSquare: "d8" })}
    >
      Puzzle board
    </button>
  ),
}));

vi.mock("../client/src/lib/clubPuzzleRelayApi", () => ({
  getPuzzleRelaySession: mocks.getPuzzleRelaySession,
  startPuzzleRelaySession: mocks.startPuzzleRelaySession,
  submitPuzzleRelayAttempt: mocks.submitPuzzleRelayAttempt,
}));

import { ClubPuzzleRelaySession } from "../client/src/components/club/ClubPuzzleRelaySession";

const activeSession = {
  id: "relay-1",
  clubId: "club-1",
  eventId: "event-1",
  status: "active" as const,
  difficulty: "intermediate" as const,
  puzzlesPerTeam: 3,
  startedBy: "director-1",
  startedAt: "2026-10-06T08:00:00.000Z",
  completedAt: null,
  teams: [
    {
      id: "team-1",
      teamNumber: 1,
      name: "Team 1",
      score: 0,
      currentPuzzleIndex: 0,
      currentMemberIndex: 0,
      completed: false,
      currentPuzzle: {
        id: "beginner-back-rank-1",
        difficulty: "beginner" as const,
        title: "Back-rank finish",
        prompt: "White to move. Find the checkmate.",
        fen: "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
      },
      members: [{ userId: "member-1", displayName: "Alex", avatarUrl: null, orderIndex: 0 }],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ClubPuzzleRelaySession", () => {
  it("gives only owners and directors a clear start action before the relay exists", async () => {
    const user = userEvent.setup();
    mocks.getPuzzleRelaySession.mockResolvedValue(null);
    mocks.startPuzzleRelaySession.mockResolvedValue(activeSession);

    render(<ClubPuzzleRelaySession clubId="club-1" eventId="event-1" canManage currentUserId="director-1" />);

    const start = await screen.findByRole("button", { name: "Start relay" });
    await user.click(start);

    expect(mocks.startPuzzleRelaySession).toHaveBeenCalledWith("club-1", "event-1");
    expect(await screen.findByText("Team standings")).toBeTruthy();
  });

  it("keeps the board interactive only for the active teammate and submits a move", async () => {
    const user = userEvent.setup();
    mocks.getPuzzleRelaySession.mockResolvedValue(activeSession);
    mocks.submitPuzzleRelayAttempt.mockResolvedValue({ correct: true, completed: false, session: activeSession });

    render(<ClubPuzzleRelaySession clubId="club-1" eventId="event-1" canManage={false} currentUserId="member-1" />);

    const move = await screen.findByRole("button", { name: "Make relay move" });
    expect(move).not.toHaveProperty("disabled", true);
    await user.click(move);

    await waitFor(() => expect(mocks.submitPuzzleRelayAttempt).toHaveBeenCalledWith({
      clubId: "club-1",
      eventId: "event-1",
      teamId: "team-1",
      from: "d1",
      to: "d8",
      promotion: undefined,
    }));
    expect(screen.getByLabelText("Elapsed relay time")).toBeTruthy();
  });
});
