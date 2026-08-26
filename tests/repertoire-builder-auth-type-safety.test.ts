import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/repertoireBuilder.ts"), "utf8");

describe("Repertoire Builder authenticated CRUD typing", () => {
  it("wraps protected CRUD handlers with a narrow userId request contract", () => {
    expect(source).toContain("type AuthenticatedRequest = Request & { userId: string };");
    expect(source).toContain("function withAuthenticatedUser(");
    expect(source).toContain("router.use(requireFullAuth);");
    expect(source.match(/withAuthenticatedUser\(async \(req, res\)/g)).toHaveLength(5);
    expect(source).not.toContain("async (req: any, res)");
  });

  it("retains ownership filters and the free-user repertoire limit", () => {
    expect(source).toContain("eq(repertoires.authorUserId, req.userId)");
    expect(source).toContain("FREE_REPERTOIRE_LIMIT");
    expect(source).toContain("code: \"PRO_REQUIRED\"");
  });
});
