import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  canonicalPosition,
  classifyArchiveSpeed,
  intersectArchiveCatalogs,
  ratingBandForAverage,
  shouldShowPopulationComparison,
} from "../server/population/foundation";

describe("population foundation contract", () => {
  it("derives stable EPD-compatible keys without move counters", () => {
    const start = new Chess();
    const e4 = new Chess();
    e4.move("e4");
    expect(canonicalPosition(start.fen()).key).not.toBe(canonicalPosition(e4.fen()).key);
    expect(canonicalPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 18 99").key)
      .toBe(canonicalPosition(start.fen()).key);
  });

  it("uses exact public speed and rating-band boundaries", () => {
    expect(classifyArchiveSpeed(29)).toBe("excluded");
    expect(classifyArchiveSpeed(30)).toBe("bullet");
    expect(classifyArchiveSpeed(179)).toBe("bullet");
    expect(classifyArchiveSpeed(180)).toBe("blitz");
    expect(classifyArchiveSpeed(480)).toBe("rapid");
    expect(classifyArchiveSpeed(1500)).toBe("excluded");
    expect(ratingBandForAverage(999)).toBe(0);
    expect(ratingBandForAverage(1000)).toBe(1000);
    expect(ratingBandForAverage(1599)).toBe(1400);
    expect(ratingBandForAverage(1600)).toBe(1600);
    expect(ratingBandForAverage(2500)).toBe(2500);
  });

  it("accepts only the validated catalog and checksum intersection", () => {
    const file = "lichess_db_standard_rated_2026-07.pgn.zst";
    const sha = "a".repeat(64);
    const validUrl = `https://database.lichess.org/standard/${file}`;
    expect(intersectArchiveCatalogs(`${validUrl}\nhttps://evil.example/${file}`, `${sha}  ${file}\n`)).toEqual([
      { filename: file, month: "2026-07", url: validUrl, expectedSha256: sha },
    ]);
    expect(intersectArchiveCatalogs(`http://database.lichess.org/standard/${file}`, `${sha}  ${file}`)).toEqual([]);
    expect(intersectArchiveCatalogs(validUrl, `A${"a".repeat(63)}  ${file}`)).toEqual([]);
  });

  it("never lets population counts rescue insufficient opponent evidence", () => {
    expect(shouldShowPopulationComparison({ opponentReached: 7, opponentMoveCount: 7, populationTotal: 10_000, complete: true })).toBe(false);
    expect(shouldShowPopulationComparison({ opponentReached: 8, opponentMoveCount: 6, populationTotal: 99, complete: true })).toBe(false);
    expect(shouldShowPopulationComparison({ opponentReached: 8, opponentMoveCount: 6, populationTotal: 1_000, complete: true })).toBe(true);
  });
});
