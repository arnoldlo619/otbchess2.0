import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClientErrorPayload, reportClientError } from "./clientErrorReporter";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("client error reporter", () => {
  it("removes secrets, emails, tokens, and URL query data before delivery", () => {
    const error = new Error("Failed for player@example.com with Bearer abc.def_123 password=hunter2");
    error.stack = "Error token=secret-value at https://chessotb.club/profile?email=player@example.com";

    const payload = buildClientErrorPayload({
      eventType: "render_error",
      error,
      path: "https://chessotb.club/profile?email=player@example.com#accounts",
      referenceId: "UI-TEST-1",
    });

    expect(payload.path).toBe("/profile");
    expect(payload.message).not.toContain("player@example.com");
    expect(payload.message).not.toContain("abc.def_123");
    expect(payload.message).not.toContain("hunter2");
    expect(payload.stack).not.toContain("secret-value");
    expect(payload.message).toContain("[REDACTED");
  });

  it("sends bounded reports to the same-origin endpoint without credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/clubs/demo/home", origin: "https://chessotb.club" } });

    reportClientError({
      eventType: "api_error",
      message: "Unique delivery failure",
      status: 503,
      code: "INTERNAL_SERVER_ERROR",
      requestId: "REQ-123",
    });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/client-errors", expect.objectContaining({
      method: "POST",
      credentials: "omit",
      keepalive: true,
    }));
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      eventType: "api_error",
      path: "/clubs/demo/home",
      status: 503,
      requestId: "REQ-123",
    });
  });

  it("deduplicates identical reports in the short retry window", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { pathname: "/prep", origin: "https://chessotb.club" } });

    const report = { eventType: "unhandled_error" as const, message: "Unique duplicate candidate" };
    reportClientError(report);
    reportClientError(report);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
