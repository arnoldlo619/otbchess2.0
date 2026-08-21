import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8",
);

describe("Chess Integration video background", () => {
  it("uses a visible thumbnail fallback behind the privacy-friendly embedded video", () => {
    expect(homeSource).toContain("https://i.ytimg.com/vi/KEi0wr1vRG8/maxresdefault.jpg");
    expect(homeSource).toContain("https://www.youtube-nocookie.com/embed/KEi0wr1vRG8");
    expect(homeSource).toContain("ChessOTB tournament background video");
  });

  it("keeps the video perceptible while retaining a text-protection overlay", () => {
    expect(homeSource).toContain("opacity: isDark ? 0.62 : 0.5");
    expect(homeSource).toContain("linear-gradient(90deg, oklch(0.16 0.05 145 / 0.62)");
  });
});
