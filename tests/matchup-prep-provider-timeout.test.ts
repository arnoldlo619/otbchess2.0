import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../server/services/chesscom";

describe("Matchup Prep Chess.com provider timeout", () => {
  it("turns a stalled provider request into a bounded recoverable error", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<never>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchWithRetry("https://example.test", {}, 1, 1)).rejects.toThrow("UpstreamTimeout: chess.com");
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
