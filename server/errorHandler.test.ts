import { describe, expect, it, vi } from "vitest";
import { globalErrorHandler } from "./errorHandler";

describe("global Express error handler", () => {
  it("returns safe retryable copy and the request correlation ID", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { headersSent: false, status, json };
    const request = { requestId: "req-test-123" };

    globalErrorHandler(
      new Error("database password leaked internally"),
      request as never,
      response as never,
      vi.fn(),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: "Internal server error",
      message: "We couldn’t complete that request. Please try again.",
      code: "INTERNAL_SERVER_ERROR",
      requestId: "req-test-123",
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain("database password");
  });
});

