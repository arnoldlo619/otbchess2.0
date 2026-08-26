import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league Chess.com rating response typing", () => {
  it("uses a narrow stats shape while preserving rapid-to-daily rating precedence", () => {
    expect(source).toContain("type ChessComRatingStats = Record<string, { last?: { rating?: number } } | undefined>");
    expect(source).toContain("const stats = await statsRes.json() as ChessComRatingStats;");
    expect(source).toContain("const rating = rapid ?? blitz ?? bullet ?? daily ?? null;");
    expect(source).not.toContain("statsRes.json() as Record<string, any>");
  });
});
