import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChesscom } from "./chesscom.js";

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
});
