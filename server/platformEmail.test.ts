import { describe, it, expect } from "vitest";
import { verifyPlatformSmtp } from "./platformEmail.js";

describe("Platform SMTP", () => {
  it("connects to the SMTP server with the configured credentials", async () => {
    // Resolves if credentials are valid and SMTP AUTH is enabled on the account.
    // Throws if credentials are wrong or SMTP AUTH is disabled in Microsoft 365 admin.
    await expect(verifyPlatformSmtp()).resolves.not.toThrow();
  }, 15000);
});
