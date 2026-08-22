import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, sanitizeLogValue } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("structured server logger", () => {
  it("emits parseable structured JSON with a stable event name", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("billing_checkout_failed", { status: 502, requestId: "req-123" });

    const record = JSON.parse(String(output.mock.calls[0][0]));
    expect(record).toMatchObject({
      level: "error",
      event: "billing_checkout_failed",
      status: 502,
      requestId: "req-123",
    });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("redacts secrets, credentials, bearer tokens, and email addresses", () => {
    const sanitized = sanitizeLogValue({
      email: "player@example.com",
      password: "never-log-this",
      authorization: "Bearer abc.def.ghi",
      nested: { apiKey: "secret-key" },
      error: new Error("Failed for player@example.com"),
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("player@example.com");
    expect(serialized).not.toContain("never-log-this");
    expect(serialized).not.toContain("abc.def.ghi");
    expect(serialized).not.toContain("secret-key");
    expect(serialized).toContain("[REDACTED]");
  });

  it("redacts secret assignments embedded in free-text client errors", () => {
    const sanitized = String(sanitizeLogValue(
      "Failed player@example.com Bearer abc.secret password=hunter2 token:session-value api_key=key-123",
    ));

    expect(sanitized).not.toContain("player@example.com");
    expect(sanitized).not.toContain("abc.secret");
    expect(sanitized).not.toContain("hunter2");
    expect(sanitized).not.toContain("session-value");
    expect(sanitized).not.toContain("key-123");
    expect(sanitized).toContain("password=[REDACTED]");
  });

  it("normalizes existing bracket-prefixed calls without breaking them", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logger.warn("[db] Query error:", new Error("connection failed"));

    const record = JSON.parse(String(output.mock.calls[0][0]));
    expect(record.event).toBe("db_query_error");
    expect(record.details[0]).toMatchObject({ name: "Error", message: "connection failed" });
  });
});
