import { afterEach, describe, expect, it, vi } from "vitest";

import { buildReport } from "../server/prep/buildReport.js";
import { fetchChesscom } from "../server/services/chesscom.js";
import { fetchLichess, resetLichessSchedulerForTests } from "../server/services/lichess.js";
import { LEGAL_LAUNCH_LINES } from "../server/prep/__fixtures__/launchFixtures.js";
import { SCOUT_MAX_GAMES, SCOUT_PROVIDER_PAGE_SIZE } from "../shared/scoutRequest.js";

const options = { maxGames: SCOUT_MAX_GAMES, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true };

function lichessGame(index: number, eligible: boolean) {
  return {
    id: String(10_000_000 + index),
    winner: "white",
    status: "mate",
    variant: "standard",
    speed: "rapid",
    rated: true,
    lastMoveAt: Date.now() - index * 60_000,
    moves: eligible ? LEGAL_LAUNCH_LINES.ruyLopez.join(" ") : "e4 e5",
    players: {
      white: { user: { name: "backfillplayer" }, rating: 1800 },
      black: { user: { name: `opponent-${index}` }, rating: 1750 },
    },
  };
}

function numberedPgn(sans: readonly string[]): string {
  const pairs: string[] = [];
  for (let index = 0; index < sans.length; index += 2) {
    pairs.push(`${index / 2 + 1}. ${sans[index]}${sans[index + 1] ? ` ${sans[index + 1]}` : ""}`);
  }
  return `${pairs.join(" ")} 1-0`;
}

function chesscomGame(index: number, eligible: boolean) {
  return {
    url: `https://www.chess.com/game/live/${20_000 + index}`,
    rated: true,
    rules: "chess",
    time_class: "rapid",
    end_time: Math.floor(Date.now() / 1000) - index * 60,
    white: { username: "backfillplayer", rating: 1800, result: "win" },
    black: { username: `opponent-${index}`, rating: 1750, result: "resigned" },
    pgn: numberedPgn(eligible ? LEGAL_LAUNCH_LINES.ruyLopez : ["e4", "e5"]),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetLichessSchedulerForTests();
});

describe("Matchup Prep Standard provider backfill", () => {
  it("uses bounded provider pages while continuing until the eligible target or history exhaustion", () => {
    expect(SCOUT_PROVIDER_PAGE_SIZE).toBe(100);
  });

  it("Lichess paginates past 130 filtered recent games and selects the next 30 eligible games", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => lichessGame(index, false));
    const secondPage = [
      ...Array.from({ length: 30 }, (_, index) => lichessGame(index + 100, false)),
      ...Array.from({ length: 30 }, (_, index) => lichessGame(index + 130, true)),
    ];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain("max=100");
      const page = url.includes("until=") ? secondPage : firstPage;
      return new Response(page.map(game => JSON.stringify(game)).join("\n"), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const raw = await fetchLichess("backfillplayer", options);
    const report = buildReport("lichess", "backfillplayer", raw, options, "black");

    expect(raw).toHaveLength(160);
    expect(report.dataQuality.parsed).toBe(30);
    expect(report.dataQuality.excluded.too_short_or_abandoned).toBe(130);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Chess.com walks older archives past 140 filtered games and stops after finding 30 eligible games", async () => {
    const archives = ["https://api.chess.test/oldest", "https://api.chess.test/eligible", "https://api.chess.test/filtered-two", "https://api.chess.test/filtered-one"];
    const responses: Record<string, unknown> = {
      "https://api.chess.test/filtered-one": { games: Array.from({ length: 70 }, (_, index) => chesscomGame(index, false)) },
      "https://api.chess.test/filtered-two": { games: Array.from({ length: 70 }, (_, index) => chesscomGame(index + 70, false)) },
      "https://api.chess.test/eligible": { games: Array.from({ length: 30 }, (_, index) => chesscomGame(index + 140, true)) },
      "https://api.chess.test/oldest": { games: Array.from({ length: 30 }, (_, index) => chesscomGame(index + 170, true)) },
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/games/archives")) return Response.json({ archives });
      return Response.json(responses[url] ?? { games: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const raw = await fetchChesscom("backfillplayer", options);
    const report = buildReport("chesscom", "backfillplayer", raw, options, "black");

    expect(raw).toHaveLength(170);
    expect(report.dataQuality.parsed).toBe(30);
    expect(report.dataQuality.excluded.too_short_or_abandoned).toBe(140);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.flat().join(" ")).not.toContain("https://api.chess.test/oldest");
  });
});
