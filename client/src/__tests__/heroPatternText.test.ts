import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const lineShadowText = readFileSync(resolve(process.cwd(), "client/src/components/ui/line-shadow-text.tsx"), "utf8");

describe("landing hero line-shadow text", () => {
  it("uses the reusable line-shadow treatment for the Over the Board headline line", () => {
    expect(home).toContain('import { LineShadowText } from "@/components/ui/line-shadow-text"');
    expect(home).toContain('text-[2.5rem] sm:text-[3.75rem] lg:text-[4.8rem] xl:text-[5rem]');
    expect(home).toContain('<span className="sm:whitespace-nowrap">Chess Tournaments,</span>');
    expect(home).toContain('<LineShadowText\n                text="Over the Board."');
    expect(home).toContain('className={isDark ? "otb-line-shadow-text--dark" : "otb-line-shadow-text--light"}');
    expect(home).not.toContain("<VideoText");
    expect(home).not.toContain("PatternText");
  });

  it("keeps the headline semantic and renders its line effect as a decorative duplicate layer", () => {
    expect(lineShadowText).toContain('type LineShadowTextProps = Omit<ComponentProps<"span">, "children">');
    expect(lineShadowText).toContain("data-shadow={text}");
    expect(lineShadowText).toContain('className={cn("otb-line-shadow-text", className)}');
    expect(lineShadowText).toContain('className="otb-line-shadow-text__foreground">{text}</span>');
  });

  it("uses slow theme-aware line motion with a reduced-motion fallback", () => {
    expect(styles).toContain(".otb-line-shadow-text::after");
    expect(styles).toContain(".otb-line-shadow-text__foreground");
    expect(styles).toContain("repeating-linear-gradient(");
    expect(styles).toContain("animation: otb-line-shadow-scan 12s linear infinite;");
    expect(styles).toContain("@keyframes otb-line-shadow-scan");
    expect(styles).toContain(".otb-line-shadow-text--dark");
    expect(styles).toContain(".otb-line-shadow-text--light");
    expect(styles).toContain(".otb-line-shadow-text::after {\n    animation: none;");
    expect(existsSync(resolve(process.cwd(), "client/public/videos/chess-hero-text-loop.mp4"))).toBe(true);
    expect(home).toContain('const LANDING_CHESS_VIDEO_SOURCE = "/videos/chess-hero-text-loop.mp4"');
  });
});
