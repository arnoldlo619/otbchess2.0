import { describe, expect, it } from "vitest";
import { classifySseStream, routePattern } from "./operationalTelemetry";

describe("operational telemetry privacy helpers", () => {
  it("replaces dynamic route identifiers and strips query/hash data", () => {
    expect(routePattern("/tournament/summer-open-2026/manage?email=private@example.com#boards"))
      .toBe("/tournament/:id/manage");
    expect(routePattern("/clubs/club-123/meetup/event-456/rsvp-form/builder"))
      .toBe("/clubs/:id/meetup/:id/rsvp-form/builder");
    expect(routePattern("/prep/real-player-name")).toBe("/prep/:id");
  });

  it("preserves only known static route segments", () => {
    expect(routePattern("/")).toBe("/");
    expect(routePattern("/league-demo")).toBe("/league-demo");
    expect(routePattern("/openings/caro-kann/study/main-line")).toBe("/openings/:id/study/:id");
  });

  it.each([
    ["/api/broadcasts/broadcast-secret/events", "broadcast"],
    ["/api/clubs/club-secret/stream", "club"],
    ["/api/sse?channel=tournament-secret", "live_boards"],
    ["/api/tournament/event-secret/events", "tournament_events"],
    ["/api/tournament/live-secret/stream", "tournament_live"],
    ["/api/tournament/player-secret/players/stream", "tournament_players"],
    ["/api/unknown/private-id", "other"],
  ] as const)("classifies %s without returning its identifier", (url, expected) => {
    expect(classifySseStream(url)).toBe(expected);
  });
});
