import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const videoText = readFileSync(resolve(process.cwd(), "client/src/components/ui/video-text.tsx"), "utf8");

describe("landing hero video text", () => {
  it("uses the reusable chess video text treatment for the Over the Board headline line", () => {
    expect(home).toContain('import { VideoText } from "@/components/ui/video-text"');
    expect(home).toContain('const HERO_VIDEO_TEXT_SOURCE = "/videos/chess-hero-text-loop.mp4"');
    expect(home).toContain('text-[2.5rem] sm:text-[3.75rem] lg:text-[4.8rem] xl:text-[5rem]');
    expect(home).toContain('<span className="sm:whitespace-nowrap">Chess Tournaments,</span>');
    expect(home).toContain('<VideoText\n                text="Over the Board."');
    expect(home).toContain("src={HERO_VIDEO_TEXT_SOURCE}");
    expect(home).not.toContain("PatternText");
    expect(existsSync(resolve(process.cwd(), "client/public/videos/chess-hero-text-loop.mp4"))).toBe(true);
  });

  it("keeps the headline text accessible with a canvas mask fallback", () => {
    expect(videoText).toContain('className="otb-video-text__fallback">{text}</span>');
    expect(videoText).toContain('aria-hidden="true"');
    expect(videoText).toContain('root.dataset.videoTextReady = "true"');
    expect(videoText).toContain("IntersectionObserver");
    expect(videoText).toContain("ResizeObserver");
    expect(videoText).toContain("requestAnimationFrame");
  });

  it("uses a local silent loop and respects reduced motion", () => {
    expect(videoText).toContain("muted");
    expect(videoText).toContain("loop");
    expect(videoText).toContain("playsInline");
    expect(videoText).toContain('"(prefers-reduced-motion: reduce)"');
    expect(styles).toContain(".otb-video-text[data-video-text-ready] .otb-video-text__canvas");
    expect(styles).toContain(".otb-video-text--dark");
    expect(styles).toContain(".otb-video-text--light");
    expect(styles).toContain(".otb-video-text--light[data-video-text-ready] .otb-video-text__canvas");
    expect(styles).toContain("opacity: 0.58;");
    expect(styles).not.toContain(".otb-pattern-text:hover");
  });
});
