import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/HeroDashboardMockup.tsx"),
  "utf8",
);

describe("HeroDashboardMockup", () => {
  it("uses a viewport-aware wide display frame without changing the full-width image contract", () => {
    expect(source).toContain("data-hero-dashboard-mockup");
    expect(source).toContain("max-w-[82rem]");
    expect(source).toContain("w-[calc(100vw-2rem)]");
    expect(source).toContain("sm:w-[calc(100vw-3rem)]");
    expect(source).toContain("lg:w-[calc(100vw-4rem)]");
    expect(source).toContain("data-hero-dashboard-mockup-frame");
    expect(source).toContain("w-full h-full rounded-[inherit] object-cover object-top block");
  });
});
