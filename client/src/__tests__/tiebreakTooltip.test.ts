/**
 * Tests for TiebreakTooltip component data and logic.
 *
 * These tests cover the TIEBREAK_DEFS data structure, type completeness,
 * and the tooltip content correctness — without requiring a DOM environment.
 */

import { describe, it, expect } from "vitest";
import { TIEBREAK_DEFS, type TiebreakType } from "../components/TiebreakTooltip";

// ─── TIEBREAK_DEFS completeness ───────────────────────────────────────────────

describe("TIEBREAK_DEFS", () => {
  const ALL_TYPES: TiebreakType[] = ["buchholz", "bc1", "sb", "wins", "match", "pts"];

  it("defines all 6 tiebreak types", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t]).toBeDefined();
    }
  });

  it("every definition has a label", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t].label).toBeTruthy();
    }
  });

  it("every definition has an abbr", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t].abbr).toBeTruthy();
    }
  });

  it("every definition has an order string", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t].order).toBeTruthy();
    }
  });

  it("every definition has a non-empty description", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t].description.length).toBeGreaterThan(20);
    }
  });

  it("every definition has an example", () => {
    for (const t of ALL_TYPES) {
      expect(TIEBREAK_DEFS[t].example).toBeTruthy();
    }
  });

  it("every definition has a valid hex/rgb/oklch color", () => {
    for (const t of ALL_TYPES) {
      const color = TIEBREAK_DEFS[t].color;
      // Accept #hex, rgb(), or oklch()
      expect(color).toMatch(/^(#[0-9a-fA-F]{3,8}|rgb|oklch)/);
    }
  });
});

// ─── Individual definitions ───────────────────────────────────────────────────

describe("TIEBREAK_DEFS.buchholz", () => {
  const def = TIEBREAK_DEFS.buchholz;

  it("has correct label", () => {
    expect(def.label).toBe("Buchholz");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("Bch");
  });

  it("mentions opponents in description", () => {
    expect(def.description.toLowerCase()).toContain("opponent");
  });

  it("is the 1st tiebreak", () => {
    expect(def.order).toContain("1st");
  });
});

describe("TIEBREAK_DEFS.bc1", () => {
  const def = TIEBREAK_DEFS.bc1;

  it("has correct label", () => {
    expect(def.label).toBe("Buchholz Cut-1");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("Bch1");
  });

  it("mentions lowest opponent in description", () => {
    expect(def.description.toLowerCase()).toContain("lowest");
  });

  it("is the 2nd tiebreak", () => {
    expect(def.order).toContain("2nd");
  });
});

describe("TIEBREAK_DEFS.sb", () => {
  const def = TIEBREAK_DEFS.sb;

  it("has correct label", () => {
    expect(def.label).toBe("Sonneborn-Berger");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("SB");
  });

  it("mentions wins in description", () => {
    expect(def.description.toLowerCase()).toContain("win");
  });

  it("is the 3rd tiebreak", () => {
    expect(def.order).toContain("3rd");
  });
});

describe("TIEBREAK_DEFS.wins", () => {
  const def = TIEBREAK_DEFS.wins;

  it("has correct label", () => {
    expect(def.label).toBe("Number of Wins");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("W");
  });

  it("is the 4th tiebreak", () => {
    expect(def.order).toContain("4th");
  });

  it("mentions draws in description (distinguishing wins from draws)", () => {
    expect(def.description.toLowerCase()).toContain("draw");
  });
});

describe("TIEBREAK_DEFS.match", () => {
  const def = TIEBREAK_DEFS.match;

  it("has correct label", () => {
    expect(def.label).toBe("Match Score");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("Match");
  });

  it("mentions Double Swiss in description", () => {
    expect(def.description).toContain("Double Swiss");
  });
});

describe("TIEBREAK_DEFS.pts", () => {
  const def = TIEBREAK_DEFS.pts;

  it("has correct label", () => {
    expect(def.label).toBe("Points");
  });

  it("has correct abbr", () => {
    expect(def.abbr).toBe("Pts");
  });

  it("is the primary ranking", () => {
    expect(def.order.toLowerCase()).toContain("primary");
  });

  it("mentions win = 1 point in description", () => {
    expect(def.description).toContain("1 point");
  });
});

// ─── Abbreviation uniqueness ──────────────────────────────────────────────────

describe("TIEBREAK_DEFS abbreviations", () => {
  it("all abbrs are unique", () => {
    const abbrs = Object.values(TIEBREAK_DEFS).map((d) => d.abbr);
    const unique = new Set(abbrs);
    expect(unique.size).toBe(abbrs.length);
  });
});

// ─── Label uniqueness ─────────────────────────────────────────────────────────

describe("TIEBREAK_DEFS labels", () => {
  it("all labels are unique", () => {
    const labels = Object.values(TIEBREAK_DEFS).map((d) => d.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

// ─── Tiebreak order ranking ───────────────────────────────────────────────────

describe("tiebreak ordering", () => {
  it("buchholz comes before bc1 in order", () => {
    // buchholz = 1st, bc1 = 2nd
    const bch = parseInt(TIEBREAK_DEFS.buchholz.order.match(/\d+/)?.[0] ?? "99");
    const bc1 = parseInt(TIEBREAK_DEFS.bc1.order.match(/\d+/)?.[0] ?? "99");
    expect(bch).toBeLessThan(bc1);
  });

  it("bc1 comes before sb in order", () => {
    const bc1 = parseInt(TIEBREAK_DEFS.bc1.order.match(/\d+/)?.[0] ?? "99");
    const sb = parseInt(TIEBREAK_DEFS.sb.order.match(/\d+/)?.[0] ?? "99");
    expect(bc1).toBeLessThan(sb);
  });

  it("sb comes before wins in order", () => {
    const sb = parseInt(TIEBREAK_DEFS.sb.order.match(/\d+/)?.[0] ?? "99");
    const wins = parseInt(TIEBREAK_DEFS.wins.order.match(/\d+/)?.[0] ?? "99");
    expect(sb).toBeLessThan(wins);
  });
});

// ─── Description quality ─────────────────────────────────────────────────────

describe("description quality", () => {
  it("buchholz description does not mention Cut-1 (that belongs to bc1)", () => {
    expect(TIEBREAK_DEFS.buchholz.description).not.toContain("Cut-1");
  });

  it("bc1 description mentions removing lowest opponent", () => {
    expect(TIEBREAK_DEFS.bc1.description.toLowerCase()).toContain("removed");
  });

  it("sb description mentions both wins and draws", () => {
    const desc = TIEBREAK_DEFS.sb.description.toLowerCase();
    expect(desc).toContain("win");
    expect(desc).toContain("draw");
  });

  it("all descriptions end with a period", () => {
    for (const def of Object.values(TIEBREAK_DEFS)) {
      expect(def.description.trimEnd()).toMatch(/\.$/);
    }
  });
});
