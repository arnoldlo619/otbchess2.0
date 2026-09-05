import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../server/services/chesscom";

afterEach(() => vi.unstubAllGlobals());

describe("Matchup Prep Chess.com provider timeout", () => {
  it("turns a stalled provider request into a bounded recoverable error", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<never>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchWithRetry("https://example.test", {}, 1, 1)).rejects.toThrow("UpstreamTimeout: chess.com");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a typed rate-limit failure after one bounded retry", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithRetry("https://example.test", {}, 2, 10)).rejects.toThrow("UpstreamRateLimited: chess.com");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops before a provider call when the browser has cancelled the scout request", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithRetry("https://example.test", {}, 2, 10, controller.signal)).rejects.toThrow("RequestCancelled: chess.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
