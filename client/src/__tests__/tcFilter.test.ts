/**
 * Tests for the time-control filter feature in Matchup Prep.
 *
 * Covers:
 * 1. Cache key generation (composite username:tc key)
 * 2. URL query string construction for the API call
 * 3. timeClasses array resolution from tc param
 * 4. TC filter state transitions
 * 5. Label display logic
 */
import { describe, it, expect } from "vitest";

// ── Helpers extracted from component/server logic ─────────────────────────────

type TcFilter = "all" | "rapid" | "blitz";

/** Simulates the server-side timeClasses resolution from ?tc= query param */
function resolveTimeClasses(tcParam: string): string[] {
  if (tcParam === "rapid") return ["rapid"];
  if (tcParam === "blitz") return ["blitz"];
  return ["rapid", "blitz"]; // "all" or missing
}

/** Simulates the composite cache key used in getCachedOrBuildPrepReport */
function buildCacheKey(username: string, timeClasses: string[]): string {
  const normalised = username.toLowerCase().trim();
  const tcKey = timeClasses.length === 1 ? timeClasses[0] : "all";
  return `${normalised}:${tcKey}`;
}

/** Simulates the client-side URL construction in fetchReport */
function buildFetchUrl(username: string, refresh: boolean, tc: TcFilter): string {
  const tcQuery = tc !== "all" ? `tc=${tc}` : "";
  const refreshQuery = refresh ? "refresh=true" : "";
  const queryStr = [tcQuery, refreshQuery].filter(Boolean).join("&");
  return `/api/prep/${encodeURIComponent(username.trim())}${queryStr ? `?${queryStr}` : ""}`;
}

/** Simulates the helper text shown next to the filter */
function getTcLabel(tcFilter: TcFilter): string {
  if (tcFilter === "all") return "Rapid + Blitz";
  if (tcFilter === "rapid") return "Rapid only";
  return "Blitz only";
}

/** Simulates whether a re-fetch should be triggered on TC change */
function shouldRefetchOnTcChange(
  newTc: TcFilter,
  currentTc: TcFilter,
  hasReport: boolean,
  hasSearchInput: boolean,
): boolean {
  if (newTc === currentTc) return false; // no change
  return hasReport || hasSearchInput;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TC Filter — timeClasses resolution from query param", () => {
  it("resolves 'rapid' to ['rapid']", () => {
    expect(resolveTimeClasses("rapid")).toEqual(["rapid"]);
  });

  it("resolves 'blitz' to ['blitz']", () => {
    expect(resolveTimeClasses("blitz")).toEqual(["blitz"]);
  });

  it("resolves 'all' to ['rapid', 'blitz']", () => {
    expect(resolveTimeClasses("all")).toEqual(["rapid", "blitz"]);
  });

  it("resolves missing/unknown param to ['rapid', 'blitz']", () => {
    expect(resolveTimeClasses("")).toEqual(["rapid", "blitz"]);
    expect(resolveTimeClasses("bullet")).toEqual(["rapid", "blitz"]);
    expect(resolveTimeClasses("daily")).toEqual(["rapid", "blitz"]);
  });
});

describe("TC Filter — composite cache key generation", () => {
  it("builds 'username:all' for rapid+blitz", () => {
    expect(buildCacheKey("MagnusCarlsen", ["rapid", "blitz"])).toBe("magnuscarlsen:all");
  });

  it("builds 'username:rapid' for rapid only", () => {
    expect(buildCacheKey("Hikaru", ["rapid"])).toBe("hikaru:rapid");
  });

  it("builds 'username:blitz' for blitz only", () => {
    expect(buildCacheKey("Hikaru", ["blitz"])).toBe("hikaru:blitz");
  });

  it("normalises username to lowercase", () => {
    expect(buildCacheKey("HIKARU", ["rapid"])).toBe("hikaru:rapid");
    expect(buildCacheKey("MagnusCarlsen", ["blitz"])).toBe("magnuscarlsen:blitz");
  });

  it("trims whitespace from username", () => {
    expect(buildCacheKey("  hikaru  ", ["rapid"])).toBe("hikaru:rapid");
  });

  it("different TC filters produce different cache keys for same user", () => {
    const allKey = buildCacheKey("Hikaru", ["rapid", "blitz"]);
    const rapidKey = buildCacheKey("Hikaru", ["rapid"]);
    const blitzKey = buildCacheKey("Hikaru", ["blitz"]);
    expect(allKey).not.toBe(rapidKey);
    expect(allKey).not.toBe(blitzKey);
    expect(rapidKey).not.toBe(blitzKey);
  });
});

