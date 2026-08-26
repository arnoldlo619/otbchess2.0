import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league week finalization typing", () => {
  it("uses the inferred database type while retaining completion and advancement rules", () => {
    expect(source).toContain("type Database = Awaited<ReturnType<typeof getDb>>;");
    expect(source).toContain("async function finalizeWeekIfComplete(db: Database");
    expect(source).toContain("match.id === justCompletedMatchId || match.resultStatus === \"completed\"");
    expect(source).not.toContain("finalizeWeekIfComplete(db: any");
  });
});
