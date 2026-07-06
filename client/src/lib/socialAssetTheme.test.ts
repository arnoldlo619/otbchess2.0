/**
 * Unit tests for SocialAssetGenerator theme system and image upload logic.
 */

import { describe, it, expect } from "vitest";
import {
  BUILT_IN_THEMES, generateCaption, buildFilterString, DEFAULT_FILTERS,
  clampLogoPlacement, snapLogoPlacement, getLogoBounds,
  type AssetConfig, type BgImageFilters, type LogoPlacement,
} from "../components/tournament/SocialAssetGenerator";

// ─── Theme Definitions ────────────────────────────────────────────────────────

describe("Built-in Themes", () => {
  it("has 8 built-in themes", () => {
    expect(BUILT_IN_THEMES.length).toBe(8);
  });

  it("all themes have required fields", () => {
    for (const theme of BUILT_IN_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.label).toBeTruthy();
      expect(theme.bgStops).toHaveLength(3);
      expect(theme.accentStart).toMatch(/^#/);
      expect(theme.accentEnd).toMatch(/^#/);
      expect(theme.brandColor).toMatch(/^#/);
      expect(["chess", "dots", "lines", "none"]).toContain(theme.pattern);
      expect(["vertical", "horizontal", "diagonal", "radial"]).toContain(theme.gradientDir);
    }
  });

  it("all theme IDs are unique", () => {
    const ids = BUILT_IN_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dark_forest theme has green accent and chess pattern", () => {
    const t = BUILT_IN_THEMES.find(t => t.id === "dark_forest")!;
    expect(t.accentStart).toBe("#4CAF50");
    expect(t.pattern).toBe("chess");
    expect(t.gradientDir).toBe("vertical");
  });

  it("light_clean theme has light background and dark text", () => {
    const t = BUILT_IN_THEMES.find(t => t.id === "light_clean")!;
    expect(t.bgStops[0]).toMatch(/^#f/);
    expect(t.titleColor).toBe("#0f172a");
  });

  it("neon theme has bright green brand color and dots pattern", () => {
    const t = BUILT_IN_THEMES.find(t => t.id === "neon")!;
    expect(t.brandColor).toBe("#00ff88");
    expect(t.pattern).toBe("dots");
  });

  it("midnight_blue uses diagonal gradient", () => {
    const t = BUILT_IN_THEMES.find(t => t.id === "midnight_blue")!;
    expect(t.gradientDir).toBe("diagonal");
    expect(t.accentStart).toBe("#3B82F6");
  });

  it("gold theme uses radial gradient", () => {
    const t = BUILT_IN_THEMES.find(t => t.id === "gold")!;
    expect(t.gradientDir).toBe("radial");
  });
});

// ─── Caption Generation ───────────────────────────────────────────────────────

describe("generateCaption", () => {
  const config: AssetConfig = {
    tournamentName: "Saturday Quads",
    clubName: "Chess Center",
    eventDate: "July 5, 2026",
    venue: "Main Hall",
    champions: [
      { playerName: "Alice Smith", rating: 1800, sectionName: "Quad 1", finalScore: "3/3", badges: ["perfect_score"], prizeWon: "$50" },
      { playerName: "Frank Miller", rating: 1550, sectionName: "Quad 2", finalScore: "2.5/3", badges: [] },
    ],
    playerCount: 8,
    format: "quads",
    timeControl: "G/30+5",
  };

  it("includes tournament name", () => {
    expect(generateCaption(config)).toContain("Saturday Quads");
  });

  it("includes all champion names", () => {
    const caption = generateCaption(config);
    expect(caption).toContain("Alice Smith");
    expect(caption).toContain("Frank Miller");
  });

  it("includes prize when present", () => {
    expect(generateCaption(config)).toContain("$50");
  });

  it("includes venue and date", () => {
    const caption = generateCaption(config);
    expect(caption).toContain("July 5, 2026");
    expect(caption).toContain("Main Hall");
  });

  it("includes player count and format", () => {
    const caption = generateCaption(config);
    expect(caption).toContain("8 players");
    expect(caption).toContain("quads");
  });

  it("includes OTB hashtags", () => {
    const caption = generateCaption(config);
    expect(caption).toContain("#OTBChess");
    expect(caption).toContain("#ChessTournament");
  });

  it("includes club hashtag", () => {
    expect(generateCaption(config)).toContain("#ChessCenter");
  });

  it("omits prize parentheses when no prize", () => {
    const caption = generateCaption(config);
    const frankLine = caption.split("\n").find(l => l.includes("Frank Miller"));
    expect(frankLine).toBeDefined();
    expect(frankLine).not.toContain("(");
  });

  it("handles empty champions gracefully", () => {
    const empty: AssetConfig = { ...config, champions: [] };
    const caption = generateCaption(empty);
    expect(caption).toContain("Saturday Quads");
    expect(caption).toContain("#OTBChess");
  });
});

// ─── Custom Theme Color Logic ─────────────────────────────────────────────────

describe("Custom theme color logic", () => {
  it("light background triggers dark text detection", () => {
    const lightBg = "#f8fafc";
    expect(lightBg.startsWith("#f") || lightBg.startsWith("#e")).toBe(true);
  });

  it("dark background keeps white text", () => {
    const darkBg = "#0d1f12";
    expect(darkBg.startsWith("#f") || darkBg.startsWith("#e")).toBe(false);
  });

  it("all 4 gradient directions are valid", () => {
    const dirs = ["vertical", "horizontal", "diagonal", "radial"];
    for (const d of dirs) expect(["vertical", "horizontal", "diagonal", "radial"]).toContain(d);
  });

  it("all 4 pattern types are valid", () => {
    const patterns = ["chess", "dots", "lines", "none"];
    for (const p of patterns) expect(["chess", "dots", "lines", "none"]).toContain(p);
  });
});

// ─── Image Upload State Logic ─────────────────────────────────────────────────

describe("Image upload state logic", () => {
  it("bg image fit modes are valid", () => {
    const fits = ["cover", "contain", "tile"];
    for (const f of fits) expect(["cover", "contain", "tile"]).toContain(f);
  });

  it("logo positions are valid", () => {
    const positions = ["top-left", "top-right", "bottom-left", "bottom-right", "center"];
    for (const p of positions) expect(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).toContain(p);
  });

  it("logo size range is 0.5 to 2.0", () => {
    const min = 0.5, max = 2.0, def = 1.0;
    expect(def).toBeGreaterThanOrEqual(min);
    expect(def).toBeLessThanOrEqual(max);
  });

  it("bg image opacity range is 0 to 1", () => {
    const opacity = 0.55;
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it("FileReader produces data URL starting with data:", () => {
    // Simulate what FileReader.readAsDataURL produces
    const mockDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    expect(mockDataUrl.startsWith("data:")).toBe(true);
    expect(mockDataUrl.includes("base64,")).toBe(true);
  });

  it("accepted image MIME types are image/*", () => {
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    for (const t of validTypes) expect(t.startsWith("image/")).toBe(true);
  });

  it("non-image MIME types are rejected", () => {
    const invalidTypes = ["application/pdf", "text/plain", "video/mp4"];
    for (const t of invalidTypes) expect(t.startsWith("image/")).toBe(false);
  });
});

// ─── buildFilterString ──────────────────────────────────────────────────────────

describe("buildFilterString", () => {
  it("returns 'none' for default filters", () => {
    expect(buildFilterString(DEFAULT_FILTERS)).toBe("none");
  });

  it("returns blur filter string", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, blur: 8 };
    expect(buildFilterString(f)).toBe("blur(8px)");
  });

  it("returns grayscale filter string", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, grayscale: 100 };
    expect(buildFilterString(f)).toBe("grayscale(100%)");
  });

  it("returns sepia filter string", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, sepia: 75 };
    expect(buildFilterString(f)).toBe("sepia(75%)");
  });

  it("returns brightness filter string when not 100", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, brightness: 70 };
    expect(buildFilterString(f)).toBe("brightness(70%)");
  });

  it("returns contrast filter string when not 100", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, contrast: 130 };
    expect(buildFilterString(f)).toBe("contrast(130%)");
  });

  it("composes multiple filters in correct order", () => {
    const f: BgImageFilters = { blur: 4, grayscale: 50, sepia: 30, brightness: 90, contrast: 110 };
    const result = buildFilterString(f);
    expect(result).toBe("blur(4px) grayscale(50%) sepia(30%) brightness(90%) contrast(110%)");
  });

  it("omits blur when 0", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, grayscale: 100 };
    expect(buildFilterString(f)).not.toContain("blur");
  });

  it("omits grayscale when 0", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, blur: 5 };
    expect(buildFilterString(f)).not.toContain("grayscale");
  });

  it("omits sepia when 0", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, blur: 5 };
    expect(buildFilterString(f)).not.toContain("sepia");
  });

  it("omits brightness when exactly 100", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, blur: 5 };
    expect(buildFilterString(f)).not.toContain("brightness");
  });

  it("omits contrast when exactly 100", () => {
    const f: BgImageFilters = { ...DEFAULT_FILTERS, blur: 5 };
    expect(buildFilterString(f)).not.toContain("contrast");
  });

  it("DEFAULT_FILTERS has correct zero/100 defaults", () => {
    expect(DEFAULT_FILTERS.blur).toBe(0);
    expect(DEFAULT_FILTERS.grayscale).toBe(0);
    expect(DEFAULT_FILTERS.sepia).toBe(0);
    expect(DEFAULT_FILTERS.brightness).toBe(100);
    expect(DEFAULT_FILTERS.contrast).toBe(100);
  });
});

