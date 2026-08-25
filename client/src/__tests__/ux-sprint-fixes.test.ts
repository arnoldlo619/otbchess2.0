/**
 * UX/Design-System Sprint — Unit Tests
 *
 * Covers:
 *  1. formatRegistry: getFormatLabel, getFormatShortLabel, isPlayerCountValid, getPlayerCountError
 *  2. navRegistry: canonical route ordering, no duplicate paths
 *  3. Quads canStart policy: only valid when player count is divisible by 4
 */

import { describe, it, expect } from "vitest";
import {
  getFormatLabel,
  getFormatShortLabel,
  getFormatConfig,
  isPlayerCountValid,
  getPlayerCountError,
  FORMAT_OPTIONS,
} from "../lib/formatRegistry";
import {
  NAV_ITEMS,
  DESKTOP_NAV_ITEMS,
  isNavItemActive,
} from "../lib/navRegistry";

// ─── formatRegistry ───────────────────────────────────────────────────────────

describe("formatRegistry — getFormatLabel", () => {
  it("returns correct label for swiss", () => {
    expect(getFormatLabel("swiss")).toBe("Swiss");
  });

  it("returns correct label for quads", () => {
    expect(getFormatLabel("quads")).toBe("Quads");
  });

  it("returns correct label for doubleswiss", () => {
    expect(getFormatLabel("doubleswiss")).toBe("Double Swiss");
  });

  it("returns correct label for roundrobin", () => {
    expect(getFormatLabel("roundrobin")).toBe("Round Robin");
  });

  it("returns correct label for elimination", () => {
    expect(getFormatLabel("elimination")).toBe("Elimination");
  });

  it("returns correct label for swiss_elim", () => {
    expect(getFormatLabel("swiss_elim")).toBe("Swiss + Elimination");
  });

  it("uses a neutral label for unknown formats instead of mislabeling them as Swiss", () => {
    expect(getFormatLabel("unknown_format")).toBe("Tournament");
  });
});

describe("formatRegistry — getFormatShortLabel", () => {
  it("returns short label for quads", () => {
    expect(getFormatShortLabel("quads")).toBe("Quads");
  });

  it("returns short label for doubleswiss", () => {
    expect(getFormatShortLabel("doubleswiss")).toBe("Dbl Swiss");
  });

  it("returns short label for swiss_elim", () => {
    expect(getFormatShortLabel("swiss_elim")).toBe("Swiss+Elim");
  });
});

describe("formatRegistry — isPlayerCountValid", () => {
  // Swiss — no divisibility constraint, just min 2
  it("swiss: valid with 2 players", () => {
    expect(isPlayerCountValid("swiss", 2)).toBe(true);
  });

  it("swiss: valid with 3 players", () => {
    expect(isPlayerCountValid("swiss", 3)).toBe(true);
  });

  it("swiss: invalid with 1 player", () => {
    expect(isPlayerCountValid("swiss", 1)).toBe(false);
  });

  // Quads — must be multiples of 4, min 4
  it("quads: valid with 4 players", () => {
    expect(isPlayerCountValid("quads", 4)).toBe(true);
  });

  it("quads: valid with 8 players", () => {
    expect(isPlayerCountValid("quads", 8)).toBe(true);
  });

  it("quads: valid with 12 players", () => {
    expect(isPlayerCountValid("quads", 12)).toBe(true);
  });

  it("quads: invalid with 5 players (not divisible by 4)", () => {
    expect(isPlayerCountValid("quads", 5)).toBe(false);
  });

  it("quads: invalid with 6 players (not divisible by 4)", () => {
    expect(isPlayerCountValid("quads", 6)).toBe(false);
  });

  it("quads: invalid with 7 players (not divisible by 4)", () => {
    expect(isPlayerCountValid("quads", 7)).toBe(false);
  });

  it("quads: invalid with 3 players (below minimum)", () => {
    expect(isPlayerCountValid("quads", 3)).toBe(false);
  });

  it("quads: invalid with 0 players", () => {
    expect(isPlayerCountValid("quads", 0)).toBe(false);
  });
});

