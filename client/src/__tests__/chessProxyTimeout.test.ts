/**
 * Tests for chess.com proxy timeout and ELO extraction reliability.
 *
 * Root cause of the 80/100 "Not found" bug:
 *   - fetchWithRetryServer had no AbortSignal.timeout — requests to chess.com
 *     for certain usernames (especially those with underscores or numbers) would
 *     hang indefinitely, causing the client to show "Not found".
 *   - Fix: added AbortSignal.timeout(8000) to every fetch() call in the proxy chain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers replicated from server/index.ts for unit testing ────────────────

interface FetchWithRetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

async function fetchWithRetryServer(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 8000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 429 || res.status === 503) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

// ─── ELO extraction logic replicated from UploadRSVPModal ────────────────────

function extractElo(stats: Record<string, unknown>) {
  const rapidElo: number | undefined =
    (stats.chess_rapid as Record<string, unknown> | undefined)?.last
      ? ((stats.chess_rapid as Record<string, unknown>).last as Record<string, unknown>).rating as number
      : undefined;
  const blitzElo: number | undefined =
    (stats.chess_blitz as Record<string, unknown> | undefined)?.last
      ? ((stats.chess_blitz as Record<string, unknown>).last as Record<string, unknown>).rating as number
      : undefined;
  const bulletElo: number | undefined =
    (stats.chess_bullet as Record<string, unknown> | undefined)?.last
      ? ((stats.chess_bullet as Record<string, unknown>).last as Record<string, unknown>).rating as number
      : undefined;
  const dailyElo: number | undefined =
    (stats.chess_daily as Record<string, unknown> | undefined)?.last
      ? ((stats.chess_daily as Record<string, unknown>).last as Record<string, unknown>).rating as number
      : undefined;
  const elo = rapidElo ?? blitzElo ?? bulletElo ?? dailyElo ?? 1200;
  return { rapidElo, blitzElo, bulletElo, dailyElo, elo };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("fetchWithRetryServer — timeout guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("passes AbortSignal.timeout to each fetch attempt", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithRetryServer("https://api.chess.com/pub/player/hikaru", {}, 1, 8000);

    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    expect(callArgs.signal).toBeDefined();
    // AbortSignal.timeout returns an AbortSignal
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries on 429 and eventually succeeds", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ profile: { username: "hikaru" } }), { status: 200 }));
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();

    const promise = fetchWithRetryServer("https://api.chess.com/pub/player/hikaru", {}, 3, 8000);
    // Advance timers to skip retry delays
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("does not retry on 404 — returns immediately", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), { status: 404 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetryServer("https://api.chess.com/pub/player/nonexistent", {}, 3, 8000);

    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledOnce(); // no retries for 404
  });

  it("makes a final attempt after exhausting retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
    );
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();

    const promise = fetchWithRetryServer("https://api.chess.com/pub/player/hikaru", {}, 2, 8000);
    await vi.runAllTimersAsync();
    await promise;

    // 2 retries + 1 final attempt = 3 total calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("ELO extraction — all player types", () => {
  it("extracts rapid and blitz ELO correctly for a standard player", () => {
    const stats = {
      chess_rapid: { last: { rating: 1850 } },
      chess_blitz: { last: { rating: 2100 } },
      chess_bullet: { last: { rating: 2200 } },
    };
    const { rapidElo, blitzElo, elo } = extractElo(stats);
    expect(rapidElo).toBe(1850);
    expect(blitzElo).toBe(2100);
    expect(elo).toBe(1850); // rapid preferred
  });

  it("falls back to blitz when no rapid rating exists", () => {
    const stats = {
      chess_blitz: { last: { rating: 2100 } },
      chess_bullet: { last: { rating: 2200 } },
    };
    const { rapidElo, blitzElo, elo } = extractElo(stats);
    expect(rapidElo).toBeUndefined();
    expect(blitzElo).toBe(2100);
    expect(elo).toBe(2100);
  });

  it("falls back to bullet when no rapid or blitz rating exists", () => {
    const stats = {
      chess_bullet: { last: { rating: 2200 } },
    };
    const { rapidElo, blitzElo, bulletElo, elo } = extractElo(stats);
    expect(rapidElo).toBeUndefined();
    expect(blitzElo).toBeUndefined();
    expect(bulletElo).toBe(2200);
    expect(elo).toBe(2200);
  });

  it("defaults to 1200 when no ratings exist (new/inactive player)", () => {
    const stats = {};
    const { elo } = extractElo(stats);
    expect(elo).toBe(1200);
  });

  it("handles high-profile player stats (hikaru-like)", () => {
    const stats = {
      chess_rapid: { last: { rating: 2839 } },
      chess_blitz: { last: { rating: 3407 } },
      chess_bullet: { last: { rating: 3299 } },
    };
    const { rapidElo, blitzElo, elo } = extractElo(stats);
    expect(rapidElo).toBe(2839);
    expect(blitzElo).toBe(3407);
    expect(elo).toBe(2839);
  });

  it("handles usernames with underscores (Polish_fighter3000-like)", () => {
    // Usernames with underscores were the primary failing case.
    // The fix was server-side (timeout), not ELO extraction — but we verify
    // the extraction still works correctly for such players.
    const stats = {
      chess_rapid: { last: { rating: 2851 } },
      chess_blitz: { last: { rating: 3280 } },
    };
    const { rapidElo, blitzElo, elo } = extractElo(stats);
    expect(rapidElo).toBe(2851);
    expect(blitzElo).toBe(3280);
    expect(elo).toBe(2851);
  });

  it("handles players with only daily chess rating", () => {
    const stats = {
      chess_daily: { last: { rating: 1450 } },
    };
    const { rapidElo, blitzElo, dailyElo, elo } = extractElo(stats);
    expect(rapidElo).toBeUndefined();
    expect(blitzElo).toBeUndefined();
    expect(dailyElo).toBe(1450);
    expect(elo).toBe(1450);
  });
});

describe("Proxy response shape — client-side parsing", () => {
  it("correctly reads profile and stats from proxy response envelope", () => {
    const proxyResponse = {
      profile: {
        username: "polish_fighter3000",
        name: "Polish Fighter",
        avatar: "https://images.chesscomfiles.com/uploads/v1/user/123.png",
        title: "FM",
        country: "https://api.chess.com/pub/country/PL",
      },
      stats: {
        chess_rapid: { last: { rating: 2851 } },
        chess_blitz: { last: { rating: 3280 } },
      },
    };

    const profile = proxyResponse.profile;
    const stats = proxyResponse.stats;
    const { rapidElo, blitzElo, elo } = extractElo(stats);

    expect(profile.username).toBe("polish_fighter3000");
    expect(profile.title).toBe("FM");
    expect(profile.country.split("/").pop()?.toUpperCase()).toBe("PL");
    expect(rapidElo).toBe(2851);
    expect(blitzElo).toBe(3280);
    expect(elo).toBe(2851);
  });

  it("handles cached proxy response (has 'cached: true' field)", () => {
    const proxyResponse = {
      profile: { username: "hikaru", name: "Hikaru Nakamura" },
      stats: { chess_rapid: { last: { rating: 2839 } } },
      cached: true,
    };

    // cached flag should not affect ELO extraction
    const { elo } = extractElo(proxyResponse.stats);
    expect(elo).toBe(2839);
    expect(proxyResponse.cached).toBe(true);
  });
});
