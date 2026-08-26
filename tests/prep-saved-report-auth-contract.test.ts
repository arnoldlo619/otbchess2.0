import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/prepRoutes.ts"), "utf8");

describe("saved preparation report authentication contract", () => {
  it("uses the userId established by requireAuth for every saved-report CRUD route", () => {
    expect(source).toContain("type AuthenticatedRequest = Request & { userId: string };");
    expect(source.match(/withAuthenticatedUser\(async \(req, res\)/g)).toHaveLength(5);
    expect(source).toContain("router.post(\"/saved\", requireAuth");
    expect(source).toContain("router.get(\"/saved\", requireAuth");
    expect(source).toContain("router.get(\"/saved/:id\", requireAuth");
    expect(source).toContain("router.delete(\"/saved/:id\", requireAuth");
    expect(source).not.toContain("req.user?.id");
  });

  it("keeps the prep limiter, saved-report insert ID, and coach insight route typed", () => {
    expect(source).toContain("keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? \"\")");
    expect(source).toContain("res.json({ id: result.insertId, updated: false });");
    expect(source).toContain("router.post(\"/coach-insight\", requireAuth");
    expect(source).not.toContain("req: any");
    expect(source).not.toContain("result as any");
  });
});
