import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/clubInvites.ts"), "utf8");

describe("club invitation authentication contract", () => {
  it("uses the shared middleware userId field for invite creation and acceptance", () => {
    expect(source).toContain("type AuthenticatedRequest = Request & { userId?: string }");
    expect(source).toContain("return req.userId ?? null");
    expect(source).toContain("const userId = authenticatedUserId(req);");
    expect(source).not.toContain("(req as any).user?.id");
  });
});
