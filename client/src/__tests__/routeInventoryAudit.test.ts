import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const navSource = readFileSync(resolve(projectRoot, "client/src/lib/navRegistry.ts"), "utf8");
const homeSource = readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const pricingSource = readFileSync(resolve(projectRoot, "client/src/pages/Pricing.tsx"), "utf8");
const joinSource = readFileSync(resolve(projectRoot, "client/src/pages/Join.tsx"), "utf8");
const inventory = readFileSync(resolve(projectRoot, "docs/ROUTE_INVENTORY.md"), "utf8");

const routePaths = Array.from(appSource.matchAll(/<Route path=\{"([^"]+)"\}/g), (match) => match[1]);

function routePatternMatches(destination: string): boolean {
  const pathname = destination.split(/[?#]/, 1)[0];
  return routePaths.some((route) => {
    if (route === pathname) return true;
    const pattern = new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:([A-Za-z0-9_]+)/g, "[^/]+")}$`);
    return pattern.test(pathname);
  });
}

function literalInternalDestinations(source: string): string[] {
  const values = Array.from(
    source.matchAll(/(?:href|to|url)\s*(?:=|:)\s*["'](\/[A-Za-z0-9_/:.?=#-]*)["']/g),
    (match) => match[1],
  );
  return Array.from(new Set(values)).sort();
}

describe("canonical route inventory", () => {
  it("documents every explicit application route", () => {
    for (const route of routePaths) expect(inventory).toContain(`\`${route}\``);
  });

  it("contains no duplicate explicit route declarations", () => {
    const duplicates = routePaths.filter((route, index) => routePaths.indexOf(route) !== index);
    expect(duplicates).toEqual([]);
  });

  it("keeps blog, training, error, and dynamic fallback contracts registered", () => {
    expect(routePaths).toEqual(expect.arrayContaining([
      "/blog",
      "/blog/:slug",
      "/training",
      "/tools",
      "/404",
      "/clubs/:id",
      "/tournament/:id",
      "/league/:leagueId",
    ]));
    expect(appSource).toContain("<Route component={NotFound} />");
  });

  it.each([
    ["navigation registry", navSource],
    ["Home", homeSource],
    ["Pricing", pricingSource],
    ["Join", joinSource],
  ])("maps literal internal destinations from %s to registered routes", (_label, source) => {
    const destinations = literalInternalDestinations(source);
    const stale = destinations.filter((destination) => !routePatternMatches(destination));
    expect(stale).toEqual([]);
  });

  it("uses one-way query-preserving aliases without redirect cycles", () => {
    expect(appSource).toContain('<Route path={"/tournaments/new"} component={() => <HardRedirect to="/" tournamentCreate />} />');
    expect(appSource).toContain('<Route path={"/create"} component={() => <HardRedirect to="/tournaments/new" />} />');
    expect(appSource).toContain('<Route path={"/tools"} component={() => <HardRedirect to="/training" />} />');
    expect(appSource).not.toContain('<HardRedirect to="/create"');
    expect(appSource).not.toContain('<HardRedirect to="/tools"');
  });
});
