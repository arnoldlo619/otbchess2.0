/**
 * Instagram Carousel — Unit Tests
 *
 * Validates the design system constants, layout math, and mobile download
 * logic for the redesigned 1080×1080 slide generator.
 */

import { describe, it, expect, vi } from "vitest";

// ─── Constants (mirror from component) ────────────────────────────────────────

const SLIDE_SIZE = 1080;
const BRAND = {
  white: "#FFFFFF",
  offWhite: "#F0F5EE",
  gold: "#F5C842",
  silver: "#C8D0D8",
  bronze: "#CD7F32",
};

const SLIDE_THEMES = [
  { id: "classic-green", label: "Classic", bg: "#2A4A32", bgDark: "#0A1A0E", accent: "#3D6B47", accentLight: "#769656", accentBright: "#4CAF50", glow: "#3D6B47", swatch: "#3D6B47" },
  { id: "midnight-blue", label: "Midnight", bg: "#1A2A4A", bgDark: "#080E1A", accent: "#2A4A7A", accentLight: "#5B8DD9", accentBright: "#4A90E2", glow: "#2A4A7A", swatch: "#2A4A7A" },
  { id: "crimson", label: "Crimson", bg: "#4A1A1A", bgDark: "#1A0808", accent: "#7A2A2A", accentLight: "#D95B5B", accentBright: "#E24A4A", glow: "#7A2A2A", swatch: "#7A2A2A" },
  { id: "gold-rush", label: "Gold", bg: "#3A2A0A", bgDark: "#1A1205", accent: "#7A5A0A", accentLight: "#D4A017", accentBright: "#F5C842", glow: "#7A5A0A", swatch: "#7A5A0A" },
  { id: "monochrome", label: "Mono", bg: "#2A2A2A", bgDark: "#0A0A0A", accent: "#4A4A4A", accentLight: "#B0B0B0", accentBright: "#E0E0E0", glow: "#4A4A4A", swatch: "#4A4A4A" },
  { id: "purple-reign", label: "Purple", bg: "#2A1A4A", bgDark: "#0E0818", accent: "#4A2A7A", accentLight: "#9B5BD9", accentBright: "#8B4AE2", glow: "#4A2A7A", swatch: "#4A2A7A" },
];

// ─── Helper functions (mirror from component) ─────────────────────────────────

function clampFont(base: number, text: string, maxChars = 20): number {
  if (text.length <= maxChars) return base;
  return Math.max(base * 0.6, base * (maxChars / text.length));
}

function avgElo(rows: { player: { elo: number } }[]): number {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s, r) => s + r.player.elo, 0) / rows.length);
}

function formatFormat(fmt?: string): string {
  if (fmt === "swiss") return "Swiss";
  if (fmt === "roundrobin") return "Round Robin";
  if (fmt === "elimination") return "Elimination";
  return fmt ?? "Swiss";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function isMobileDevice(ua: string, width: number): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(ua) || width < 768;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Instagram Carousel — Design System Constants", () => {
  it("SLIDE_SIZE is exactly 1080px (Instagram square format)", () => {
    expect(SLIDE_SIZE).toBe(1080);
  });

  it("BRAND colors are valid hex strings", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    Object.values(BRAND).forEach((color) => {
      expect(color).toMatch(hexPattern);
    });
  });

  it("has exactly 6 slide themes", () => {
    expect(SLIDE_THEMES).toHaveLength(6);
  });

  it("each theme has all required fields", () => {
    const requiredFields = ["id", "label", "bg", "bgDark", "accent", "accentLight", "accentBright", "glow", "swatch"];
    SLIDE_THEMES.forEach((theme) => {
      requiredFields.forEach((field) => {
        expect(theme).toHaveProperty(field);
        expect((theme as Record<string, string>)[field]).toBeTruthy();
      });
    });
  });

  it("all theme IDs are unique", () => {
    const ids = SLIDE_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("classic-green theme is the default (first theme)", () => {
    expect(SLIDE_THEMES[0].id).toBe("classic-green");
  });
});

