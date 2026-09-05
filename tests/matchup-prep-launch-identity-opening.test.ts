import { describe, expect, it } from "vitest";

import {
  activeScoutRequestFromQuery,
  scoutRequestCacheKey,
  scoutRequestSearchParams,
} from "../shared/scoutRequest.js";
import { familiarOpeningNameFromMoves } from "../shared/simpleOpeningNames.js";
import { buildReport } from "../server/prep/buildReport.js";
import { makeLaunchGames } from "../server/prep/__fixtures__/launchFixtures.js";

describe("Matchup Prep launch identity and opening-label contracts", () => {
  it("ID-01/COLOR-03: keeps the legacy myColor URL parameter only as explorer-local state", () => {
    const request = activeScoutRequestFromQuery(
      "SamePlayer",
      new URLSearchParams("provider=lichess&tc=all&myColor=black"),
      "2026-09-05T00:00:00.000Z",
    );

    expect(request).toMatchObject({
      platform: "lichess",
      normalizedUsername: "sameplayer",
      formats: ["rapid", "blitz", "bullet"],
      mode: "standard",
      maxGames: 30,
      explorerColor: "black",
    });
    expect(request).not.toHaveProperty("myColor");
    expect(scoutRequestCacheKey(request)).toBe("v5:lichess:sameplayer:frapid+blitz+bullet:mstandard:g30:slaunch-3");
    expect(scoutRequestSearchParams(request).toString()).toBe("provider=lichess&tc=all&explorerColor=black");
  });

  it("OPEN-01: uses neutral legal-position labels when the visible prefix does not establish a named opening", () => {
    expect(familiarOpeningNameFromMoves("Queen's Pawn Opening", "D00", ["Nf3", "d5", "g3", "Nf6"])).toBe("Common position after 2...Nf6");
    expect(familiarOpeningNameFromMoves("Italian Game", "C50", ["e4", "e5", "Nf3", "d5"])).toBe("Common position after 2...d5");
    expect(familiarOpeningNameFromMoves("King's Pawn Opening", "C20", ["e4", "e5", "Bc4", "Bc5"])).toBe("Common position after 2...Bc5");
  });

  it("DATE-01/DATA-01: preserves UTC calendar dates and withholds practical actions below eight eligible games", () => {
    const options = { maxGames: 30, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true };
    const boundarySeconds = Math.floor(Date.parse("2026-01-01T00:30:00.000Z") / 1000);
    const boundaryGames = makeLaunchGames({ count: 8 }).map((game, index) => ({ ...game, endTime: boundarySeconds - index }));
    const boundaryReport = buildReport("chesscom", "sameplayer", boundaryGames, options);
    const limitedReport = buildReport("chesscom", "sameplayer", makeLaunchGames({ count: 7 }), options);

    expect(boundaryReport.dataQuality.window.to).toBe("2026-01-01");
    expect(limitedReport.scoutBrief).toEqual([]);
  });

  it("COLOR-03: keeps the global scout form free of player-color controls and confines them to Legal Line Explorer", async () => {
    const { readFile } = await import("node:fs/promises");
    const [pageSource, explorerSource] = await Promise.all([
      readFile("client/src/pages/MatchupPrep.tsx", "utf8"),
      readFile("client/src/components/prep/ForecastWalkthrough.tsx", "utf8"),
    ]);
    expect(pageSource).not.toContain("I’m playing");
    expect(pageSource).not.toContain('setMyColor(');
    expect(explorerSource).toContain("Your playing color in the Legal Line Explorer");
    expect(explorerSource).toContain('aria-pressed={playerColor === color}');
  });
});