describe("formatRegistry — getPlayerCountError", () => {
  it("returns null for valid swiss count", () => {
    expect(getPlayerCountError("swiss", 4)).toBeNull();
  });

  it("returns null for valid quads count (multiple of 4)", () => {
    expect(getPlayerCountError("quads", 8)).toBeNull();
  });

  it("returns error message for quads with 5 players", () => {
    const err = getPlayerCountError("quads", 5);
    expect(err).not.toBeNull();
    expect(err).toContain("Quads requires groups of 4");
    expect(err).toContain("5 players");
  });

  it("returns error message for quads with 6 players, says add 2 more", () => {
    const err = getPlayerCountError("quads", 6);
    expect(err).not.toBeNull();
    expect(err).toContain("Add 2 more");
  });

  it("returns error message for quads with 7 players, says add 1 more", () => {
    const err = getPlayerCountError("quads", 7);
    expect(err).not.toBeNull();
    expect(err).toContain("Add 1 more");
  });

  it("returns error for swiss with 1 player (below minimum)", () => {
    const err = getPlayerCountError("swiss", 1);
    expect(err).not.toBeNull();
    expect(err).toContain("at least 2 players");
  });
});

describe("formatRegistry — FORMAT_OPTIONS ordering", () => {
  it("has swiss as first option", () => {
    expect(FORMAT_OPTIONS[0].value).toBe("swiss");
  });

  it("has quads in the list", () => {
    expect(FORMAT_OPTIONS.some((f) => f.value === "quads")).toBe(true);
  });

  it("has all 6 formats", () => {
    expect(FORMAT_OPTIONS).toHaveLength(6);
  });
});

describe("formatRegistry — wizard hero copy is format-specific", () => {
  it("quads hero body does not mention Swiss pairings", () => {
    const config = getFormatConfig("quads");
    expect(config.wizardHeroBody.toLowerCase()).not.toContain("swiss pairings");
  });

  it("quads hero body mentions rating-based sections", () => {
    const config = getFormatConfig("quads");
    expect(config.wizardHeroBody.toLowerCase()).toContain("rating");
  });

  it("swiss hero body mentions Swiss pairings", () => {
    const config = getFormatConfig("swiss");
    expect(config.wizardHeroBody.toLowerCase()).toContain("swiss pairings");
  });

  it("elimination hero body does not mention Swiss", () => {
    const config = getFormatConfig("elimination");
    expect(config.wizardHeroBody.toLowerCase()).not.toContain("swiss");
  });
});

// ─── navRegistry ──────────────────────────────────────────────────────────────

describe("navRegistry — NAV_ITEMS", () => {
  it("has no duplicate paths", () => {
    const paths = NAV_ITEMS.map((item) => item.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("has no duplicate keys", () => {
    const keys = NAV_ITEMS.map((item) => item.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("contains tournaments path", () => {
    expect(NAV_ITEMS.some((item) => item.path === "/tournaments")).toBe(true);
  });

  it("contains clubs path", () => {
    expect(NAV_ITEMS.some((item) => item.path === "/clubs")).toBe(true);
  });

  it("contains league path", () => {
    expect(NAV_ITEMS.some((item) => item.path === "/league")).toBe(true);
  });
});

describe("navRegistry — DESKTOP_NAV_ITEMS", () => {
  it("is a subset of NAV_ITEMS", () => {
    const allKeys = new Set(NAV_ITEMS.map((item) => item.key));
    for (const item of DESKTOP_NAV_ITEMS) {
      expect(allKeys.has(item.key)).toBe(true);
    }
  });

  it("all items have non-empty labels", () => {
    for (const item of DESKTOP_NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});

describe("navRegistry — isNavItemActive", () => {
  it("marks /tournaments as active on /tournaments path", () => {
    const item = NAV_ITEMS.find((i) => i.path === "/tournaments")!;
    expect(isNavItemActive(item, "/tournaments")).toBe(true);
  });

  it("marks /tournaments as active on /tournaments/new (child path)", () => {
    const item = NAV_ITEMS.find((i) => i.path === "/tournaments")!;
    expect(isNavItemActive(item, "/tournaments/new")).toBe(true);
  });

  it("marks / as active only on exact / path", () => {
    const item = NAV_ITEMS.find((i) => i.path === "/")!;
    if (item) {
      expect(isNavItemActive(item, "/")).toBe(true);
      expect(isNavItemActive(item, "/clubs")).toBe(false);
    }
  });
});