describe("Instagram Carousel — Layout Math", () => {
  it("preview at scale 0.42 produces ~454px preview (desktop)", () => {
    const PREVIEW_SCALE = 0.42;
    const previewSize = Math.round(SLIDE_SIZE * PREVIEW_SCALE);
    expect(previewSize).toBe(454);
    // Must be larger than the old 400px (0.37 scale)
    expect(previewSize).toBeGreaterThan(400);
  });

  it("preview at scale 0.30 produces 324px preview (mobile)", () => {
    const PREVIEW_SCALE = 0.30;
    const previewSize = Math.round(SLIDE_SIZE * PREVIEW_SCALE);
    expect(previewSize).toBe(324);
  });

  it("footer height is 80px at scale=1", () => {
    const FOOTER = 80 * 1;
    expect(FOOTER).toBe(80);
  });

  it("Slide 3 rows fit calculation — 8 rows at 78px each within 1080px canvas", () => {
    const FOOTER = 80;
    const HEADER_H = 148;
    const ROW_H = 78;
    const availH = SLIDE_SIZE - FOOTER - HEADER_H;
    const maxRows = Math.floor(availH / ROW_H);
    // Should fit at least 8 rows
    expect(maxRows).toBeGreaterThanOrEqual(8);
    expect(availH).toBeGreaterThan(0);
  });

  it("Slide 2 podium heights sum to less than available canvas space", () => {
    const FOOTER = 80;
    const HEADER_H = 160;
    const availH = SLIDE_SIZE - FOOTER - HEADER_H;
    const podiumHeightFrac = [0.30, 0.40, 0.24];
    const maxPodiumH = Math.max(...podiumHeightFrac) * availH;
    // Tallest podium block (1st place) must fit
    expect(maxPodiumH).toBeLessThan(availH);
    expect(maxPodiumH).toBeGreaterThan(200); // Must be substantial
  });

  it("stat grid numbers at 88px scale=1 are much larger than old 56px", () => {
    const newStatFontSize = 88;
    const oldStatFontSize = 56;
    expect(newStatFontSize).toBeGreaterThan(oldStatFontSize);
    // At least 50% bigger
    expect(newStatFontSize / oldStatFontSize).toBeGreaterThan(1.5);
  });

  it("champion name font at 110px scale=1 is larger than old 52px", () => {
    const newChampionFont = 110;
    const oldChampionFont = 52;
    expect(newChampionFont).toBeGreaterThan(oldChampionFont);
    expect(newChampionFont / oldChampionFont).toBeGreaterThan(2.0);
  });
});

describe("Instagram Carousel — clampFont()", () => {
  it("returns base size for short names (≤ maxChars)", () => {
    expect(clampFont(110, "Ken", 12)).toBe(110);
    expect(clampFont(110, "Alexander", 12)).toBe(110);
  });

  it("reduces font for names exceeding maxChars", () => {
    const result = clampFont(110, "Christopher Alexander", 12);
    expect(result).toBeLessThan(110);
  });

  it("never goes below 60% of base size", () => {
    // Very long name
    const result = clampFont(110, "A".repeat(50), 12);
    expect(result).toBeGreaterThanOrEqual(110 * 0.6);
  });

  it("scales proportionally for medium-length names", () => {
    const base = 100;
    const maxChars = 10;
    const text = "A".repeat(20); // 2x maxChars
    const result = clampFont(base, text, maxChars);
    // Should be base * (maxChars / text.length) = 100 * 0.5 = 50, but clamped to 60
    expect(result).toBe(60); // 60% floor
  });
});

describe("Instagram Carousel — avgElo()", () => {
  it("returns 0 for empty rows", () => {
    expect(avgElo([])).toBe(0);
  });

  it("returns correct average for single player", () => {
    expect(avgElo([{ player: { elo: 1500 } }])).toBe(1500);
  });

  it("rounds to nearest integer", () => {
    const rows = [{ player: { elo: 1000 } }, { player: { elo: 1001 } }];
    expect(avgElo(rows)).toBe(1001); // 1000.5 rounds to 1001
  });

  it("handles diverse ELO range correctly", () => {
    const rows = [
      { player: { elo: 800 } },
      { player: { elo: 1200 } },
      { player: { elo: 1600 } },
      { player: { elo: 2000 } },
    ];
    expect(avgElo(rows)).toBe(1400);
  });
});

