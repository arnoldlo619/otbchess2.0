import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHESS_COM_RATING,
  extractChessComRatings,
  resolveChessComRating,
} from "../lib/chessComPlayerPayload.js";

describe("Chess.com rating resolver", () => {
  it("extracts the provider's four current rating categories", () => {
    expect(extractChessComRatings({
      chess_rapid: { last: { rating: 2100 } },
      chess_blitz: { last: { rating: 2200 } },
      chess_bullet: { last: { rating: 2300 } },
      chess_daily: { last: { rating: 1800 } },
    })).toEqual({ rapid: 2100, blitz: 2200, bullet: 2300, daily: 1800 });
  });

  it("normalizes missing, malformed, zero, negative, and non-finite ratings", () => {
    expect(extractChessComRatings({
      chess_rapid: { last: { rating: "2100" } },
      chess_blitz: { last: { rating: 0 } },
      chess_bullet: { last: { rating: -1 } },
      chess_daily: { last: { rating: Number.POSITIVE_INFINITY } },
    })).toEqual({ rapid: 0, blitz: 0, bullet: 0, daily: 0 });

    expect(extractChessComRatings(null)).toEqual({ rapid: 0, blitz: 0, bullet: 0, daily: 0 });
  });

  it("uses rapid → blitz → bullet → daily → 1200 for the default tournament rating", () => {
    expect(resolveChessComRating({ rapid: 2000, blitz: 2100, bullet: 2200, daily: 1800 })).toBe(2000);
    expect(resolveChessComRating({ rapid: 0, blitz: 2100, bullet: 2200, daily: 1800 })).toBe(2100);
    expect(resolveChessComRating({ rapid: 0, blitz: 0, bullet: 2200, daily: 1800 })).toBe(2200);
    expect(resolveChessComRating({ rapid: 0, blitz: 0, bullet: 0, daily: 1800 })).toBe(1800);
    expect(resolveChessComRating({ rapid: 0, blitz: 0, bullet: 0, daily: 0 })).toBe(DEFAULT_CHESS_COM_RATING);
  });

  it("prefers blitz only for blitz tournaments, then retains the common fallback chain", () => {
    expect(resolveChessComRating({ rapid: 2000, blitz: 2100, bullet: 2200, daily: 1800 }, "blitz")).toBe(2100);
    expect(resolveChessComRating({ rapid: 2000, blitz: 0, bullet: 2200, daily: 1800 }, "blitz")).toBe(2000);
    expect(resolveChessComRating({ rapid: 0, blitz: 0, bullet: 2200, daily: 1800 }, "blitz")).toBe(2200);
    expect(resolveChessComRating({ rapid: 0, blitz: 0, bullet: 0, daily: 1800 }, "blitz")).toBe(1800);
  });
});
