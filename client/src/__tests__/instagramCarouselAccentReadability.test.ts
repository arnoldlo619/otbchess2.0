import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_THEMES, CAROUSEL_BRAND } from "@/components/InstagramCarouselModal";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/InstagramCarouselModal.tsx"),
  "utf8"
);

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex, `Missing source boundary: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `Missing source boundary: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));

  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Instagram recap carousel accent readability", () => {
  it("uses the warm off-white brand token as the default Classic secondary accent", () => {
    const classicTheme = sourceBetween('id: "classic-green"', 'id: "midnight-blue"');

    expect(source).toContain('offWhite: "#FBFADA"');
    expect(classicTheme).toContain("accentLight: BRAND.offWhite");
  });

  it("keeps every built-in palette secondary accent at WCAG AA contrast against its brightest canvas tone", () => {
    expect(ALL_THEMES).toHaveLength(9);

    ALL_THEMES.forEach((theme) => {
      expect(
        contrastRatio(theme.accentLight, theme.bg),
        `${theme.label} accentLight should be readable over ${theme.bg}`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("keeps podium, result, and ranking text colors readable in every palette", () => {
    const visualRankColors = [CAROUSEL_BRAND.white, CAROUSEL_BRAND.gold, CAROUSEL_BRAND.silver, CAROUSEL_BRAND.bronze];

    ALL_THEMES.forEach((theme) => {
      visualRankColors.forEach((color) => {
        expect(
          contrastRatio(color, theme.bg),
          `${color} should be readable over ${theme.label}`
        ).toBeGreaterThanOrEqual(4.5);
      });
    });

    expect(contrastRatio("#8BE8AF", "#2D5A3A")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FF8F8F", "#5A2D2D")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#F2C94C", "#3A3A1A")).toBeGreaterThanOrEqual(4.5);
  });

  it("routes standard slide metadata and stats through the selected theme accent", () => {
    const standardSlides = sourceBetween("function Slide1Cover(", "// ─── Slide registry");
    const statsSlide = sourceBetween("function Slide4Stats(", "// ─── Slide 5 — CTA");

    expect(standardSlides.match(/color: theme\.accentLight/g)?.length ?? 0).toBeGreaterThanOrEqual(40);
    expect(statsSlide).toContain('{ label: "Players", value: String(rows.length), sub: "registered" }');
    expect(statsSlide).toContain('{ label: "Rounds", value: String(totalRounds), sub: formatFormat(config?.format) }');
    expect(statsSlide).toContain('{ label: "Avg ELO", value: String(avgElo(rows)), sub: "rating" }');
    expect(statsSlide).toContain('{ label: "Games", value: String(totalGames), sub: "played" }');
    expect(statsSlide).toContain("color: theme.accentLight");
    expect(statsSlide).not.toMatch(/color: "rgba\(255,255,255,0\.(25|28|3|32|35|38|4|42|45|55)\)"/);
  });

  it("keeps exported slide counters and footer metadata within the same readable accent system", () => {
    const counter = sourceBetween("function SlideCounter(", "const TOTAL_SLIDES");
    const footer = sourceBetween("function OTBBrand(", "// ─── Slide counter badge");

    expect(counter).toContain("theme?: SlideTheme");
    expect(counter).toContain("color: theme.accentLight");
    expect(footer).toContain("color: theme.accentLight");
  });

  it("removes weak gray text from rows and retains a strong photo-background scrim", () => {
    const standingsSlide = sourceBetween("function Slide3Standings(", "// ─── Slide 4 — Stats");
    const roundsSlide = sourceBetween("function Slide6RoundResults(", "// ─── Slide 7");
    const wrapper = sourceBetween("function SlideWrapper(", "/** OTB brand footer");

    expect(standingsSlide).not.toContain('color: "rgba(255,255,255,0.52)"');
    expect(standingsSlide).not.toContain('"rgba(255,255,255,0.45)"');
    expect(roundsSlide).not.toContain('"rgba(255,255,255,0.40)"');
    expect(roundsSlide).not.toContain('color: "rgba(255,255,255,0.15)"');
    expect(roundsSlide).toContain('color: "#8BE8AF"');
    expect(roundsSlide).toContain('color: "#FF8F8F"');
    expect(wrapper).toContain("background: IMAGE_TEXT_SCRIM");
    expect(source).toContain('const IMAGE_TEXT_SCRIM = "rgba(0,0,0,0.80)"');
  });
});
