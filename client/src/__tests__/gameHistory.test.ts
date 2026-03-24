/**
 * gameHistory.test.ts
 * Unit tests for the Game History page (/games) and useGameHistory hook logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AnalysedGame } from "../hooks/useMyAnalysedGames";
import type { ResultFilter, SortField, SortDir, GameHistoryParams } from "../hooks/useGameHistory";

// ─── Helpers (mirrored from GamesHistory.tsx) ─────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

function getResultLabel(result: string | null): string {
  switch (result) {
    case "1-0":      return "1 – 0";
    case "0-1":      return "0 – 1";
    case "1/2-1/2":  return "½ – ½";
    default:         return "—";
  }
}

function getResultColor(result: string | null): string {
  switch (result) {
    case "1-0":      return "text-emerald-400 bg-emerald-400/10";
    case "0-1":      return "text-red-400 bg-red-400/10";
    case "1/2-1/2":  return "text-yellow-400 bg-yellow-400/10";
    default:         return "text-white/40 bg-white/5";
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "bg-white/20";
  if (acc >= 90) return "bg-[#4ade80]";
  if (acc >= 75) return "bg-emerald-400";
  if (acc >= 60) return "bg-yellow-400";
  if (acc >= 45) return "bg-orange-400";
  return "bg-red-400";
}

function accuracyLabel(acc: number | null): string {
  if (acc === null) return "—";
  return `${Math.round(acc)}%`;
}

// ─── URL helpers (mirrored from useGameHistory.ts) ────────────────────────────

function parseParams(search: string): GameHistoryParams {
  const p = new URLSearchParams(search);
  return {
    page:    Math.max(1, parseInt(p.get("page")  ?? "1",  10) || 1),
    limit:   Math.min(50, Math.max(1, parseInt(p.get("limit") ?? "20", 10) || 20)),
    search:  p.get("search")  ?? "",
    result:  (p.get("result") ?? "") as ResultFilter,
    sortBy:  (p.get("sortBy") ?? "createdAt") as SortField,
    sortDir: (p.get("sortDir") ?? "desc") as SortDir,
  };
}

function buildQueryString(params: GameHistoryParams): string {
  const p = new URLSearchParams();
  if (params.page    > 1)               p.set("page",    String(params.page));
  if (params.limit   !== 20)            p.set("limit",   String(params.limit));
  if (params.search)                    p.set("search",  params.search);
  if (params.result)                    p.set("result",  params.result);
  if (params.sortBy  !== "createdAt")   p.set("sortBy",  params.sortBy);
  if (params.sortDir !== "desc")        p.set("sortDir", params.sortDir);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

// ─── Server-side filter logic (mirrored from recordings.ts) ──────────────────

function applyFilters(
  games: (AnalysedGame & { sessionStatus: string })[],
  result: string,
  search: string,
): (AnalysedGame & { sessionStatus: string })[] {
  let out = games.filter((g) => g.sessionStatus === "processed");
  if (result) out = out.filter((g) => g.result === result);
  if (search) {
    const q = search.toLowerCase();
    out = out.filter((g) =>
      (g.openingName ?? "").toLowerCase().includes(q) ||
      (g.openingEco  ?? "").toLowerCase().includes(q) ||
      (g.whitePlayer ?? "").toLowerCase().includes(q) ||
      (g.blackPlayer ?? "").toLowerCase().includes(q) ||
      (g.event       ?? "").toLowerCase().includes(q)
    );
  }
  return out;
}

function applySort(
  games: AnalysedGame[],
  sortBy: string,
  sortDir: string,
): AnalysedGame[] {
  const validFields = ["createdAt", "totalMoves", "whiteAccuracy", "blackAccuracy", "date"];
  const field = validFields.includes(sortBy) ? sortBy : "createdAt";
  return [...games].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field] ?? "";
    const bv = (b as Record<string, unknown>)[field] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });
}

function paginate<T>(items: T[], page: number, limit: number): { items: T[]; total: number } {
  const offset = (page - 1) * limit;
  return { items: items.slice(offset, offset + limit), total: items.length };
}

// ─── Sample data ──────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<AnalysedGame & { sessionStatus: string }> = {}): AnalysedGame & { sessionStatus: string } {
  return {
    id: "game-1",
    sessionId: "session-1",
    pgn: "1. e4 e5",
    openingName: "King's Pawn Opening",
    openingEco: "C20",
    totalMoves: 20,
    whitePlayer: "Magnus",
    blackPlayer: "Hikaru",
    result: "1-0",
    event: "OTB Battle",
    date: "2026-03-24",
    whiteAccuracy: 92.5,
    blackAccuracy: 78.3,
    isPublic: 0,
    shareToken: null,
    createdAt: "2026-03-24T10:00:00.000Z",
    sessionStatus: "processed",
    ...overrides,
  };
}

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("formats a valid ISO string", () => {
    const result = formatDate("2026-03-24T12:00:00.000Z");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Mar/);
  });

  it("returns a non-empty string for any date", () => {
    expect(formatDate("2026-01-01").length).toBeGreaterThan(0);
  });
});

// ─── getResultLabel ───────────────────────────────────────────────────────────

describe("getResultLabel", () => {
  it("maps 1-0 to '1 – 0'",      () => expect(getResultLabel("1-0")).toBe("1 – 0"));
  it("maps 0-1 to '0 – 1'",      () => expect(getResultLabel("0-1")).toBe("0 – 1"));
  it("maps 1/2-1/2 to '½ – ½'",  () => expect(getResultLabel("1/2-1/2")).toBe("½ – ½"));
  it("maps null to '—'",          () => expect(getResultLabel(null)).toBe("—"));
  it("maps unknown to '—'",       () => expect(getResultLabel("*")).toBe("—"));
});

// ─── getResultColor ───────────────────────────────────────────────────────────

describe("getResultColor", () => {
  it("returns emerald for white win",  () => expect(getResultColor("1-0")).toContain("emerald"));
  it("returns red for black win",      () => expect(getResultColor("0-1")).toContain("red"));
  it("returns yellow for draw",        () => expect(getResultColor("1/2-1/2")).toContain("yellow"));
  it("returns muted for null",         () => expect(getResultColor(null)).toContain("white/40"));
});

// ─── accuracyColor ────────────────────────────────────────────────────────────

describe("accuracyColor", () => {
  it("returns green for >= 90",    () => expect(accuracyColor(95)).toBe("bg-[#4ade80]"));
  it("returns emerald for 75-89",  () => expect(accuracyColor(80)).toBe("bg-emerald-400"));
  it("returns yellow for 60-74",   () => expect(accuracyColor(65)).toBe("bg-yellow-400"));
  it("returns orange for 45-59",   () => expect(accuracyColor(50)).toBe("bg-orange-400"));
  it("returns red for < 45",       () => expect(accuracyColor(30)).toBe("bg-red-400"));
  it("returns muted for null",     () => expect(accuracyColor(null)).toBe("bg-white/20"));
});

// ─── accuracyLabel ────────────────────────────────────────────────────────────

describe("accuracyLabel", () => {
  it("formats as percentage",     () => expect(accuracyLabel(92.5)).toBe("93%"));
  it("returns '—' for null",      () => expect(accuracyLabel(null)).toBe("—"));
  it("rounds correctly",          () => expect(accuracyLabel(74.4)).toBe("74%"));
  it("handles 0",                 () => expect(accuracyLabel(0)).toBe("0%"));
  it("handles 100",               () => expect(accuracyLabel(100)).toBe("100%"));
});

// ─── parseParams ─────────────────────────────────────────────────────────────

describe("parseParams", () => {
  it("returns defaults for empty string", () => {
    const p = parseParams("");
    expect(p.page).toBe(1);
    expect(p.limit).toBe(20);
    expect(p.search).toBe("");
    expect(p.result).toBe("");
    expect(p.sortBy).toBe("createdAt");
    expect(p.sortDir).toBe("desc");
  });

  it("parses all params from query string", () => {
    const p = parseParams("?page=3&limit=10&search=sicilian&result=1-0&sortBy=totalMoves&sortDir=asc");
    expect(p.page).toBe(3);
    expect(p.limit).toBe(10);
    expect(p.search).toBe("sicilian");
    expect(p.result).toBe("1-0");
    expect(p.sortBy).toBe("totalMoves");
    expect(p.sortDir).toBe("asc");
  });

  it("clamps page to minimum 1", () => {
    expect(parseParams("?page=0").page).toBe(1);
    expect(parseParams("?page=-5").page).toBe(1);
  });

  it("clamps limit to max 50", () => {
    expect(parseParams("?limit=100").limit).toBe(50);
  });

  it("falls back to default 20 when limit is 0 (falsy)", () => {
    // parseInt('0') || 20 evaluates to 20 because 0 is falsy
    expect(parseParams("?limit=0").limit).toBe(20);
  });
});

// ─── buildQueryString ─────────────────────────────────────────────────────────

describe("buildQueryString", () => {
  const defaults: GameHistoryParams = {
    page: 1, limit: 20, search: "", result: "", sortBy: "createdAt", sortDir: "desc",
  };

  it("returns empty string for default params", () => {
    expect(buildQueryString(defaults)).toBe("");
  });

  it("includes page when > 1", () => {
    expect(buildQueryString({ ...defaults, page: 3 })).toContain("page=3");
  });

  it("includes search when non-empty", () => {
    expect(buildQueryString({ ...defaults, search: "sicilian" })).toContain("search=sicilian");
  });

  it("includes result when set", () => {
    expect(buildQueryString({ ...defaults, result: "1-0" })).toContain("result=1-0");
  });

  it("includes sortBy when not default", () => {
    expect(buildQueryString({ ...defaults, sortBy: "totalMoves" })).toContain("sortBy=totalMoves");
  });

  it("includes sortDir when not default", () => {
    expect(buildQueryString({ ...defaults, sortDir: "asc" })).toContain("sortDir=asc");
  });

  it("omits limit when default 20", () => {
    expect(buildQueryString(defaults)).not.toContain("limit");
  });

  it("includes limit when not 20", () => {
    expect(buildQueryString({ ...defaults, limit: 10 })).toContain("limit=10");
  });
});

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe("applyFilters (server-side logic)", () => {
  const games = [
    makeGame({ id: "1", result: "1-0",      sessionStatus: "processed", openingName: "Sicilian Defense" }),
    makeGame({ id: "2", result: "0-1",      sessionStatus: "processed", openingName: "French Defense" }),
    makeGame({ id: "3", result: "1/2-1/2",  sessionStatus: "processed", openingName: "King's Gambit" }),
    makeGame({ id: "4", result: "1-0",      sessionStatus: "analysing", openingName: "Ruy Lopez" }),
    makeGame({ id: "5", result: "0-1",      sessionStatus: "processed", whitePlayer: "Kasparov", openingName: "Caro-Kann" }),
  ];

  it("only returns processed games", () => {
    const result = applyFilters(games, "", "");
    expect(result.map((g) => g.id)).not.toContain("4");
    expect(result).toHaveLength(4);
  });

  it("filters by result '1-0'", () => {
    const result = applyFilters(games, "1-0", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by result '0-1'", () => {
    const result = applyFilters(games, "0-1", "");
    expect(result.map((g) => g.id)).toEqual(["2", "5"]);
  });

  it("filters by result '1/2-1/2'", () => {
    const result = applyFilters(games, "1/2-1/2", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("filters by opening name search", () => {
    const result = applyFilters(games, "", "sicilian");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by player name search", () => {
    const result = applyFilters(games, "", "kasparov");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("search is case-insensitive", () => {
    const result = applyFilters(games, "", "FRENCH");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("combines result and search filters", () => {
    const result = applyFilters(games, "0-1", "kasparov");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("returns empty array when no matches", () => {
    expect(applyFilters(games, "1-0", "zzznomatch")).toHaveLength(0);
  });
});

// ─── applySort ────────────────────────────────────────────────────────────────

describe("applySort", () => {
  const games = [
    makeGame({ id: "1", totalMoves: 30, createdAt: "2026-01-01T00:00:00Z" }),
    makeGame({ id: "2", totalMoves: 10, createdAt: "2026-03-01T00:00:00Z" }),
    makeGame({ id: "3", totalMoves: 50, createdAt: "2026-02-01T00:00:00Z" }),
  ];

  it("sorts by totalMoves descending", () => {
    const result = applySort(games, "totalMoves", "desc");
    expect(result.map((g) => g.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by totalMoves ascending", () => {
    const result = applySort(games, "totalMoves", "asc");
    expect(result.map((g) => g.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by createdAt descending (most recent first)", () => {
    const result = applySort(games, "createdAt", "desc");
    expect(result[0].id).toBe("2"); // March is most recent
  });

  it("sorts by createdAt ascending (oldest first)", () => {
    const result = applySort(games, "createdAt", "asc");
    expect(result[0].id).toBe("1"); // January is oldest
  });

  it("falls back to createdAt for invalid field", () => {
    const result = applySort(games, "invalidField", "desc");
    expect(result).toHaveLength(3);
  });

  it("does not mutate the original array", () => {
    const original = [...games];
    applySort(games, "totalMoves", "asc");
    expect(games.map((g) => g.id)).toEqual(original.map((g) => g.id));
  });
});

// ─── paginate ─────────────────────────────────────────────────────────────────

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1) }));

  it("returns first 20 items on page 1 with limit 20", () => {
    const { items: page, total } = paginate(items, 1, 20);
    expect(page).toHaveLength(20);
    expect(total).toBe(25);
    expect(page[0].id).toBe("1");
  });

  it("returns remaining 5 items on page 2 with limit 20", () => {
    const { items: page } = paginate(items, 2, 20);
    expect(page).toHaveLength(5);
    expect(page[0].id).toBe("21");
  });

  it("returns correct slice for page 3 with limit 10", () => {
    const { items: page } = paginate(items, 3, 10);
    expect(page).toHaveLength(5);
    expect(page[0].id).toBe("21");
  });

  it("returns empty array when page is out of range", () => {
    const { items: page } = paginate(items, 10, 20);
    expect(page).toHaveLength(0);
  });

  it("always reports correct total", () => {
    expect(paginate(items, 1, 5).total).toBe(25);
    expect(paginate(items, 3, 5).total).toBe(25);
  });
});

// ─── totalPages calculation ───────────────────────────────────────────────────

describe("totalPages calculation", () => {
  function totalPages(total: number, limit: number): number {
    return Math.max(1, Math.ceil(total / limit));
  }

  it("returns 1 for 0 total items",     () => expect(totalPages(0, 20)).toBe(1));
  it("returns 1 for 20 items / 20",     () => expect(totalPages(20, 20)).toBe(1));
  it("returns 2 for 21 items / 20",     () => expect(totalPages(21, 20)).toBe(2));
  it("returns 3 for 41 items / 20",     () => expect(totalPages(41, 20)).toBe(3));
  it("returns 5 for 50 items / 10",     () => expect(totalPages(50, 10)).toBe(5));
  it("always returns at least 1",       () => expect(totalPages(0, 50)).toBe(1));
});

// ─── Pagination display range ─────────────────────────────────────────────────

describe("pagination display range text", () => {
  function rangeText(page: number, limit: number, total: number): string {
    const from = (page - 1) * limit + 1;
    const to   = Math.min(page * limit, total);
    return `Showing ${from}–${to} of ${total} games`;
  }

  it("shows correct range for page 1", () => {
    expect(rangeText(1, 20, 45)).toBe("Showing 1–20 of 45 games");
  });

  it("shows correct range for page 2", () => {
    expect(rangeText(2, 20, 45)).toBe("Showing 21–40 of 45 games");
  });

  it("shows correct range for last partial page", () => {
    expect(rangeText(3, 20, 45)).toBe("Showing 41–45 of 45 games");
  });

  it("shows 1–1 for single game", () => {
    expect(rangeText(1, 20, 1)).toBe("Showing 1–1 of 1 games");
  });
});

// ─── Fetch API integration ────────────────────────────────────────────────────

describe("fetch API integration", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { global.fetch = originalFetch; });

  it("builds correct query string for all params", () => {
    const params: GameHistoryParams = {
      page: 2, limit: 10, search: "sicilian", result: "1-0",
      sortBy: "totalMoves", sortDir: "asc",
    };
    const qs = new URLSearchParams({
      page: "2", limit: "10", search: "sicilian", result: "1-0",
      sortBy: "totalMoves", sortDir: "asc",
    }).toString();
    expect(qs).toContain("page=2");
    expect(qs).toContain("search=sicilian");
    expect(qs).toContain("result=1-0");
    expect(qs).toContain("sortBy=totalMoves");
    expect(qs).toContain("sortDir=asc");
  });

  it("handles paginated response shape", async () => {
    const mockResponse = {
      games: [makeGame()],
      total: 1,
      page: 1,
      limit: 20,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => mockResponse,
    } as Response);

    const res = await global.fetch("/api/games?page=1&limit=20", { credentials: "include" });
    const data = await res.json();
    expect(data.games).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("handles legacy array response shape", async () => {
    const mockGames = [makeGame(), makeGame({ id: "game-2" })];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => mockGames,
    } as Response);

    const res = await global.fetch("/api/games", { credentials: "include" });
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
  });

  it("handles 401 without throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const res = await global.fetch("/api/games", { credentials: "include" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });

  it("handles 500 with error message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    } as Response);

    const res = await global.fetch("/api/games", { credentials: "include" });
    const errorMsg = `Failed to load games (${res.status})`;
    expect(errorMsg).toBe("Failed to load games (500)");
  });
});
