import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const registry = source("client/src/lib/clubEventRegistry.ts");
const meetupPage = source("client/src/pages/MeetupEventPage.tsx");
const qrProjection = source("client/src/components/CheckInAnnounceModal.tsx");
const checkInPage = source("client/src/pages/CheckInPage.tsx");
const clubRoutes = source("server/clubs.ts");

describe("Club Meetup check-in QR reliability", () => {
  it("persists the exact local event ID before projecting it to other devices", () => {
    expect(registry).toContain("export async function ensurePersistedClubEvent(event: ClubEvent)");
    expect(registry).toContain("return persistClubEvent(event)");
    expect(registry).toContain("id: event.id");
    expect(registry).toContain("const canonicalEvent = toClubEvent");
  });

  it("waits for canonical persistence before opening the meetup check-in QR", () => {
    expect(meetupPage).toContain("async function openCheckInQr()");
    expect(meetupPage).toContain("await ensurePersistedClubEvent(event)");
    expect(meetupPage).toContain("setEvent(canonicalEvent)");
    expect(meetupPage).toContain("setShowQr(true)");
    expect(meetupPage).toContain("Preparing QR…");
    expect(meetupPage).toContain("checkInUrl={`${window.location.origin}/checkin/${event.id}`}");
  });

  it("keeps QR projection controls minimal without redundant close instructions", () => {
    expect(qrProjection).not.toContain("Press Escape to close");
    expect(qrProjection).not.toContain("Tap × to close");
    expect(qrProjection).not.toContain("Maximize2");
    expect(qrProjection).toContain('aria-label="Close check-in screen"');
  });

  it("retains a public event lookup for a freshly scanned check-in link", () => {
    const publicLookup = clubRoutes.slice(
      clubRoutes.indexOf('clubsRouter.get("/event/:eventId"'),
      clubRoutes.indexOf('/** GET /api/clubs/:id/events')
    );
    expect(publicLookup).toContain("db.select().from(clubEvents).where(eq(clubEvents.id, eventId))");
    expect(publicLookup).toContain('res.status(404).json({ error: "Event not found" })');
    expect(checkInPage).toContain("/api/clubs/event/${eventId}");
    expect(checkInPage).toContain("navigate(`/clubs/${event.clubId}/meetup/${event.id}`)");
  });
});
