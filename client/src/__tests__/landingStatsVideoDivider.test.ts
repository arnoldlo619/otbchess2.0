import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("landing stats video divider", () => {
  it("reuses the local hero chess loop as a decorative, accessible stats background", () => {
    const statsSection = home.slice(
      home.indexOf("function StatsVideoBackground"),
      home.indexOf("// ─── How It Works"),
    );

    expect(home).toContain('const HERO_VIDEO_TEXT_SOURCE = "/videos/chess-hero-text-loop.mp4"');
    expect(statsSection).toContain('data-testid="landing-stats-video"');
    expect(statsSection).toContain("src={HERO_VIDEO_TEXT_SOURCE}");
    expect(statsSection).toContain("autoPlay");
    expect(statsSection).toContain("loop");
    expect(statsSection).toContain("muted");
    expect(statsSection).toContain("playsInline");
    expect(statsSection).toContain('preload="metadata"');
    expect(statsSection).toContain('aria-hidden="true"');
    expect(statsSection).toContain("tabIndex={-1}");
  });

  it("pauses the decorative loop outside the viewport and for reduced motion", () => {
    const statsBackground = home.slice(
      home.indexOf("function StatsVideoBackground"),
      home.indexOf("function StatsBar"),
    );

    expect(statsBackground).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(statsBackground).toContain("IntersectionObserver");
    expect(statsBackground).toContain("video.pause()");
    expect(statsBackground).toContain("void video.play().catch");
    expect(styles).toContain(".landing-stats-video { display: none; }");
  });

  it("keeps the statistics readable above a dedicated forest scrim", () => {
    const statsBar = home.slice(
      home.indexOf("function StatsBar"),
      home.indexOf("// ─── How It Works"),
    );

    expect(statsBar).toContain('data-testid="landing-stats-divider"');
    expect(statsBar).toContain('data-testid="landing-stats-video-scrim"');
    expect(statsBar).toContain("rgba(8,43,24,0.84)");
    expect(statsBar).toContain("rgba(12,64,35,0.76)");
    expect(statsBar).toContain('className="container relative z-10 py-6 sm:py-8"');
    expect(statsBar).toContain('background: "#436850"');
  });
});
