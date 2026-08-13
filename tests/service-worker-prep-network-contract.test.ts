import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/public/sw.js"), "utf8");

describe("service worker Matchup Prep network policy", () => {
  it("keeps provider-backed report generation network-only and ahead of generic API caching", () => {
    const prepPolicy = source.indexOf('if (url.pathname.startsWith("/api/prep/"))');
    const genericApiPolicy = source.indexOf('if (url.pathname.startsWith("/api/"))');

    expect(prepPolicy).toBeGreaterThan(-1);
    expect(genericApiPolicy).toBeGreaterThan(prepPolicy);
    expect(source.slice(prepPolicy, genericApiPolicy)).toContain("event.respondWith(fetch(request))");
    expect(source).toContain('const CACHE_VERSION = "otb-chess-v5"');
  });
});
