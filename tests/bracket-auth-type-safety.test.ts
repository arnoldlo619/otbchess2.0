import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/brackets.ts"), "utf8");

describe("bracket mutation authentication and typing", () => {
  it("wraps authenticated mutation routes with the shared userId contract", () => {
    expect(source).toContain("type AuthenticatedRequest = Request & { userId: string };");
    expect(source).toContain("function withAuthenticatedUser(");
    expect(source.match(/authMiddleware, withAuthenticatedUser\(async \(req, res\)/g)).toHaveLength(6);
    expect(source).not.toContain("(req as any).userId");
  });

  it("uses a schema-derived bracket update payload while retaining ownership enforcement", () => {
    expect(source).toContain("const updates: Partial<typeof bracketGroups.$inferInsert> = {};");
    expect(source).toContain("if (group.userId !== userId) return res.status(403).json({ error: \"Forbidden\" });");
    expect(source).not.toContain("Record<string, any>");
  });
});
