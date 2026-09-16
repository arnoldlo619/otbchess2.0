import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const wizard = fs.readFileSync(path.join(root, "components", "TournamentWizard.tsx"), "utf8");
const clubsApi = fs.readFileSync(path.join(root, "..", "..", "server", "clubs.ts"), "utf8");
const clubDashboard = fs.readFileSync(path.join(root, "pages", "ClubDashboard.tsx"), "utf8");
const clubProfile = fs.readFileSync(path.join(root, "pages", "ClubProfile.tsx"), "utf8");

describe("club-linked tournament event synchronization", () => {
  it("persists a canonical Club Event from every linked Tournament Wizard creation", () => {
    expect(wizard).toContain("ensureTournamentClubEvent");
    expect(wizard).toContain("const clubEventId = await persistLinkedClubEvent(slug)");
    expect(wizard).toContain("onClose(slug, data.name, clubEventId)");
  });

  it("keeps a tournament linked to one idempotent server-backed Club Event", () => {
    expect(clubsApi).toContain("if (body.tournamentId)");
    expect(clubsApi).toContain("Tournament is already linked to another club event");
    expect(clubsApi).toContain("broadcastClubEvent(id, \"event_created\"");
  });

  it("does not replace a server-backed Club Event with a local-only fallback", () => {
    expect(clubDashboard).toContain("if (createdClubEventId)");
    expect(clubProfile).toContain("if (createdClubEventId)");
    expect(clubDashboard).not.toContain("const linkedEventId = createdClubEventId ?? createClubEvent");
    expect(clubProfile).not.toContain("const linkedEventId = createdClubEventId ?? createClubEvent");
  });

  it("backfills previously linked owner tournaments into canonical Club Events", () => {
    expect(clubDashboard).toContain("listTournamentsByClub(clubId)");
    expect(clubDashboard).toContain("ensureTournamentClubEvent({");
    expect(clubDashboard).toContain("syncEventsFromServer(clubId).then(setEvents)");
  });

  it("refreshes the active Club Events dashboard after a server-created tournament event", () => {
    expect(clubDashboard).toContain('es.addEventListener("event_created"');
  });
});
