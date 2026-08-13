import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"), "utf8");

describe("Matchup Prep submit action", () => {
  it("keeps Scout opponent as visible button text and a real accessible label", () => {
    expect(source).toMatch(/aria-label="Scout opponent"\s*>[\s\S]*?Scout opponent[\s\S]*?<ChevronRight/);
    expect(source).not.toMatch(/>\s*aria-label="Scout opponent"\s*\{/);
  });

  it("uses the explicitly active provider in V3 report requests", () => {
    expect(source).toContain("const providerQuery = `provider=${activeProvider}`");
    expect(source).toContain("providerOverride ?? provider");
  });

  it("does not let duplicate route-submit requests overwrite the active Chess.com response", () => {
    expect(source).toContain("const reportRequestIdRef = useRef(0)");
    expect(source).toContain("const requestId = ++reportRequestIdRef.current");
    expect(source).toContain("if (requestId !== reportRequestIdRef.current) return;");
    expect(source).toContain("const sameRoute = params.username?.toLowerCase() === u.toLowerCase() && routeProvider === provider");
  });
});
