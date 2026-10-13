import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("Instagram recap carousel accent readability", () => {
  it("uses the warm off-white brand token as the default Classic secondary accent", () => {
    const classicTheme = sourceBetween('id: "classic-green"', 'id: "midnight-blue"');

    expect(source).toContain('offWhite: "#FBFADA"');
    expect(classicTheme).toContain("accentLight: BRAND.offWhite");
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
});
