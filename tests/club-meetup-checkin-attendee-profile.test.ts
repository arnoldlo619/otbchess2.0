import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const checkInPage = source("client/src/pages/CheckInPage.tsx");
const profileSheet = source("client/src/components/meetup/MeetupAttendeeProfileSheet.tsx");

describe("Club meetup check-in attendee profile", () => {
  it("removes duplicate event navigation after a successful check-in", () => {
    expect(checkInPage).toContain("View Event Page");
    expect(checkInPage).not.toContain("Back to Event Page");
  });

  it("keeps attendee avatars keyboard-accessible profile triggers", () => {
    expect(checkInPage).toContain('onClick={() => setSelectedAttendee(a)}');
    expect(checkInPage).toContain("aria-label={`View ${a.displayName}'s profile`}");
    expect(checkInPage).toContain("MeetupAttendeeProfileSheet");
    expect(checkInPage).toContain("setSelectedAttendee(null)");
  });

  it("loads the selected attendee's rating snapshot on demand", () => {
    expect(checkInPage).toContain("Ratings are loaded only if an attendee opens the compact profile sheet.");
    expect(profileSheet).toContain("chessComPlayerEndpoint(username)");
    expect(profileSheet).toContain("normalizeChessComPlayerPayload(await response.json(), username)");
    expect(profileSheet).toContain("extractChessComRatings(payload.stats)");
  });

  it("limits the profile sheet to an accessible identity and Rapid/Blitz snapshot", () => {
    expect(profileSheet).toContain('role="dialog"');
    expect(profileSheet).toContain("useAccessibleOverlay");
    expect(profileSheet).toContain('label="Rapid"');
    expect(profileSheet).toContain('label="Blitz"');
    expect(profileSheet).toContain('aria-label="Close player profile"');
    expect(profileSheet).toContain('rel="noopener noreferrer"');
  });
});
