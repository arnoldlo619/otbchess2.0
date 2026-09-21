import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChesscom } from "./chesscom.js";
import { buildReport } from "../prep/buildReport.js";

const LEGAL_PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 1-0";

afterEach(() => vi.unstubAllGlobals());

describe("fetchChesscom bounded archive collection", () => {
  it("parses newest archive games in 60-game batches and stops once the 30-game target is satisfied", async () => {
    const games = Array.from({ length: 180 }, (_, index) => ({
      url: `https://www.chess.com/game/live/${index}`,
      rated: true,
      rules: "chess",
      time_class: "blitz",
      end_time: 1_700_000_000 + index,
      white: { username: "Hikaru", rating: 3000, result: "win" },
      black: { username: "Opponent", rating: 2500, result: "resigned" },
      pgn: LEGAL_PGN,
    }));
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith("/games/archives")
        ? { archives: ["https://api.chess.com/pub/player/hikaru/games/2026/09"] }
        : { games },
    ), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchChesscom("hikaru", {
      maxGames: 30,
      months: 24,
      timeClasses: ["rapid", "blitz", "bullet"],
      ratedOnly: true,
      deadlineAt: Date.now() + 10_000,
    });

    expect(result).toHaveLength(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("backfills past 120 ineligible recent games so a valid account still yields a Standard report", async () => {
    const ineligibleRecentGames = Array.from({ length: 120 }, (_, index) => ({
      url: `https://www.chess.com/game/live/ineligible-${index}`,
      rated: true,
      rules: "chess",
      time_class: "daily",
      end_time: 1_700_000_000 + index,
      white: { username: "humblelowkey", rating: 1400, result: "win" },
      black: { username: "Opponent", rating: 1400, result: "resigned" },
      pgn: LEGAL_PGN,
    }));
    const olderEligibleGames = Array.from({ length: 30 }, (_, index) => ({
      url: `https://www.chess.com/game/live/eligible-${index}`,
      rated: true,
      rules: "chess",
      time_class: "blitz",
      end_time: 1_699_000_000 + index,
      white: { username: "humblelowkey", rating: 1400, result: "win" },
      black: { username: "Opponent", rating: 1400, result: "resigned" },
      pgn: LEGAL_PGN,
    }));
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith("/games/archives")
        ? { archives: ["https://api.chess.com/pub/player/humblelowkey/games/2026/08", "https://api.chess.com/pub/player/humblelowkey/games/2026/09"] }
        : url.endsWith("/2026/09")
          ? { games: ineligibleRecentGames }
          : { games: olderEligibleGames },
    ), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const options = {
      maxGames: 30,
      months: 24,
      timeClasses: ["rapid", "blitz", "bullet"],
      ratedOnly: true,
      deadlineAt: Date.now() + 10_000,
    };
    const result = await fetchChesscom("humblelowkey", options);
    const report = buildReport("chesscom", "humblelowkey", result, options);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(report.dataQuality.parsed).toBe(30);
    expect(report.dataQuality.excluded.time_class_daily).toBe(120);
  });
});
