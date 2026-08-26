import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("Repertoire Builder curated opening library", () => {
  const builder = read("client/src/pages/RepertoireBuilder.tsx");
  const library = read("client/src/components/repertoire/OpeningLibraryPanel.tsx");
  const openingsApi = read("server/openingsPublic.ts");

  it("loads published opening families and line PGN from the existing public catalog", () => {
    expect(library).toContain("/api/openings?");
    expect(library).toContain("/api/openings/${opening.slug}");
    expect(library).toContain("/api/openings/${selected.opening.slug}/lines/${line.slug}");
    expect(openingsApi).toContain('router.get("/api/openings"');
    expect(openingsApi).toContain('router.get("/api/openings/:slug/lines/:lineSlug"');
  });

  it("merges a selected published line into the user tree and persists it without replacing existing work", () => {
    expect(builder).toContain('setRightTab("library")');
    expect(builder).toContain("const importCuratedLine");
    expect(builder).toContain("const importedTree = importFromPgn(line.pgn)");
    expect(builder).toContain("mergeInto(nextTree, importedTree)");
    expect(builder).toContain("autoSave(nextTree)");
    expect(builder).toContain('setRightTab("tree")');
  });

  it("keeps library content scoped to the selected repertoire color and exposes practical line metadata", () => {
    expect(library).toContain("repertoireColor");
    expect(library).toContain("mustKnow");
    expect(library).toContain("trapLine");
    expect(library).toContain("commonness");
    expect(library).toContain("lineCount");
  });
});