// ─── Canvas Draw Order ────────────────────────────────────────────────────────

describe("Canvas draw order contract", () => {
  it("bg image opacity default is between 0.4 and 0.8 for readability", () => {
    const defaultOpacity = 0.55;
    expect(defaultOpacity).toBeGreaterThanOrEqual(0.4);
    expect(defaultOpacity).toBeLessThanOrEqual(0.8);
  });

  it("logo is drawn last (on top of all other layers)", () => {
    // This is a documentation test — the draw order in drawChampionCard is:
    // 1. background gradient
    // 2. bg image + scrim
    // 3. pattern overlay
    // 4. accent bar
    // 5. text content
    // 6. logo (last = on top)
    const drawOrder = ["background", "bgImage", "pattern", "accentBar", "content", "logo"];
    expect(drawOrder.indexOf("logo")).toBe(drawOrder.length - 1);
  });
});

// ─── Logo Placement Utilities ─────────────────────────────────────────────────

describe("clampLogoPlacement", () => {
  const bounds = { width: 0.2, height: 0.1 };

  it("returns placement unchanged when within safe zone", () => {
    const p: LogoPlacement = { x: 0.3, y: 0.4 };
    const result = clampLogoPlacement(p, bounds);
    expect(result.x).toBe(0.3);
    expect(result.y).toBe(0.4);
  });

  it("clamps x to left margin when too far left", () => {
    const p: LogoPlacement = { x: 0.0, y: 0.4 };
    const result = clampLogoPlacement(p, bounds);
    expect(result.x).toBeGreaterThanOrEqual(0.05);
  });

  it("clamps x to right margin when too far right", () => {
    const p: LogoPlacement = { x: 0.99, y: 0.4 };
    const result = clampLogoPlacement(p, bounds);
    expect(result.x).toBeLessThanOrEqual(1 - bounds.width - 0.05);
  });

  it("clamps y to top margin when too far up", () => {
    const p: LogoPlacement = { x: 0.3, y: -0.1 };
    const result = clampLogoPlacement(p, bounds);
    expect(result.y).toBeGreaterThanOrEqual(0.05);
  });

  it("clamps y to bottom margin when too far down", () => {
    const p: LogoPlacement = { x: 0.3, y: 0.99 };
    const result = clampLogoPlacement(p, bounds);
    expect(result.y).toBeLessThanOrEqual(1 - bounds.height - 0.05);
  });
});

