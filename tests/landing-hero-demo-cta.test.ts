import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("landing hero live tournament demo CTA", () => {
  it("uses the highlight pill as the single live tournament demo entry point", () => {
    expect(home).toContain('label="LIVE"');
    expect(home).toContain('text="View Live Tournament Demo!"');
    expect(home).toContain('href="/tournament/otb-demo-2026/manage"');
  });

  it("does not retain the redundant demo dashboard action below the primary CTAs", () => {
    expect(home).not.toContain("View Live Demo Dashboard");
    expect(home).not.toContain("Bottom group: CTAs + View live demo");
  });
});
