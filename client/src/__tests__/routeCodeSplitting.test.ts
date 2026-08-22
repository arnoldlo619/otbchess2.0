import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) => readFileSync(path.resolve(relativePath), "utf8");

describe("route and interaction code splitting", () => {
  it("keeps every routed page behind React.lazy", () => {
    const source = readSource("client/src/App.tsx");
    const eagerPageImports = source
      .split("\n")
      .filter((line) => /^import\s.+(?:\.\/pages\/|@\/pages\/)/.test(line));

    expect(eagerPageImports).toEqual([]);
    expect(source).toContain('const PrepAnalysis = lazy(() => import("./pages/PrepAnalysis"))');
  });

  it("loads PDF generation only after the Director export action", () => {
    const source = readSource("client/src/pages/Director.tsx");
    expect(source).not.toMatch(/^import\s+\{\s*generateResultsPdf\s*\}/m);
    expect(source).toContain('await import("@/lib/generateResultsPdf")');
  });

  it("loads image export tooling only after the Matchup Prep export action", () => {
    const source = readSource("client/src/pages/MatchupPrep.tsx");
    expect(source).not.toMatch(/^import\s+\{\s*toBlob\s*\}\s+from\s+"html-to-image"/m);
    expect(source).toContain('await import("html-to-image")');
  });

  it("loads CSV and spreadsheet parsers only after an RSVP file is selected", () => {
    const source = readSource("client/src/components/UploadRSVPModal.tsx");
    expect(source).not.toMatch(/^import\s.+from\s+"(?:papaparse|xlsx)"/m);
    expect(source).toContain('await import("papaparse")');
    expect(source).toContain('await import("xlsx")');
  });
});
