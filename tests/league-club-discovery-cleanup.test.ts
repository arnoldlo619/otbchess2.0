import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league discovery cleanup", () => {
  it("retains explicit eligible-club iteration without an unused bulk club lookup", () => {
    expect(source).toContain("for (const cid of clubIds)");
    expect(source).toContain("// Fetch leagues per eligible club to keep the authorization filter explicit.");
    expect(source).not.toContain("const clubRows = await db");
    expect(source).not.toContain("prepCache,");
  });
});
