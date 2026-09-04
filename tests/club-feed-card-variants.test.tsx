// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeedCard } from "../client/src/pages/ClubDashboard";

type FeedCardProps = Parameters<typeof FeedCard>[0];
type FeedEvent = FeedCardProps["event"];

const sharedProps: Omit<FeedCardProps, "event"> = {
  accent: "#4CAF50",
  isDark: true,
  userId: "member-1",
  displayName: "Member",
  clubId: "club-1",
  canDelete: false,
  canPin: false,
  onDelete: () => {},
  onPin: () => {},
  onUnpin: () => {},
  onVoted: () => {},
  onRsvped: () => {},
};

function renderCard(event: Partial<FeedEvent>) {
  return render(
    <FeedCard
      {...sharedProps}
      event={{
        id: "event-1",
        type: "announcement",
        actorName: "Arnold",
        createdAt: "2026-09-04T00:00:00.000Z",
        description: "Club update",
        ...event,
      } as FeedEvent}
    />,
  );
}

afterEach(cleanup);

describe("Club Feed Overview-aligned card variants", () => {
  it("renders the structured metadata hierarchy for announcements and secure image attachments", () => {
    renderCard({
      detail: "Friday night blitz is open.",
      attachments: [{ id: "attachment-1", mimeType: "image/webp", fileName: "blitz.webp", url: "/secure/blitz.webp" }],
    });

    expect(screen.getByText("Arnold")).toBeTruthy();
    expect(screen.getAllByText("Club update")).toHaveLength(2);
    expect(screen.getByText("Friday night blitz is open.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open blitz\.webp in gallery/ })).toBeTruthy();
  });

  it("retains poll and RSVP card controls through the visual-system update", () => {
    const { rerender } = renderCard({
      id: "poll-1",
      type: "poll",
      pollQuestion: "Which night works?",
      pollOptions: [{ id: "option-1", text: "Friday", votes: {} }],
    });
    expect(screen.getByText("Which night works?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Friday/ })).toBeTruthy();

    rerender(
      <FeedCard
        {...sharedProps}
        event={{
          id: "rsvp-1",
          type: "rsvp_form",
          actorName: "Arnold",
          createdAt: "2026-09-04T00:00:00.000Z",
          rsvpTitle: "Saturday meetup",
          rsvpEntries: [],
        } as FeedEvent}
      />,
    );
    expect(screen.getByText("Saturday meetup")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Going" })).toBeTruthy();
  });

  it("keeps the tournament-results card and result link available", () => {
    renderCard({
      id: "result-1",
      type: "tournament_completed",
      tournamentName: "Friday OTB Blitz",
      linkHref: "/tournament/friday/results",
      linkLabel: "View results",
      detail: "🏆 Andrew — 4/4 pts",
    });

    expect(screen.getByText("Friday OTB Blitz Results")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View results/ })).toBeTruthy();
    expect(screen.getAllByText(/Andrew — 4\/4 pts/)).toHaveLength(1);
  });

  it("uses a readable Overview-aligned light appearance without changing Feed controls", () => {
    render(
      <FeedCard
        {...sharedProps}
        isDark={false}
        event={{
          id: "light-update-1",
          type: "announcement",
          actorName: "Arnold",
          createdAt: "2026-09-04T00:00:00.000Z",
          description: "Club update",
          detail: "Light appearance remains readable.",
        } as FeedEvent}
      />,
    );

    const card = screen.getByRole("article");
    expect(card.style.background).toBe("rgba(255, 255, 255, 0.76)");
    expect(card.style.borderColor).toBe("rgba(21, 41, 28, 0.1)");
    expect(screen.getByText("Light appearance remains readable.")).toBeTruthy();
  });
});
