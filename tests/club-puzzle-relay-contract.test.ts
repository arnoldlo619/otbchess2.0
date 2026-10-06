import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("client/src/pages/ClubDashboard.tsx", "utf8");
const clubsRoutes = readFileSync("server/clubs.ts", "utf8");

describe("Club Puzzle Relay contracts", () => {
  it("offers an intentional event creation path with editable team and difficulty setup", () => {
    expect(dashboard).toContain('setSelectedEventType("puzzle_relay")');
    expect(dashboard).toContain("Puzzle Relay");
    expect(dashboard).toContain('id="puzzle-relay-teams"');
    expect(dashboard).toContain('aria-label="Puzzle Relay difficulty"');
    expect(dashboard).toContain('eventType: selectedEventType');
    expect(dashboard).toContain('puzzleRelayTeams: selectedEventType === "puzzle_relay" ? puzzleRelayTeams : undefined');
  });

  it("keeps the relay participant-safe and manager-controlled", () => {
    expect(clubsRoutes).toContain('events/:eventId/puzzle-relay/start');
    expect(clubsRoutes).toContain("Only club owners and directors can start Puzzle Relay");
    expect(clubsRoutes).toContain("At least two checked-in or going members are needed to start Puzzle Relay");
    expect(clubsRoutes).toContain("Wait for your teammate to hand off the board");
    expect(clubsRoutes).toContain("getPuzzleRelaySessionPayload");
  });
});
