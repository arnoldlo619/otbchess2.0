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
const legacyLandingNav = homeSource.slice(
  homeSource.indexOf("function Nav({"),
  homeSource.indexOf("function Hero", homeSource.indexOf("function Nav({")),
);
const landingFooter = homeSource.slice(
  homeSource.indexOf("function Footer()"),
  homeSource.indexOf("function Home()", homeSource.indexOf("function Footer()")),
);

const retroWordmark = resolve(
  process.cwd(),
  "client/public/brand/otb-retro-cream-green-wordmark.webp",
);
const animeNavbarSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/anime-navbar.tsx"),
  "utf8",
);
const animatedNavThumbnail = resolve(
  process.cwd(),
  "client/public/brand/otb-animated-nav-thumbnail.webp",
);

describe("landing header retro OTB!! wordmark", () => {
  it("uses the supplied local wordmark in the active landing navigation", () => {
    expect(liveLandingHeader).toContain('src="/brand/otb-retro-cream-green-wordmark.webp"');
    expect(liveLandingHeader).toContain('alt="OTB!!"');
    expect(liveLandingHeader).toContain('width={512}');
    expect(liveLandingHeader).toContain('height={341}');
    expect(liveLandingHeader).toContain("sm:h-9");
    expect(liveLandingHeader).toContain('draggable={false}');
    expect(liveLandingHeader).not.toContain("chessotb-wordmark-320_e1731168.webp");
  });

  it("keeps active, legacy, and footer wordmarks local and appropriate to their chrome", () => {
    expect(liveLandingHeader).toContain("nav-logo h-8 w-auto object-contain");
    expect(liveLandingHeader).not.toContain('loading="lazy"');
    expect(legacyLandingNav).toContain('src="/brand/otb-retro-cream-green-wordmark.webp"');
    expect(legacyLandingNav).toContain('alt="OTB Chess Home"');
    expect(landingFooter).toContain('src="/brand/otb-retro-cream-green-wordmark.webp"');
    expect(landingFooter).toContain('loading="lazy"');
    expect(landingFooter).not.toContain("chessotb-wordmark-320_e1731168.webp");
  });

  it("ships the optimized local WebP header asset", () => {
    expect(existsSync(retroWordmark)).toBe(true);
    expect(statSync(retroWordmark).size).toBeGreaterThan(20_000);
  });

  it("keeps the original thumbnail inside the animated pointer while preserving the new far-left wordmark", () => {
    expect(existsSync(animatedNavThumbnail)).toBe(true);
    expect(statSync(animatedNavThumbnail).size).toBeGreaterThan(8_000);
    expect(animeNavbarSource).toContain('const MASCOT_URL = "/brand/otb-animated-nav-thumbnail.webp"');
    expect(animeNavbarSource).not.toContain('const MASCOT_URL = "/brand/otb-retro-app-icon-512.png"');
    expect(liveLandingHeader).toContain('src="/brand/otb-retro-cream-green-wordmark.webp"');
  });
});
