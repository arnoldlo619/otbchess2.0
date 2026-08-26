import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/email.ts"), "utf8");

describe("SMTP error safety", () => {
  it("uses a guarded fallback message for every delivery error response", () => {
    expect(source).toContain("function errorMessage(error: unknown, fallback: string)");
    expect(source).not.toContain("catch (err: any)");
    expect(source).not.toContain("err.message");
    expect(source).toContain('errorMessage(err, "SMTP connection failed")');
    expect(source).toContain('errorMessage(err, "Email delivery failed")');
    expect(source).toContain('errorMessage(err, "Failed to send emails")');
  });
});
