import { describe, expect, it } from "vitest";

import { savedScoutIdentityFromReport, savedScoutIdentityKey } from "../shared/savedScoutIdentity";

const reportFor = (platform: "chesscom" | "lichess", formats: string[] = ["rapid", "blitz", "bullet"]) => ({
  reportSnapshot: {
    activeRequest: {
      platform,
      normalizedUsername: "same-name",
      displayUsername: "Same-Name",
      formats,
      mode: "standard",
      maxGames: 30,
      schemaVersion: "launch-3",
      requestedAt: "2026-09-07T00:00:00.000Z",
    },
  },
});

describe("saved Matchup Prep identity", () => {
  it("keeps same-named Chess.com and Lichess reports distinct", () => {
    const chesscom = savedScoutIdentityFromReport(reportFor("chesscom"));
    const lichess = savedScoutIdentityFromReport(reportFor("lichess"));
    expect(chesscom).not.toBeNull();
    expect(lichess).not.toBeNull();
    expect(savedScoutIdentityKey(chesscom!)).not.toBe(savedScoutIdentityKey(lichess!));
  });

  it("distinguishes reports with the same provider and player but different format sets", () => {
    const all = savedScoutIdentityFromReport(reportFor("chesscom"));
    const rapid = savedScoutIdentityFromReport(reportFor("chesscom", ["rapid"]));
    expect(savedScoutIdentityKey(all!)).not.toBe(savedScoutIdentityKey(rapid!));
  });

  it("rejects incomplete legacy saved payloads rather than guessing their provenance", () => {
    expect(savedScoutIdentityFromReport({ opponent: { username: "same-name" } })).toBeNull();
    expect(savedScoutIdentityFromReport({ reportSnapshot: { activeRequest: { platform: "chesscom", normalizedUsername: "same-name" } } })).toBeNull();
  });
});
