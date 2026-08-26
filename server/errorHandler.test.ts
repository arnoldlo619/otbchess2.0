import { describe, expect, it, vi } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequestId, globalErrorHandler, requestCorrelation } from "./errorHandler";
import { logger } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("global Express error handler", () => {
  it("returns safe retryable copy and the request correlation ID", () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
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

  it("logs failed request completion with the same response correlation ID", () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const listeners = new Map<string, () => void>();
    const request = { method: "GET", path: "/api/example" };
    const response = {
      statusCode: 503,
      setHeader: vi.fn(),
      once: vi.fn((event: string, handler: () => void) => listeners.set(event, handler)),
    };
    const next = vi.fn();

    requestCorrelation(request as never, response as never, next);
    listeners.get("finish")?.();

    const requestId = getRequestId(request as never);
    expect(requestId).toHaveLength(10);
    expect(response.setHeader).toHaveBeenCalledWith("X-Request-ID", requestId);
    expect(log).toHaveBeenCalledWith("http_request_failed", expect.objectContaining({
      requestId,
      method: "GET",
      path: "/api/example",
      status: 503,
    }));
  });

  it("adds only a rounded application-duration timing header to public reads", () => {
    const listeners = new Map<string, () => void>();
    const setHeader = vi.fn();
    const end = vi.fn();
    const request = { method: "GET", path: "/api/clubs" };
    const response = {
      headersSent: false,
      statusCode: 200,
      setHeader,
      once: vi.fn((event: string, handler: () => void) => listeners.set(event, handler)),
      end,
    };

    requestCorrelation(request as never, response as never, vi.fn());
    (response.end as () => void)();

    expect(setHeader).toHaveBeenCalledWith("Server-Timing", expect.stringMatching(/^app;dur=\d+(\.\d)?$/));
    expect(setHeader.mock.calls.flat().join(" ")).not.toContain("/api/clubs");
  });

  it("does not add server timing to mutations", () => {
    const setHeader = vi.fn();
    const request = { method: "POST", path: "/api/clubs" };
    const response = {
      headersSent: false,
      statusCode: 201,
      setHeader,
      once: vi.fn(),
      end: vi.fn(),
    };

    requestCorrelation(request as never, response as never, vi.fn());
    (response.end as () => void)();

    expect(setHeader).not.toHaveBeenCalledWith("Server-Timing", expect.any(String));
  });
});
