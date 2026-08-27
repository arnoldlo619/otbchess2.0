import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"), "utf8");

describe("Matchup Prep submit action", () => {
  it("keeps Scout opponent as visible button text and a real accessible label", () => {
    expect(source).toMatch(/aria-label="Scout opponent"[\s\S]*?>[\s\S]*?Scout opponent[\s\S]*?<ChevronRight/);
    expect(source).not.toMatch(/>\s*aria-label="Scout opponent"\s*\{/);
  });

  it("uses the submitted immutable provider in V3 report requests", () => {
    expect(source).toContain("const query = scoutRequestSearchParams(request)");
    expect(source).toContain("request.platform");
    expect(source).not.toContain("providerOverride ?? provider");
  });

  it("does not let duplicate route-submit requests overwrite the active Chess.com response", () => {
    expect(source).toContain("const reportRequestIdRef = useRef(0)");
    expect(source).toContain("const requestId = ++reportRequestIdRef.current");
    expect(source).toContain("if (requestId !== reportRequestIdRef.current) return;");
    expect(source).toContain("const route = scoutRequestRoute(request)");
    expect(source).toContain("const sameRoute = `${window.location.pathname}${window.location.search}` === route");
  });

  it("uses a tactile primary-action treatment with accessible loading state", () => {
    expect(source).toContain("focus-visible:ring-2 focus-visible:ring-[#8dcc9b]");
    expect(source).toContain("hover:-translate-y-px");
    expect(source).toContain("aria-busy={loading}");
    expect(source).toContain("group-hover:translate-x-0.5");
  });
});
