import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/clubBattles.ts"), "utf8");

describe("club battle duplicate-entry safety", () => {
  it("narrows unknown database failures before idempotent import handling", () => {
    expect(source).toContain("function isDuplicateEntryError(error: unknown): boolean");
    expect(source).toContain("catch (err: unknown)");
    expect(source).toContain("if (isDuplicateEntryError(err))");
    expect(source).not.toContain("catch (err: any)");
  });
});
