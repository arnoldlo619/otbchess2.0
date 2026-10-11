import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/InstagramCarouselModal.tsx"),
  "utf8"
);

describe("Instagram Story composition", () => {
  it("keeps the 1080×1920 Story canvas while reserving a branded safe footer", () => {
    expect(source).toContain("story: 1920");
    expect(source).toContain("const FOOTER = (format === \"story\" ? 104 : 80) * s;");
    expect(source).toContain("const FOOTER = (isStory ? 120 : 80) * s;");
    expect(source).toContain("const FOOTER = (isStory ? 110 : 80) * s;");
  });

  it("uses a deliberately larger Story composition for every standard slide", () => {
    expect(source).toContain("width: isStory ? 320 * s : 200 * s");
    expect(source).toContain("const HEADER_H = isStory ? 380 * s : 160 * s;");
    expect(source).toContain("const podiumHeightFrac = isStory ? [0.40, 0.56, 0.34]");
    expect(source).toContain("const HEADER_H = isStory ? 300 * s : 180 * s;");
    expect(source).toContain("const hSize4 = Math.min(headingSize, isStory ? 104 : 72) * s;");
    expect(source).toContain("const hSize5 = Math.min(headingSize, isStory ? 144 : 100) * s;");
    expect(source).toContain("const hSize6 = Math.min(headingSize, isStory ? 104 : 74) * s;");
  });

  it("expands elimination Story results without changing square card dimensions", () => {
    expect(source).toContain("const CONTENT_TOP = isStory ? 320 * s : 100 * s;");
    expect(source).toContain("const CHAMP_H = isStory ? 480 * s : 280 * s;");
    expect(source).toContain("const CARD_H = isStory ? 240 * s : 150 * s;");
    expect(source).toContain("const CARD_GAP = (isStory ? 22 : 16) * s;");
  });
});
