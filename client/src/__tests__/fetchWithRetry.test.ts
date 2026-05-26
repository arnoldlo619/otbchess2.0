/**
 * fetchWithRetry — unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authFetch
const mockAuthFetch = vi.fn();
vi.mock("@/lib/apiFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));

import { fetchWithRetry } from "@/lib/fetchWithRetry";

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAuthFetch.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on 200 OK", async () => {
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200 });
    const res = await fetchWithRetry("/api/test");
    expect(res.ok).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  });

  it("returns immediately on 4xx without retrying", async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 404 });
    const res = await fetchWithRetry("/api/test", undefined, { maxRetries: 2 });
    expect(res.status).toBe(404);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 and succeeds on second attempt", async () => {
    mockAuthFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const promise = fetchWithRetry("/api/test", undefined, { maxRetries: 2, baseDelay: 100 });
    // Advance past the first retry delay
    await vi.advanceTimersByTimeAsync(150);
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on network error and throws after max retries", async () => {
    mockAuthFetch.mockRejectedValue(new Error("Network failure"));

    const promise = fetchWithRetry("/api/test", undefined, { maxRetries: 1, baseDelay: 50 });
    // Catch to prevent unhandled rejection warning
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).rejects.toThrow("Network failure");
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("returns the failed response on last attempt for 5xx", async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 503 });

    const promise = fetchWithRetry("/api/test", undefined, { maxRetries: 1, baseDelay: 50 });
    await vi.advanceTimersByTimeAsync(200);
    const res = await promise;
    expect(res.status).toBe(503);
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });
});
