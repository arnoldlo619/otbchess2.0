import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const patternText = readFileSync(resolve(process.cwd(), "client/src/components/ui/pattern-text.tsx"), "utf8");
describe("landing hero pattern text", () => {
  it("uses the supplied reusable pattern treatment for the Over the Board headline line", () => {
    expect(home).toContain('import { PatternText } from "@/components/ui/pattern-text"');
    expect(home).toContain('text-[2.5rem] sm:text-[3.75rem] lg:text-[4.8rem] xl:text-[5rem]');
    expect(home).toContain('<span className="sm:whitespace-nowrap">Chess Tournaments,</span>');
    expect(home).toContain('<PatternText\n                text="Over the Board."');
    expect(home).toContain('className={isDark ? "otb-pattern-text--dark" : "otb-pattern-text--light"}');
    expect(home).not.toContain("<VideoText");
    expect(home).not.toContain("LineShadowText");
  });

  it("keeps the headline semantic and renders its pattern as a decorative duplicate layer", () => {
    expect(patternText).toContain('type PatternTextProps = Omit<ComponentProps<"span">, "children">');
    expect(patternText).toContain("data-shadow={text}");
    expect(patternText).toContain('className={cn("otb-pattern-text", className)}');
    expect(patternText).toContain('<span className="otb-pattern-text__foreground">{text}</span>');
  });

  it("keeps the animated duplicate above the headline surface and behind an explicit foreground layer", () => {
    expect(styles).toContain(".otb-pattern-text::after");
    expect(styles).toContain(".otb-pattern-text__foreground");
    expect(styles).toContain("--otb-pattern-offset: clamp(5px, 0.09em, 10px);");
    expect(styles).toContain("top: var(--otb-pattern-offset);");
    expect(styles).toContain("left: var(--otb-pattern-offset);");
    expect(styles).toContain("z-index: 0;");
    expect(styles).toContain("z-index: 1;");
    expect(styles).toContain("background-size: 0.08em 0.08em;");
    expect(styles).toContain("background-image: linear-gradient(");
    expect(styles).toContain("animation: otb-pattern-text-shift 5s linear infinite;");
    expect(styles).toContain("@keyframes otb-pattern-text-shift");
    expect(styles).toContain("background-position: 0.8em -0.8em;");
    expect(styles).toContain(".otb-pattern-text--dark");
    expect(styles).toContain(".otb-pattern-text--light");
    expect(styles).toContain(".otb-pattern-text::after {\n    animation: none;");
    expect(existsSync(resolve(process.cwd(), "client/public/videos/chess-hero-text-loop.mp4"))).toBe(true);
    expect(home).toContain('const LANDING_CHESS_VIDEO_SOURCE = "/videos/chess-hero-text-loop.mp4"');
  });
});
