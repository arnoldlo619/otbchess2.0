import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8",
);

const liveLandingHeader = homeSource.slice(
  homeSource.indexOf("const logoEl = ("),
  homeSource.indexOf("const isGuestUser =", homeSource.indexOf("const logoEl = (")),
);

const retroWordmark = resolve(
  process.cwd(),
  "client/public/brand/otb-retro-cream-green-wordmark.webp",
);

describe("landing header retro OTB!! wordmark", () => {
  it("uses the supplied local wordmark in the live landing navigation", () => {
    expect(liveLandingHeader).toContain('src="/brand/otb-retro-cream-green-wordmark.webp"');
    expect(liveLandingHeader).toContain('alt="OTB!!"');
    expect(liveLandingHeader).not.toContain("chessotb-wordmark-320_e1731168.webp");
  });

  it("keeps the wordmark compact, responsive, eager, and layout-stable", () => {
    expect(liveLandingHeader).toContain('width={512}');
    expect(liveLandingHeader).toContain('height={341}');
    expect(liveLandingHeader).toContain("nav-logo h-8 w-auto object-contain");
    expect(liveLandingHeader).toContain("sm:h-9");
    expect(liveLandingHeader).toContain('draggable={false}');
    expect(liveLandingHeader).not.toContain('loading="lazy"');
  });

  it("ships the optimized local WebP header asset", () => {
    expect(existsSync(retroWordmark)).toBe(true);
    expect(statSync(retroWordmark).size).toBeGreaterThan(20_000);
  });
});
