/**
 * Tests for the card accent color helpers exported from PlayerStatsCard.tsx:
 *   - ACCENT_PALETTE: curated 8-swatch array
 *   - defaultAccentForBadge: maps badge id → hex color
 *   - hexToGlow: converts hex → rgba glow string
 */

import { describe, it, expect } from "vitest";
import {
  ACCENT_PALETTE,
  defaultAccentForBadge,
  hexToGlow,
} from "@/components/PlayerStatsCard";

// ─── ACCENT_PALETTE ───────────────────────────────────────────────────────────

describe("ACCENT_PALETTE", () => {
  it("contains exactly 8 swatches", () => {
    expect(ACCENT_PALETTE).toHaveLength(8);
  });

  it("every swatch has a non-empty id", () => {
    for (const s of ACCENT_PALETTE) {
      expect(s.id.length).toBeGreaterThan(0);
    }
  });

  it("every swatch has a hex color starting with #", () => {
    for (const s of ACCENT_PALETTE) {
      expect(s.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("every swatch has a non-empty label", () => {
    for (const s of ACCENT_PALETTE) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("every swatch has a glow string containing rgba", () => {
    for (const s of ACCENT_PALETTE) {
      expect(s.glow).toContain("rgba(");
    }
  });

  it("all swatch ids are unique", () => {
    const ids = ACCENT_PALETTE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all swatch hex values are unique", () => {
    const hexes = ACCENT_PALETTE.map((s) => s.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("includes a green swatch", () => {
    expect(ACCENT_PALETTE.some((s) => s.id === "green")).toBe(true);
  });

  it("includes a gold swatch", () => {
    expect(ACCENT_PALETTE.some((s) => s.id === "gold")).toBe(true);
  });

  it("includes a purple swatch", () => {
    expect(ACCENT_PALETTE.some((s) => s.id === "purple")).toBe(true);
  });
});

// ─── defaultAccentForBadge ────────────────────────────────────────────────────

describe("defaultAccentForBadge", () => {
  it("returns amber/gold for champion", () => {
    expect(defaultAccentForBadge("champion")).toBe("#F59E0B");
  });

  it("returns silver for runner_up", () => {
    expect(defaultAccentForBadge("runner_up")).toBe("#94A3B8");
  });

  it("returns orange for third_place", () => {
    expect(defaultAccentForBadge("third_place")).toBe("#EA580C");
  });

  it("returns teal/green for perfect_score", () => {
    expect(defaultAccentForBadge("perfect_score")).toBe("#34D399");
  });

  it("returns purple for giant_killer", () => {
    expect(defaultAccentForBadge("giant_killer")).toBe("#A78BFA");
  });

  it("returns blue for iron_wall", () => {
    expect(defaultAccentForBadge("iron_wall")).toBe("#60A5FA");
  });

  it("returns rose/pink for comeback", () => {
    expect(defaultAccentForBadge("comeback")).toBe("#FB7185");
  });

  it("returns teal for consistent", () => {
    expect(defaultAccentForBadge("consistent")).toBe("#2DD4BF");
  });

  it("returns green for participant", () => {
    expect(defaultAccentForBadge("participant")).toBe("#4CAF50");
  });

  it("falls back to green for unknown badge", () => {
    expect(defaultAccentForBadge("unknown_badge")).toBe("#4CAF50");
  });

  it("falls back to green for empty string", () => {
    expect(defaultAccentForBadge("")).toBe("#4CAF50");
  });

  it("returns a valid 6-digit hex for every known badge", () => {
    const badges = [
      "champion", "runner_up", "third_place", "perfect_score",
      "giant_killer", "iron_wall", "comeback", "consistent", "participant",
    ];
    for (const badge of badges) {
      expect(defaultAccentForBadge(badge)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── hexToGlow ────────────────────────────────────────────────────────────────

describe("hexToGlow", () => {
  it("converts #4CAF50 to correct rgba at default alpha", () => {
    expect(hexToGlow("#4CAF50")).toBe("rgba(76,175,80,0.18)");
  });

  it("converts #F59E0B to correct rgba", () => {
    expect(hexToGlow("#F59E0B")).toBe("rgba(245,158,11,0.18)");
  });

  it("converts #60A5FA to correct rgba", () => {
    expect(hexToGlow("#60A5FA")).toBe("rgba(96,165,250,0.18)");
  });

  it("respects custom alpha parameter", () => {
    expect(hexToGlow("#4CAF50", 0.5)).toBe("rgba(76,175,80,0.5)");
  });

  it("returns a fallback for invalid hex", () => {
    const result = hexToGlow("not-a-hex");
    expect(result).toContain("rgba(");
  });

  it("output always starts with rgba(", () => {
    for (const swatch of ACCENT_PALETTE) {
      expect(hexToGlow(swatch.hex)).toMatch(/^rgba\(/);
    }
  });

  it("output always ends with the alpha value and )", () => {
    expect(hexToGlow("#4CAF50", 0.12)).toMatch(/0\.12\)$/);
  });

  it("handles uppercase hex", () => {
    expect(hexToGlow("#FFFFFF", 0.1)).toBe("rgba(255,255,255,0.1)");
  });

  it("handles lowercase hex", () => {
    expect(hexToGlow("#ffffff", 0.1)).toBe("rgba(255,255,255,0.1)");
  });

  it("handles black", () => {
    expect(hexToGlow("#000000", 0.2)).toBe("rgba(0,0,0,0.2)");
  });
});
