import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "../components/InstagramCarouselModal.tsx"),
  "utf8",
);

function indexOfOrThrow(needle: string): number {
  const index = source.indexOf(needle);
  expect(index, `Expected carousel source to include ${needle}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("Instagram carousel editor control hierarchy", () => {
  it("puts premium defaults immediately after the Club / Host Logo workflow", () => {
    const logoIndex = indexOfOrThrow("{/* ── Host Logo Upload ── */}");
    const premiumIndex = indexOfOrThrow("data-carousel-premium-defaults");
    const visualStyleIndex = indexOfOrThrow("data-carousel-visual-style");

    expect(logoIndex).toBeLessThan(premiumIndex);
    expect(premiumIndex).toBeLessThan(visualStyleIndex);
  });

  it("consolidates palette and canvas choices into one Visual style panel", () => {
    const panelIndex = indexOfOrThrow('data-carousel-visual-style aria-labelledby="carousel-visual-style"');
    const visualStyleEnd = source.indexOf("{/* ── Typography Panel ── */}", panelIndex);
    const visualStyle = source.slice(panelIndex, visualStyleEnd);

    expect(visualStyle).toContain("Visual style");
    expect(visualStyle).toContain("Theme palette");
    expect(visualStyle).toContain("Background treatment");
    expect(visualStyle).not.toContain("Slide Colour Theme");
  });

  it("keeps all background treatments available with an explicit selected state", () => {
    const backgroundIndex = indexOfOrThrow("data-carousel-background-type");
    const background = source.slice(backgroundIndex, backgroundIndex + 1300);

    expect(background).toContain('(["gradient", "solid", "image"] as BgType[])');
    expect(background).toContain("aria-pressed={bgType === t}");
    expect(background).toContain('aria-label={`Use ${t === "image" ? "an" : "a"} ${t} background`}');
  });

  it("makes premium default and theme palette selection discoverable to assistive technology", () => {
    const premiumIndex = indexOfOrThrow("data-carousel-premium-defaults");
    const premium = source.slice(premiumIndex, premiumIndex + 5500);
    const visualIndex = indexOfOrThrow("data-carousel-visual-style");
    const visual = source.slice(visualIndex, visualIndex + 3600);

    expect(premium).toContain("aria-label={`Apply ${prem.name} premium default`}");
    expect(visual).toContain("aria-pressed={isActive}");
    expect(visual).toContain("aria-label={`Use ${t.label} theme palette`}");
    expect(visual).toContain("focus-visible:ring-2");
  });
});
