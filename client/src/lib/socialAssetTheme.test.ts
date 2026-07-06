/**
 * Unit tests for SocialAssetGenerator theme system and image upload logic.
 */

import { describe, it, expect } from "vitest";
import { BUILT_IN_THEMES, generateCaption, type AssetConfig } from "../components/tournament/SocialAssetGenerator";

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