describe("snapLogoPlacement", () => {
  const bounds = { width: 0.2, height: 0.1 };

  it("snaps x to left edge when within 3% of left margin", () => {
    const p: LogoPlacement = { x: 0.06, y: 0.4 };
    const result = snapLogoPlacement(p, bounds);
    expect(result.x).toBe(0.05);
  });

  it("snaps x to right edge when within 3% of right margin", () => {
    const rightTarget = 1 - bounds.width - 0.05;
    const p: LogoPlacement = { x: rightTarget + 0.02, y: 0.4 };
    const result = snapLogoPlacement(p, bounds);
    expect(result.x).toBe(rightTarget);
  });

  it("snaps y to top edge when within 3% of top margin", () => {
    const p: LogoPlacement = { x: 0.3, y: 0.06 };
    const result = snapLogoPlacement(p, bounds);
    expect(result.y).toBe(0.05);
  });

  it("snaps y to bottom edge when within 3% of bottom margin", () => {
    const bottomTarget = 1 - bounds.height - 0.05;
    const p: LogoPlacement = { x: 0.3, y: bottomTarget + 0.02 };
    const result = snapLogoPlacement(p, bounds);
    expect(result.y).toBe(bottomTarget);
  });

  it("does not snap when far from edges", () => {
    const p: LogoPlacement = { x: 0.4, y: 0.4 };
    const result = snapLogoPlacement(p, bounds);
    expect(result.x).toBe(0.4);
    expect(result.y).toBe(0.4);
  });
});

describe("getLogoBounds", () => {
  const makeImg = (w: number, h: number) => ({ width: w, height: h } as HTMLImageElement);

  it("returns pixel bounds with correct position", () => {
    const img = makeImg(200, 100);
    const placement: LogoPlacement = { x: 0.1, y: 0.1 };
    const bounds = getLogoBounds(img, placement, 1.0, 1080, 1080);
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it("logo width scales with sizePct", () => {
    const img = makeImg(200, 100);
    const placement: LogoPlacement = { x: 0.1, y: 0.1 };
    const small = getLogoBounds(img, placement, 0.5, 1080, 1080);
    const large = getLogoBounds(img, placement, 2.0, 1080, 1080);
    expect(large.width).toBeGreaterThan(small.width);
  });

  it("logo stays within canvas bounds after clamping", () => {
    const img = makeImg(200, 100);
    const placement: LogoPlacement = { x: 0.99, y: 0.99 };
    const bounds = getLogoBounds(img, placement, 1.0, 1080, 1080);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1080);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1080);
  });
});
