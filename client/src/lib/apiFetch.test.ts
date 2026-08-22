import { describe, expect, it } from "vitest";
import { ApiError, createApiError, toApiError } from "./apiFetch";

describe("API error presentation", () => {
  it("normalizes the global Express error payload without exposing internal copy", () => {
    const error = createApiError(
      { status: 500 },
      {
        error: "Internal server error",
        message: "We couldn’t complete that request. Please try again.",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "req-abc123",
      },
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("We couldn’t complete that request. Please try again.");
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.requestId).toBe("req-abc123");
    expect(error.retryable).toBe(true);
  });

  it("replaces a bare internal-server-error string with user-safe copy", () => {
    const error = createApiError({ status: 500 }, { error: "Internal server error" });
    expect(error.message).toBe("We couldn’t complete that request. Please try again.");
  });

  it("preserves actionable validation messages for non-server errors", () => {
    const error = createApiError({ status: 400 }, { error: "Display name is required", code: "VALIDATION_ERROR" });
    expect(error.message).toBe("Display name is required");
    expect(error.retryable).toBe(false);
  });

  it("maps fetch network failures to a retryable connection message", () => {
    const error = toApiError(new TypeError("Failed to fetch"));
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("reach ChessOTB");
  });
});

