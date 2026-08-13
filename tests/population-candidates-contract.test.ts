import { describe, expect, it } from "vitest";
import type { RawGame } from "../shared/prepTypes";
import { derivePopulationCandidates } from "../server/population/candidates";

function game(id: number, blackMoves = "cxd4"): RawGame {
  return {
    provider: "lichess", url: `https://lichess.org/abcd${String(id).padStart(4, "0")}`.slice(0, 27), rated: true, rules: "chess", timeClass: "blitz", endTime: 1_700_000_000 + id,
    white: { name: "white-player", rating: 1500, result: "lost" }, black: { name: "opponent", rating: 1500, result: "win" }, result: "0-1",
    sans: blackMoves === "cxd4"
      ? ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
      : ["e4", "c5", "Nf3", "d6", "d4", "Nf6", "Nc3", "a6", "Bc4", "e6"],
  };
}

describe("population candidate evidence contract", () => {
  it("uses the full eligible player reach count, not population volume or discovery order", () => {
    const raw = [...Array.from({ length: 8 }, (_, index) => game(index)), game(9, "e6")];
    const [candidate] = derivePopulationCandidates(raw, "opponent", { maxGames: 20, months: 6, timeClasses: ["blitz"], ratedOnly: true });
    expect(candidate).toMatchObject({ opponentColor: "black", opponentMoveSan: "cxd4", opponentCount: 8, opponentDenominator: 9, ratingBand: 1400 });
  });
});
