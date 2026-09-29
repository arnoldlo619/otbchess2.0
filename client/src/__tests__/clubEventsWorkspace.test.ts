import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);

describe("Club Events workspace", () => {
  it("uses a schedule-first header with explicit event-type tabs", () => {
    expect(dashboardSource).toContain('aria-labelledby="club-events-heading"');
    expect(dashboardSource).toContain('Club schedule');
    expect(dashboardSource).toContain('role="tablist" aria-label="Event type"');
    expect(dashboardSource).toContain('{ key: "all", label: "All events" }');
    expect(dashboardSource).toContain('{ key: "meetups", label: "Meetups" }');
    expect(dashboardSource).toContain('{ key: "tournaments", label: "Tournaments" }');
    expect(dashboardSource).toContain('{ key: "leagues", label: "Leagues" }');
    expect(dashboardSource).toContain('eventFilterCounts[filter.key]');
  });

  it("keeps creation paths clear for organizers", () => {
    expect(dashboardSource).toContain('New tournament');
    expect(dashboardSource).toContain('Create meetup');
    expect(dashboardSource).toContain('New league');
  });

  it("renders only the category selected by the Events filter", () => {
    expect(dashboardSource).toContain('(eventsFilter === "all" || eventsFilter === "meetups")');
    expect(dashboardSource).toContain('(eventsFilter === "all" || eventsFilter === "tournaments")');
    expect(dashboardSource).toContain('eventsFilter === "all" && otherEvents.length > 0');
    expect(dashboardSource).toContain('tab === "events" && eventsFilter === "leagues"');
  });

  it("uses readable, date-led cards and persistent owner actions", () => {
    expect(dashboardSource).toContain('Open meetup');
    expect(dashboardSource).toContain('Open tournament');
    expect(dashboardSource).toContain('aria-label={`Edit ${ev.title}`}');
    expect(dashboardSource).toContain('aria-label={`Delete ${ev.title}`}');
    expect(dashboardSource).toContain('Registration');
    expect(dashboardSource).not.toContain('const isUpcomingTmt = true;');
  });
});