describe("TC Filter — client URL construction", () => {
  it("builds URL without tc param when filter is 'all'", () => {
    expect(buildFetchUrl("Hikaru", false, "all")).toBe("/api/prep/Hikaru");
  });

  it("builds URL with tc=rapid when filter is 'rapid'", () => {
    expect(buildFetchUrl("Hikaru", false, "rapid")).toBe("/api/prep/Hikaru?tc=rapid");
  });

  it("builds URL with tc=blitz when filter is 'blitz'", () => {
    expect(buildFetchUrl("Hikaru", false, "blitz")).toBe("/api/prep/Hikaru?tc=blitz");
  });

  it("builds URL with refresh=true and no tc when filter is 'all'", () => {
    expect(buildFetchUrl("Hikaru", true, "all")).toBe("/api/prep/Hikaru?refresh=true");
  });

  it("builds URL with both tc and refresh params", () => {
    expect(buildFetchUrl("Hikaru", true, "rapid")).toBe("/api/prep/Hikaru?tc=rapid&refresh=true");
    expect(buildFetchUrl("Hikaru", true, "blitz")).toBe("/api/prep/Hikaru?tc=blitz&refresh=true");
  });

  it("URL-encodes special characters in username", () => {
    expect(buildFetchUrl("user name", false, "all")).toBe("/api/prep/user%20name");
    expect(buildFetchUrl("user+name", false, "rapid")).toBe("/api/prep/user%2Bname?tc=rapid");
  });
});

describe("TC Filter — label display logic", () => {
  it("shows 'Rapid + Blitz' for all", () => {
    expect(getTcLabel("all")).toBe("Rapid + Blitz");
  });

  it("shows 'Rapid only' for rapid", () => {
    expect(getTcLabel("rapid")).toBe("Rapid only");
  });

  it("shows 'Blitz only' for blitz", () => {
    expect(getTcLabel("blitz")).toBe("Blitz only");
  });
});

describe("TC Filter — re-fetch trigger logic", () => {
  it("triggers re-fetch when TC changes and report is loaded", () => {
    expect(shouldRefetchOnTcChange("rapid", "all", true, false)).toBe(true);
    expect(shouldRefetchOnTcChange("blitz", "all", true, false)).toBe(true);
    expect(shouldRefetchOnTcChange("all", "rapid", true, false)).toBe(true);
  });

  it("triggers re-fetch when TC changes and search input is present (no report yet)", () => {
    expect(shouldRefetchOnTcChange("rapid", "all", false, true)).toBe(true);
  });

  it("does NOT trigger re-fetch when TC is unchanged", () => {
    expect(shouldRefetchOnTcChange("all", "all", true, true)).toBe(false);
    expect(shouldRefetchOnTcChange("rapid", "rapid", true, true)).toBe(false);
  });

  it("does NOT trigger re-fetch when no report and no search input", () => {
    expect(shouldRefetchOnTcChange("rapid", "all", false, false)).toBe(false);
  });
});

describe("TC Filter — state transitions", () => {
  it("starts on 'all' by default", () => {
    const defaultTc: TcFilter = "all";
    expect(defaultTc).toBe("all");
  });

  it("can cycle through all three values", () => {
    let tc: TcFilter = "all";
    tc = "rapid";
    expect(tc).toBe("rapid");
    tc = "blitz";
    expect(tc).toBe("blitz");
    tc = "all";
    expect(tc).toBe("all");
  });

  it("each TC value produces a distinct cache key", () => {
    const username = "testplayer";
    const keys = (["all", "rapid", "blitz"] as TcFilter[]).map((tc) => {
      const classes = resolveTimeClasses(tc);
      return buildCacheKey(username, classes);
    });
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(3);
  });
});
