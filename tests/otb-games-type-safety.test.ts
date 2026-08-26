import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/otbGames.ts"), "utf8");

describe("OTB game service type safety", () => {
  it("uses typed authenticated request bodies and unknown-safe error boundaries", () => {
    expect(source).toContain("type AuthenticatedRequest<TBody =");
    expect(source).toContain("function authenticatedUserId<TBody>");
    expect(source).not.toContain("req: any");
    expect(source).not.toContain("catch (err: any)");
    expect(source).toContain("catch (err: unknown)");
  });

  it("uses schema-derived records for result submissions and session status updates", () => {
    expect(source).toContain("Array<typeof gameResultSubmissions.$inferSelect>");
    expect(source).toContain('Pick<typeof gameSessions.$inferInsert, "status" | "updatedAt" | "activeClockDeviceId">');
  });
});
