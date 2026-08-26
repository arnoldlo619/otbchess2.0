import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/clubs.ts"), "utf8");

describe("club route authentication and input typing", () => {
  it("uses the shared userId helper for club event, feed, RSVP, payment, and check-in actions", () => {
    expect(source).toContain("function getUserId(req: Request, res: Response): string | null");
    expect(source).toContain("const userId = (req as Request & { userId?: string }).userId;");
    expect(source.match(/const userId = getUserId\(req, res\);/g)?.length).toBeGreaterThanOrEqual(9);
    expect(source).not.toContain("(req as any).userId");
  });

  it("uses schema-derived request inputs for club content and season creation", () => {
    expect(source).toContain("req.body as typeof clubEvents.$inferInsert");
    expect(source).toContain("req.body as typeof clubFeed.$inferInsert");
    expect(source).toContain("req.body as typeof clubSeasons.$inferInsert");
    expect(source).toContain("req.body as typeof clubAnnouncements.$inferInsert");
    expect(source).not.toContain("req.body as any");
  });
});
