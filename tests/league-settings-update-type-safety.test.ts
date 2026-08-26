import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league settings update typing", () => {
  it("uses the schema-derived insert shape while retaining field validation", () => {
    expect(source).toContain("const updateData: Partial<typeof leagues.$inferInsert> = {};");
    expect(source).toContain("await db.update(leagues).set(updateData)");
    expect(source).toContain("const allowed = [\"round_robin\", \"swiss\", \"double_round_robin\"];");
    expect(source).not.toContain("set(updateData as any)");
  });
});
