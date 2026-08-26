import { describe, expect, it } from "vitest";

import { loadChesscomFixture } from "./chesscom.js";

describe("loadChesscomFixture", () => {
  it("normalizes a complete Chess.com game payload", () => {
    const [game] = loadChesscomFixture([{
      url: "https://www.chess.com/game/live/123",
      rated: true,
      rules: "chess",
      time_class: "rapid",
      end_time: 1_700_000_000,
      white: { username: "White", rating: 1800, result: "win" },
      black: { username: "Black", rating: 1750, result: "resigned" },
      pgn: "1. e4 e5 2. Nf3 Nc6 1-0",
    }]);

    expect(game).toMatchObject({
      provider: "chesscom",
      url: "https://www.chess.com/game/live/123",
      rated: true,
      timeClass: "rapid",
      result: "1-0",
      white: { name: "White", rating: 1800, result: "win" },
      black: { name: "Black", rating: 1750, result: "resigned" },
    });
    expect(game.sans).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("uses safe defaults for malformed provider values without throwing", () => {
    const [game] = loadChesscomFixture([{
      url: 42,
      rated: "yes",
      rules: null,
      time_class: {},
      end_time: "later",
      white: "not-a-player",
      black: { username: 9, rating: "strong", result: null },
      pgn: [],
    }]);

    expect(game).toMatchObject({
      provider: "chesscom",
      url: "",
      rated: false,
      rules: "chess",
      timeClass: "unknown",
      endTime: 0,
      white: { name: "?", rating: null, result: "?" },
      black: { name: "?", rating: null, result: "?" },
      result: "*",
      sans: [],
    });
  });
});
