import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"), "utf8");

describe("Matchup Prep submit action", () => {
  it("defaults the report route to the launch-ready contract unless legacy schema 2 is explicitly requested", () => {
    const routeSource = readFileSync(resolve(process.cwd(), "server/prepRoutes.ts"), "utf8");

    expect(routeSource).toContain('if (req.query.schema !== "2")');
    expect(routeSource).not.toContain('if (req.query.schema === "3")');
  });

  it("keeps Scout opponent as visible dropdown-trigger text with an accessible filter label", () => {
    expect(source).toMatch(/aria-label="Scout opponent filters"[\s\S]*?>[\s\S]*?Scout opponent[\s\S]*?<ChevronDown/);
    expect(source).toContain("<DropdownMenuRadioGroup value={provider}");
    expect(source).toContain("<DropdownMenuRadioGroup value={tcFilter}");
    expect(source).toContain("<DropdownMenuRadioGroup value={myColor}");
    expect(source).toContain('form="scout-opponent-form"');
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
    expect(source).toContain("active:scale-[0.98]");
  });
});
