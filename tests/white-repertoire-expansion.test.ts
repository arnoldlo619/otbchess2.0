import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const seed = readFileSync(new URL("../scripts/seed-white-repertoire-expansion.mjs", import.meta.url), "utf8");
const reconcile = readFileSync(new URL("../scripts/reconcile-white-repertoire-expansion.mjs", import.meta.url), "utf8");

describe("White repertoire catalog expansion", () => {
  it("adds the four reviewed White systems from an authoritative named-opening source", () => {
    for (const slug of ["english-opening", "catalan-opening", "kings-indian-attack", "reti-opening", "ruy-lopez", "ponziani-opening", "trompowsky-attack"]) {
      expect(seed).toContain(`slug: "${slug}"`);
    }
    expect(seed).toContain("limit: 20");
    expect(seed).toContain("Lichess chess-openings (CC0)");
    expect(seed).toContain("sourceBase");
  });

  it("reuses existing parent and line IDs rather than requiring missing slug indexes", () => {
    expect(seed).toContain("SELECT id FROM openings WHERE slug = ?");
    expect(seed).toContain("SELECT id FROM opening_lines WHERE opening_id = ? AND slug = ?");
    expect(reconcile).toContain("UPDATE repertoire_lines SET line_id = ? WHERE line_id = ?");
    expect(reconcile).toContain("DELETE FROM opening_lines WHERE id = ?");
    expect(reconcile).toContain('"ruy-lopez"');
    expect(reconcile).toContain('"ponziani-opening"');
    expect(reconcile).toContain('"trompowsky-attack"');
  });

  it("keeps imported canonical references user-safe and publishes them to the library", () => {
    expect(seed).toContain("Canonical named sequence from the Lichess chess-openings dataset");
    expect(seed).toContain("is_published");
    expect(seed).toContain("finalFen(row.pgn)");
  });
});
