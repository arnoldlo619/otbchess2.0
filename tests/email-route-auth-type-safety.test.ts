import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/email.ts"), "utf8");

describe("SMTP route authentication and typing", () => {
  it("wraps every full-auth SMTP route with the shared userId request contract", () => {
    expect(source).toContain("type AuthenticatedRequest = Request & { userId: string };");
    expect(source).toContain("function withAuthenticatedUser(");
    expect(source.match(/requireFullAuth, withAuthenticatedUser\(async \(req, res\)/g)).toHaveLength(4);
    expect(source).not.toContain("req: any, res: any");
  });

  it("retains user-scoped SMTP configuration and unknown-safe delivery errors", () => {
    expect(source).toContain("eq(directorSmtpConfig.userId, req.userId)");
    expect(source).toContain("errorMessage(err, \"SMTP connection failed\")");
    expect(source).toContain("errorMessage(err, \"Email delivery failed\")");
  });
});
