import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Matchup Prep remembered report cache", () => {
  it("checks the immutable in-memory report cache before database and provider rebuilding", () => {
    const source = readFileSync(resolve(process.cwd(), "server/prepRoutes.ts"), "utf8");
    const remembered = source.indexOf("const remembered = readRememberedPrepAnalysisReport(cacheKey)");
    const database = source.indexOf("const db = await getDb()", remembered);
    const provider = source.indexOf("await fetchChesscom(normalised, fetchOpts)", remembered);
    expect(remembered).toBeGreaterThan(-1);
    expect(database).toBeGreaterThan(remembered);
    expect(provider).toBeGreaterThan(remembered);
  });
});
