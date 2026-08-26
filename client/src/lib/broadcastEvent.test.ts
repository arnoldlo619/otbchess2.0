import { describe, expect, it } from "vitest";
import { parseBroadcastEvent } from "./broadcastEvent";

const validEvent = JSON.stringify({
  broadcast: {
    id: "broadcast-1",
    tournamentId: "tournament-1",
    roundNumber: 1,
    boardNumber: 1,
    whitePlayerName: "White",
    blackPlayerName: "Black",
    status: "live",
    inputSource: "manual",
    displayMode: "standard",
    currentFen: "startpos",
    pgn: "1. e4",
    moveNumber: 1,
    sideToMove: "b",
    publicSlug: "open-2026",
  },
});

describe("parseBroadcastEvent", () => {
  it("returns a guarded broadcast for a valid SSE payload", () => {
    expect(parseBroadcastEvent(validEvent)).toMatchObject({ id: "broadcast-1", status: "live", currentFen: "startpos" });
  });

  it("rejects malformed events and unsupported lifecycle values", () => {
    expect(parseBroadcastEvent("not-json")).toBeNull();
    expect(parseBroadcastEvent(JSON.stringify({ broadcast: { id: "missing-required-fields" } }))).toBeNull();
    expect(parseBroadcastEvent(validEvent.replace('"live"', '"unknown"'))).toBeNull();
  });
});
