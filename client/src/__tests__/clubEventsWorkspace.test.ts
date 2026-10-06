import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);

describe("Club Events gallery", () => {
  it("uses a single upcoming-only event projection", () => {
    expect(dashboardSource).toContain('const upcomingEvents = events.filter(isUpcoming).sort');
    expect(dashboardSource).toContain('tab === "events" && eventsFilter !== "leagues"');
    expect(dashboardSource).toContain('aria-label="Scheduled club events"');
    expect(dashboardSource).not.toContain('showPastMeetups');
    expect(dashboardSource).not.toContain('showPastTournaments');
    expect(dashboardSource).not.toContain('showPastEvents');
    expect(dashboardSource).not.toContain('role="tablist" aria-label="Event type"');
  });

  it("renders a larger cover-led card for every scheduled event", () => {
    expect(dashboardSource).toContain("function ScheduledEventGalleryCard");
    expect(dashboardSource).toContain("upcomingEvents.map((event) => (");
    expect(dashboardSource).toContain('data-club-event-card="large"');
    expect(dashboardSource).toContain("aspect-[16/10]");
    expect(dashboardSource).toContain("line-clamp-2 text-xl font-bold");
    expect(dashboardSource).toContain("min-h-[184px]");
    expect(dashboardSource).toContain("sm:grid-cols-2 xl:grid-cols-2 xl:gap-6");
    expect(dashboardSource).toContain("event.coverImageUrl");
    expect(dashboardSource).toContain('className="absolute inset-0 z-10 cursor-pointer touch-manipulation rounded-3xl');
    expect(dashboardSource).toContain('aria-label={`Open ${event.title} details`}');
    expect(dashboardSource).toContain("Open {event.title} details");
    expect(dashboardSource).not.toContain("View event");
    expect(dashboardSource).toContain("No scheduled events");
  });

  it("keeps organizer creation and management paths without reintroducing filters", () => {
    expect(dashboardSource).toContain('label: "Create event"');
    expect(dashboardSource).toContain("setShowCreateEvent(true)");
    expect(dashboardSource).toContain("onOpenRsvps={() => openRsvpPanel(event.id)}");
    expect(dashboardSource).toContain("Manage RSVPs");
    expect(dashboardSource).toContain('aria-label={`Options for ${event.title}`}');
    expect(dashboardSource).toContain("setEventsFilter(\"leagues\"); setTab(\"events\")");
    expect(dashboardSource).toContain('tab === "events" && eventsFilter === "leagues"');
  });

  it("clears the private League handoff when Events is opened from navigation", () => {
    expect(dashboardSource).toContain('if (nextTab === "events") setEventsFilter("all")');
    expect(dashboardSource).toContain('if (clubTab.id === "events") setEventsFilter("all")');
  });
});
