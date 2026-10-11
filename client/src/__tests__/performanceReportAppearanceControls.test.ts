import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const report = readFileSync(resolve(clientRoot, "pages/Report.tsx"), "utf8");
const playerCard = readFileSync(resolve(clientRoot, "components/PlayerStatsCard.tsx"), "utf8");

describe("Performance Report appearance controls", () => {
  it("offers presets, a native color picker, and validated custom hex entry", () => {
    expect(report).toContain("data-performance-card-accent-picker");
    expect(report).toContain('type="color"');
    expect(report).toContain("normalizeAccentHex(hexInput)");
    expect(report).toContain("Enter a valid hex color, such as #4CAF50.");
    expect(report).toContain('aria-label="Preset accent colors"');
  });

  it("keeps achievement badges in the player identity stack instead of the header overlay", () => {
    expect(playerCard).toContain("data-card-achievement");
    expect(playerCard).toContain('maxWidth: "100%"');
    expect(playerCard).toContain("minHeight: forExport ? 40 : 26");
    expect(playerCard).toContain('fontSize: forExport ? 19 : 11');
    expect(playerCard).toContain('whiteSpace: "normal"');
    expect(playerCard).toContain('overflowWrap: "anywhere"');
    expect(playerCard).not.toContain("/* Badge pill — bottom-left of header */");
  });
});
