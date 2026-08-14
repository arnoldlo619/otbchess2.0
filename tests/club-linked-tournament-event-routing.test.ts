import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");
const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"), "utf8");

describe("club-linked tournament event routing", () => {
  it("routes owners to the newly created linked event from both tournament creation surfaces", () => {
    expect(dashboardSource).toContain("const linkedEvent = createClubEvent({");
    expect(dashboardSource).toContain("navigate(`/clubs/${club.id}/meetup/${linkedEvent.id}`)");
    expect(profileSource).toContain("const linkedEvent = createClubEvent({");
    expect(profileSource).toContain("navigate(`/clubs/${club.id}/meetup/${linkedEvent.id}`)");
  });

  it("keeps event-page, RSVP form, and RSVP management actions available from Club Events", () => {
    expect(dashboardSource).toContain("Event page");
    expect(dashboardSource).toContain("/rsvp-form/builder");
    expect(dashboardSource).toContain("Manage RSVPs");
  });
});
