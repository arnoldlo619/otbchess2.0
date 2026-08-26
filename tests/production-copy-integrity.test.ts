import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("production copy integrity", () => {
  it("uses explicit unavailable-state copy instead of visible N/A rating placeholders", () => {
    const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
    const prepExportCard = readFileSync(resolve(root, "client/src/components/prep/PrepExportCard.tsx"), "utf8");

    expect(home).toContain('"No rating available"');
    expect(home).not.toContain('profile.bullet || "N/A"');
    expect(prepExportCard).toContain('["Avg rating", avgRating ?? "Not available"]');
    expect(prepExportCard).not.toContain('["Avg rating", avgRating ?? "N/A"]');
  });
});
