import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CLUB_EVENT_TYPES,
  canonicalizeClubEventType,
  parseClubEventType,
} from "../shared/clubEventTypes";

const clubRoutes = fs.readFileSync(path.resolve(process.cwd(), "server/clubs.ts"), "utf8");
const eventRegistry = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/lib/clubEventRegistry.ts"),
  "utf8",
);

describe("Club Event type taxonomy", () => {
  it("exposes the requested canonical event types", () => {
    expect(CLUB_EVENT_TYPES).toEqual([
      "tournament",
      "puzzle_relay",
      "casual",
      "lecture",
    ]);
  });

  it("maps legacy labels safely while rejecting unknown values", () => {
    expect(parseClubEventType("meetup")).toBe("casual");
    expect(parseClubEventType("standard")).toBe("casual");
    expect(parseClubEventType("speed_dating")).toBeNull();
    expect(parseClubEventType("trivia_night")).toBeNull();
    expect(parseClubEventType("lecture")).toBe("lecture");
    expect(parseClubEventType("unsupported")).toBeNull();
  });

  it("always classifies linked events as tournaments", () => {
    expect(canonicalizeClubEventType("casual", "open-2026")).toBe("tournament");
    expect(canonicalizeClubEventType(undefined, "open-2026")).toBe("tournament");
    expect(canonicalizeClubEventType(undefined)).toBe("casual");
  });

  it("validates and canonicalizes event types on server and client boundaries", () => {
    expect(clubRoutes).toContain('parseClubEventType(body.eventType) === null');
    expect(clubRoutes).toContain('eventType: canonicalizeClubEventType(row.eventType, row.tournamentId)');
    expect(eventRegistry).toContain('eventType: canonicalizeClubEventType(row.eventType, row.tournamentId)');
    expect(eventRegistry).toContain('eventType: "tournament"');
  });
});
