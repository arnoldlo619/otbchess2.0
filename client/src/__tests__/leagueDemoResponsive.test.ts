import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const bracketSource = readFileSync(resolve(clientRoot, "components/LeagueBracket.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");

describe("LeagueDemo responsive containment", () => {
  it("contains the wide bracket inside a keyboard-accessible horizontal region", () => {
    expect(bracketSource).toContain("w-full max-w-full overflow-hidden");
    expect(bracketSource).toContain("overflow-x-auto overscroll-x-contain");
    expect(bracketSource).toContain('role="region"');
    expect(bracketSource).toContain("tabIndex={0}");
    expect(bracketSource).toContain("Scroll horizontally to view later rounds");
  });

  it("shows a mobile and tablet swipe affordance before the fixed-width bracket", () => {
    expect(bracketSource).toContain("Swipe to view the full bracket");
    expect(bracketSource).toContain("lg:hidden");
  });

  it("keeps the mobile league title centered and fully readable", () => {
    expect(demoSource).toContain("pointer-events-none absolute inset-x-16 text-center lg:hidden");
    expect(demoSource).toContain("block whitespace-nowrap text-base font-bold");
    expect(demoSource).toContain("text-[clamp(1.55rem,7vw,2.25rem)]");
  });
});
