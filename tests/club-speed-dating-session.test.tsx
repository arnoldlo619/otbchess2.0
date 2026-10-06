// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSpeedDatingSession: vi.fn(),
  startSpeedDatingSession: vi.fn(),
  advanceSpeedDatingSession: vi.fn(),
}));

vi.mock("../client/src/lib/clubEventRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client/src/lib/clubEventRegistry")>();
  return {
    ...actual,
    getSpeedDatingSession: mocks.getSpeedDatingSession,
    startSpeedDatingSession: mocks.startSpeedDatingSession,
    advanceSpeedDatingSession: mocks.advanceSpeedDatingSession,
  };
});

import { ClubSpeedDatingSession } from "../client/src/components/club/ClubSpeedDatingSession";

const event = {
  id: "speed-event",
  clubId: "club-1",
  title: "Speed Dating Chess Night",
  startAt: "2026-10-06T19:00:00.000Z",
  creatorId: "director-1",
  creatorName: "Director",
  isPublished: true,
  eventType: "speed_dating" as const,
  speedDatingRounds: 3,
  speedDatingMinutes: 5,
  createdAt: "2026-10-01T19:00:00.000Z",
  updatedAt: "2026-10-01T19:00:00.000Z",
};

const liveSession = {
  id: "session-1",
  clubId: "club-1",
  eventId: "speed-event",
  status: "active" as const,
  currentRound: 1,
  totalRounds: 3,
  minutesPerRound: 5,
  currentRoundEndsAt: new Date(Date.now() + 300_000).toISOString(),
  participants: [
    { userId: "member-1", displayName: "Member One", avatarUrl: null },
    { userId: "member-2", displayName: "Member Two", avatarUrl: null },
  ],
  pairings: [{
    id: "pair-1",
    boardNumber: 1,
    white: { userId: "member-1", displayName: "Member One", avatarUrl: null },
    black: { userId: "member-2", displayName: "Member Two", avatarUrl: null },
  }],
};

describe("Club Speed Dating session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSpeedDatingSession.mockResolvedValue({ canManage: true, session: null });
    mocks.startSpeedDatingSession.mockResolvedValue(liveSession);
    mocks.advanceSpeedDatingSession.mockResolvedValue({ ...liveSession, currentRound: 2 });
  });

  afterEach(() => cleanup());

  it("lets an organizer start a persistent session and exposes the shared pairing", async () => {
    const user = userEvent.setup();
    render(<ClubSpeedDatingSession event={event} viewerId="member-1" canManage accentColor="#4CAF50" />);

    expect(await screen.findByRole("button", { name: "Start Speed Dating" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Start Speed Dating" }));

    await waitFor(() => expect(mocks.startSpeedDatingSession).toHaveBeenCalledWith("club-1", "speed-event"));
    expect(await screen.findByText("Round 1 of 3")).toBeTruthy();
    expect(screen.getByText("Your table")).toBeTruthy();
    expect(screen.getAllByText("Member Two")).toHaveLength(2);
    expect(screen.getByText("You play as White · Table 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Advance to next round" })).toBeTruthy();
  });

  it("keeps member controls read-only before the organizer begins", async () => {
    mocks.getSpeedDatingSession.mockResolvedValue({ canManage: false, session: null });
    render(<ClubSpeedDatingSession event={event} viewerId="member-1" canManage={false} accentColor="#4CAF50" />);

    expect(await screen.findByText(/organizer will start the shared first round/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Speed Dating" })).toBeNull();
  });
});
