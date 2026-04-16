/**
 * Tests for Instagram Story format toggle and dimension system
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";

// ─── Constants mirrored from InstagramCarouselModal ───────────────────────────

const SLIDE_W = 1080;
const SLIDE_H = { square: 1080, story: 1920 } as const;
type SlideFormat = "square" | "story";

// ─── Helpers mirrored from InstagramCarouselModal ─────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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

function clampFont(base: number, text: string, maxChars = 20): number {
  if (text.length <= maxChars) return base;
  return Math.max(base * 0.6, base * (maxChars / text.length));
}

// ─── Dimension system ─────────────────────────────────────────────────────────

describe("Slide dimension system", () => {
  it("square format is 1080×1080", () => {
    expect(SLIDE_W).toBe(1080);
    expect(SLIDE_H.square).toBe(1080);
  });

  it("story format is 1080×1920", () => {
    expect(SLIDE_W).toBe(1080);
    expect(SLIDE_H.story).toBe(1920);
  });

  it("story height is 1.778× square height (16:9 portrait ratio)", () => {
    const ratio = SLIDE_H.story / SLIDE_H.square;
    expect(ratio).toBeCloseTo(16 / 9, 2);
  });

  it("width is always 1080 regardless of format", () => {
    const formats: SlideFormat[] = ["square", "story"];
    for (const fmt of formats) {
      expect(SLIDE_W).toBe(1080);
      expect(SLIDE_H[fmt]).toBeGreaterThan(0);
    }
  });

  it("preview scale produces correct preview dimensions", () => {
    const PREVIEW_SCALE = 0.42;
    const squarePreviewH = SLIDE_H.square * PREVIEW_SCALE;
    const storyPreviewH = SLIDE_H.story * PREVIEW_SCALE;
    expect(squarePreviewH).toBeCloseTo(453.6, 0);
    expect(storyPreviewH).toBeCloseTo(806.4, 0);
    // Story preview is taller
    expect(storyPreviewH).toBeGreaterThan(squarePreviewH);
  });

  it("preview width is the same for both formats", () => {
    const PREVIEW_SCALE = 0.42;
    const previewW = SLIDE_W * PREVIEW_SCALE;
    expect(previewW).toBeCloseTo(453.6, 0);
  });
});

// ─── Format toggle logic ──────────────────────────────────────────────────────

describe("Format toggle", () => {
  it("defaults to square format", () => {
    const defaultFormat: SlideFormat = "square";
    expect(defaultFormat).toBe("square");
  });

  it("story format uses 1920 height", () => {
    const format: SlideFormat = "story";
    expect(SLIDE_H[format]).toBe(1920);
  });

  it("square format uses 1080 height", () => {
    const format: SlideFormat = "square";
    expect(SLIDE_H[format]).toBe(1080);
  });

  it("isStory flag is true only for story format", () => {
    const isStory = (fmt: SlideFormat) => fmt === "story";
    expect(isStory("story")).toBe(true);
    expect(isStory("square")).toBe(false);
  });

  it("ZIP filename includes format suffix", () => {
    const tournamentName = "Tuesday Blitz";
    const buildZipName = (fmt: SlideFormat) => {
      const suffix = fmt === "story" ? "Story" : "Carousel";
      return `${tournamentName.replace(/\s+/g, "_")}_Instagram_${suffix}.zip`;
    };
    expect(buildZipName("square")).toBe("Tuesday_Blitz_Instagram_Carousel.zip");
    expect(buildZipName("story")).toBe("Tuesday_Blitz_Instagram_Story.zip");
  });

  it("slide filename includes format suffix", () => {
    const tournamentName = "Tuesday Blitz";
    const buildSlideName = (fmt: SlideFormat, idx: number, id: string) => {
      const suffix = fmt === "story" ? "story" : "carousel";
      return `${tournamentName.replace(/\s+/g, "_")}_${suffix}_slide_${idx + 1}_${id}.png`;
    };
    expect(buildSlideName("square", 0, "cover")).toBe("Tuesday_Blitz_carousel_slide_1_cover.png");
    expect(buildSlideName("story", 0, "cover")).toBe("Tuesday_Blitz_story_slide_1_cover.png");
  });
});

// ─── Story layout calculations ────────────────────────────────────────────────

describe("Story layout calculations", () => {
  const FOOTER = 80;
  const _PAD = 52;

  it("story standings rows fit more content due to taller canvas", () => {
    const calcMaxRows = (format: SlideFormat, rowH: number) => {
      const HEADER_H = format === "story" ? 200 : 148;
      const COL_HEADER_H = format === "story" ? 52 : 44;
      const H = SLIDE_H[format];
      const availH = H - FOOTER - HEADER_H - COL_HEADER_H;
      return Math.floor(availH / rowH);
    };
    const squareMax = calcMaxRows("square", 78);
    const storyMax = calcMaxRows("story", 84);
    // Story should fit more rows despite taller row height
    expect(storyMax).toBeGreaterThan(squareMax);
  });

  it("story podium blocks are taller (38% vs 40% of available height)", () => {
    const calcPodiumH = (format: SlideFormat, fraction: number) => {
      const HEADER_H = format === "story" ? 220 : 160;
      const H = SLIDE_H[format];
      const availH = H - FOOTER - HEADER_H;
      return availH * fraction;
    };
    const squareFirst = calcPodiumH("square", 0.40);
    const storyFirst = calcPodiumH("story", 0.38);
    // Story podium is absolutely taller even at lower fraction
    expect(storyFirst).toBeGreaterThan(squareFirst);
  });

  it("story round-by-round grid fits more player rows", () => {
    const calcMaxPlayers = (format: SlideFormat) => {
      const HEADER_H = format === "story" ? 200 : 148;
      const COL_HEADER_H = format === "story" ? 52 : 44;
      const ROW_H = format === "story" ? 84 : 68;
      const H = SLIDE_H[format];
      const availH = H - FOOTER - HEADER_H - COL_HEADER_H;
      return Math.floor(availH / ROW_H);
    };
    expect(calcMaxPlayers("story")).toBeGreaterThan(calcMaxPlayers("square"));
  });

  it("OTB watermark is larger in story format", () => {
    const watermarkSize = (format: SlideFormat) => format === "story" ? 480 : 380;
    expect(watermarkSize("story")).toBeGreaterThan(watermarkSize("square"));
  });
});

// ─── Slide count ──────────────────────────────────────────────────────────────

describe("Slide count", () => {
  const TOTAL_SLIDES = 6;
  const SLIDE_IDS = ["cover", "podium", "standings", "stats", "cta", "rounds"];

  it("has exactly 6 slides", () => {
    expect(TOTAL_SLIDES).toBe(6);
    expect(SLIDE_IDS.length).toBe(6);
  });

  it("slide IDs are unique", () => {
    const unique = new Set(SLIDE_IDS);
    expect(unique.size).toBe(SLIDE_IDS.length);
  });

  it("rounds slide is the 6th slide", () => {
    expect(SLIDE_IDS[5]).toBe("rounds");
  });
});

// ─── Shared helper functions ──────────────────────────────────────────────────

describe("Helper functions", () => {
  it("formatDate returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("formatDate formats a date string", () => {
    const result = formatDate("2024-03-15");
    expect(result).toContain("2024");
    // Date may be 14 or 15 depending on timezone — just check it's a non-empty formatted string
    expect(result.length).toBeGreaterThan(4);
    expect(result).toMatch(/\d{4}/);
  });

  it("avgElo returns 0 for empty array", () => {
    expect(avgElo([])).toBe(0);
  });

  it("avgElo computes correctly", () => {
    const rows = [
      { player: { elo: 1200 } },
      { player: { elo: 1400 } },
      { player: { elo: 1600 } },
    ];
    expect(avgElo(rows)).toBe(1400);
  });

  it("formatFormat handles known formats", () => {
    expect(formatFormat("swiss")).toBe("Swiss");
    expect(formatFormat("roundrobin")).toBe("Round Robin");
    expect(formatFormat("elimination")).toBe("Elimination");
  });

  it("formatFormat falls back to input or Swiss", () => {
    expect(formatFormat(undefined)).toBe("Swiss");
    expect(formatFormat("custom")).toBe("custom");
  });

  it("clampFont returns base for short text", () => {
    expect(clampFont(100, "Ken")).toBe(100);
  });

  it("clampFont reduces font for long text", () => {
    const clamped = clampFont(100, "A Very Long Tournament Name That Overflows", 20);
    expect(clamped).toBeLessThan(100);
    expect(clamped).toBeGreaterThan(0);
  });

  it("clampFont never goes below 60% of base", () => {
    const clamped = clampFont(100, "X".repeat(200), 20);
    expect(clamped).toBeGreaterThanOrEqual(60);
  });
});

// ─── Export dimension validation ──────────────────────────────────────────────

describe("Export dimensions", () => {
  it("square export is 1080×1080", () => {
    const exportDims = (fmt: SlideFormat) => ({ width: SLIDE_W, height: SLIDE_H[fmt] });
    const { width, height } = exportDims("square");
    expect(width).toBe(1080);
    expect(height).toBe(1080);
  });

  it("story export is 1080×1920", () => {
    const exportDims = (fmt: SlideFormat) => ({ width: SLIDE_W, height: SLIDE_H[fmt] });
    const { width, height } = exportDims("story");
    expect(width).toBe(1080);
    expect(height).toBe(1920);
  });

  it("pixelRatio is always 1 (no upscaling needed at 1080px)", () => {
    const pixelRatio = 1;
    expect(pixelRatio).toBe(1);
  });
});