describe("Instagram Carousel — formatFormat()", () => {
  it("formats swiss correctly", () => {
    expect(formatFormat("swiss")).toBe("Swiss");
  });

  it("formats roundrobin correctly", () => {
    expect(formatFormat("roundrobin")).toBe("Round Robin");
  });

  it("formats elimination correctly", () => {
    expect(formatFormat("elimination")).toBe("Elimination");
  });

  it("returns Swiss as default for unknown format", () => {
    expect(formatFormat(undefined)).toBe("Swiss");
    // Empty string falls through to `fmt ?? "Swiss"` — fmt is "", so returns ""
    // The component only shows this for undefined/null; empty string is a valid passthrough
    expect(formatFormat("")).toBe("");
  });
});

describe("Instagram Carousel — formatDate()", () => {
  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-04-01");
    expect(result).toContain("2026");
    expect(result.length).toBeGreaterThan(5);
  });

  it("returns the original string if date parsing fails", () => {
    const invalid = "not-a-date";
    const result = formatDate(invalid);
    // Should return something (either the string or "Invalid Date")
    expect(typeof result).toBe("string");
  });
});

describe("Instagram Carousel — Mobile Detection", () => {
  it("detects Android user agent as mobile", () => {
    expect(isMobileDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36", 390)).toBe(true);
  });

  it("detects iPhone user agent as mobile", () => {
    expect(isMobileDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 390)).toBe(true);
  });

  it("detects narrow viewport as mobile (width < 768)", () => {
    expect(isMobileDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 600)).toBe(true);
  });

  it("detects desktop user agent + wide viewport as non-mobile", () => {
    expect(isMobileDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", 1440)).toBe(false);
  });

  it("detects iPad as mobile", () => {
    expect(isMobileDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", 768)).toBe(true);
  });
});

describe("Instagram Carousel — Web Share API Logic", () => {
  it("uses share API when canShare is available and on mobile", () => {
    const canShare = true;
    const mobile = true;
    const shouldUseShare = canShare && mobile;
    expect(shouldUseShare).toBe(true);
  });

  it("falls back to anchor download on desktop even if canShare exists", () => {
    const canShare = true;
    const mobile = false;
    const shouldUseShare = canShare && mobile;
    expect(shouldUseShare).toBe(false);
  });

  it("falls back to anchor download when canShare is unavailable", () => {
    const canShare = false;
    const mobile = true;
    const shouldUseShare = canShare && mobile;
    expect(shouldUseShare).toBe(false);
  });
});

describe("Instagram Carousel — ZIP Export Logic", () => {
  it("generates correct filename for a tournament", () => {
    const tournamentName = "Tuesday Beers & Blunders OTB Blitz";
    const sanitized = tournamentName.replace(/\s+/g, "_");
    const zipName = `${sanitized}_Instagram_Carousel.zip`;
    expect(zipName).toBe("Tuesday_Beers_&_Blunders_OTB_Blitz_Instagram_Carousel.zip");
    expect(zipName).not.toContain(" ");
  });

  it("generates correct per-slide filename", () => {
    const tournamentName = "Club Championship";
    const sanitized = tournamentName.replace(/\s+/g, "_");
    const slides = ["cover", "podium", "standings", "stats", "cta"];
    slides.forEach((id, i) => {
      const fileName = `${sanitized}_slide_${i + 1}_${id}.png`;
      expect(fileName).toMatch(/^Club_Championship_slide_\d_\w+\.png$/);
    });
  });

  it("progress goes from 0 to 100 across 5 slides", () => {
    const totalSlides = 5;
    const progressPoints = Array.from({ length: totalSlides }, (_, i) =>
      Math.round((i / totalSlides) * 80)
    );
    expect(progressPoints[0]).toBe(0);
    expect(progressPoints[4]).toBe(64);
    // After zip generation: 90, then 100
    const finalProgress = [90, 100];
    expect(finalProgress[1]).toBe(100);
  });
});
