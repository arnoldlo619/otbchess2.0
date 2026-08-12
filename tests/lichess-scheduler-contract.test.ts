import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLichessRateLimitState,
  resetLichessSchedulerForTests,
  scheduleLichessRequest,
} from "../server/services/lichess";

afterEach(() => {
  vi.unstubAllGlobals();
  resetLichessSchedulerForTests();
});

describe("shared Lichess scheduler", () => {
  it("serializes concurrent provider and enrichment requests", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      return new Response("{}", { status: 200 });
    }));
    await Promise.all([
      scheduleLichessRequest("https://lichess.org/api/games/user/a"),
      scheduleLichessRequest("https://lichess.org/game/export/MPJcy1JW"),
    ]);
    expect(maxActive).toBe(1);
  });

  it("sets a shared cooldown after 429 and rejects a second request locally", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "0" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(scheduleLichessRequest("https://lichess.org/game/export/MPJcy1JW")).rejects.toThrow("LichessRateLimited");
    expect(getLichessRateLimitState().cooldownUntil).not.toBeNull();
    await expect(scheduleLichessRequest("https://lichess.org/api/games/user/a")).rejects.toThrow("LichessRateLimited");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal to every bounded upstream request", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Response("{}", { status: 200 });
    }));
    await scheduleLichessRequest("https://lichess.org/game/export/MPJcy1JW", {}, 1_234);
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
