import { describe, expect, it } from "vitest";
import {
  buildPopulationExplorerUrl,
  resolvePopulationSource,
  validatePopulationExplorerResponse,
} from "../server/population/explorer";

describe("official population Explorer contract", () => {
  const query = {
    uciPath: ["e2e4", "c7c5"],
    speeds: ["blitz", "rapid"] as const,
    ratingBand: 1400,
    since: "2026-01",
    until: "2026-03",
  };

  it("serializes only official, legal, bounded Lichess population parameters", () => {
    const url = new URL(buildPopulationExplorerUrl(query));
    expect(url.origin).toBe("https://explorer.lichess.org");
    expect(url.pathname).toBe("/lichess");
    expect(url.searchParams.get("variant")).toBe("standard");
    expect(url.searchParams.get("speeds")).toBe("blitz,rapid");
    expect(url.searchParams.get("ratings")).toBe("1400");
    expect(url.searchParams.get("play")).toBe("e2e4,c7c5");
    expect(url.searchParams.get("topGames")).toBe("0");
    expect(() => buildPopulationExplorerUrl({ ...query, uciPath: ["e4"] })).toThrow(/UCI/i);
    expect(() => buildPopulationExplorerUrl({ ...query, ratingBand: 1500 })).toThrow(/rating/i);
  });

  it("rejects malformed and illegal upstream rows without retaining game references", () => {
    const parsed = validatePopulationExplorerResponse(query, {
      opening: null,
      white: 80,
      draws: 10,
      black: 10,
      moves: [{ uci: "g1f3", san: "Nf3", averageRating: 1450, white: 40, draws: 5, black: 5, game: { id: "must-not-leak" }, opening: null }],
      topGames: [{ id: "must-not-leak" }],
    });
    expect(parsed.positionTotal).toBe(100n);
    expect(parsed.moves[0]).toMatchObject({ uci: "g1f3", count: 50n });
    expect(parsed.moves[0]).not.toHaveProperty("game");
    expect(parsed.moves[0]).not.toHaveProperty("id");
    expect(() => validatePopulationExplorerResponse(query, { white: -1, draws: 0, black: 0, moves: [], topGames: [] })).toThrow(/count/i);
    expect(() => validatePopulationExplorerResponse(query, { white: 1, draws: 0, black: 0, moves: [{ uci: "a1a8", san: "x", averageRating: 0, white: 1, draws: 0, black: 0 }], topGames: [] })).toThrow(/illegal/i);
  });

  it("uses local exact coverage without merging it with upstream data", () => {
    expect(resolvePopulationSource({ local: { complete: true, total: 1_000n }, upstream: { total: 5_000n } })).toEqual({ source: "local", total: 1_000n });
    expect(resolvePopulationSource({ local: { complete: false, total: 1_000n }, upstream: { total: 5_000n } })).toEqual({ source: "upstream", total: 5_000n });
    expect(resolvePopulationSource({ local: null, upstream: null })).toEqual({ source: "unavailable" });
  });
});
