import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("landing hero pattern text", () => {
  it("uses the reusable pattern treatment for the Over The Board headline line", () => {
    expect(home).toContain('import { PatternText } from "@/components/ui/pattern-text"');
    expect(home).toContain('<PatternText\n                text="Over The Board."');
  });

  it("uses a visible compositor-friendly accent treatment and remains safe for reduced motion", () => {
    expect(styles).toContain("@keyframes otb-pattern-text-breathe");
    expect(styles).toContain(".otb-pattern-text--dark");
    expect(styles).toContain(".otb-pattern-text--light");
    expect(styles).toContain("will-change: opacity;");
    expect(styles).toContain(".otb-pattern-text::after { animation: none; }");
    expect(styles).not.toContain("otb-pattern-text-scan");
  });
});
