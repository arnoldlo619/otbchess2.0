import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league push notification error safety", () => {
  it("narrows unknown provider failures before stale-subscription cleanup", () => {
    expect(source).toContain("function pushErrorDetails(error: unknown)");
    expect(source).toContain("catch (err: unknown)");
    expect(source).toContain("if (code === 410 || code === 404) staleIds.push(row.id);");
    expect(source).not.toContain("catch (err: any)");
  });
});
