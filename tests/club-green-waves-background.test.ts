import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const picker = read("client/src/components/ClubBackgroundPicker.tsx");
const waves = read("client/src/components/GreenWaves.tsx");
const dashboard = read("client/src/pages/ClubDashboard.tsx");
const hero = read("client/src/components/club/ClubHero.tsx");

describe("Green Waves club background template", () => {
  it("exposes a named, accessible selectable template in club settings", () => {
    expect(picker).toContain('export const GREEN_WAVES_BG_VALUE = "__green_waves__"');
    expect(picker).toContain("Green Waves animated background");
    expect(picker).toContain("Green Waves");
    expect(picker).toContain("aria-pressed={greenWavesSelected}");
  });

  it("uses a visibility-aware WebGL renderer that honors reduced-motion preferences", () => {
    expect(waves).toContain('canvas.getContext("webgl"');
    expect(waves).toContain("prefers-reduced-motion: reduce");
    expect(waves).toContain("IntersectionObserver");
    expect(waves).toContain('document.addEventListener("visibilitychange"');
    expect(waves).toContain("WEBGL_lose_context");
  });

  it("renders Green Waves on the owner workspace and aligns dashboard chrome to its forest palette", () => {
    expect(dashboard).toContain("const isGreenWavesBg = clubBgImage === GREEN_WAVES_BG_VALUE");
    expect(dashboard).toContain('<GreenWaves className="w-full h-full" />');
    expect(dashboard).toContain('? "#12391d"');
    expect(dashboard).toContain("!isGreenWavesBg && clubBgImage");
  });

  it("renders Green Waves in the public club hero while retaining uploaded banner priority", () => {
    expect(hero).toContain("const isGreenWaves = !bannerUrl && backgroundImage === GREEN_WAVES_BG_VALUE");
    expect(hero).toContain("const heroBg = (isSilk || isGreenWaves) ? null : (bannerUrl || backgroundImage || null)");
    expect(hero).toContain('<GreenWaves className="w-full h-full" />');
  });
});
