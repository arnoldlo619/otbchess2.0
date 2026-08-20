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

  it("uses a premium hover depth treatment and remains safe for reduced motion", () => {
    expect(styles).toContain(".otb-pattern-text--dark");
    expect(styles).toContain(".otb-pattern-text--light");
    expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
    expect(styles).toContain(".otb-pattern-text:hover");
    expect(styles).toContain("transform: translateY(-0.035em) scale(1.012);");
    expect(styles).toContain(".otb-pattern-text:hover::before");
    expect(styles).toContain(".otb-pattern-text::after { transition: none; }");
  });
});
