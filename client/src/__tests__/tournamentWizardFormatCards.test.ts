import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"),
  "utf8",
);

describe("Tournament Wizard format-card appearance", () => {
  it("keeps the single concise format-selection instruction", () => {
    expect(wizardSource).toContain("Choose a format to get started.");
    expect(wizardSource).not.toContain("How would you like to get started?");
  });

  it("uses high-contrast dark surfaces for all reusable tournament format cards", () => {
    expect(wizardSource).toContain('background: "linear-gradient(145deg, oklch(0.245 0.055 145) 0%, oklch(0.205 0.045 145) 100%)"');
    expect(wizardSource).toContain('text-white sm:text-[28px]');
    expect(wizardSource).toContain('text-white/62 sm:text-sm');
    expect(wizardSource).toContain('bg-[oklch(0.17_0.035_145)]');
    expect(wizardSource).toContain('focus-visible:ring-[#71dc8a]');
    expect(wizardSource).not.toContain('background: "#f5f0e6"');
  });

  it("retains semantic card selection and four format options", () => {
    expect(wizardSource).toContain("aria-pressed={isSelected}");
    expect(wizardSource).toContain('mode="quickstart"');
    expect(wizardSource).toContain('mode="quads"');
    expect(wizardSource).toContain('mode="large_event"');
    expect(wizardSource).toContain('mode="schedule"');
  });

  it("takes a selected format straight into its setup flow without rendering the Format Preview interstitial", () => {
    expect(wizardSource).toContain("<ModeSelect isDark={isDark} onSelect={handleSelectMode} onClose={onClose} />");
    expect(wizardSource).not.toContain("function FormatPreview");
    expect(wizardSource).not.toContain("FORMAT PREVIEW");
    expect(wizardSource).not.toContain("Change format");
    expect(wizardSource).not.toContain("previewMode");
    expect(wizardSource).toContain('setMode("quickstart")');
    expect(wizardSource).toContain("setMode(m)");
  });

  it("keeps the direct-selection screen usable across mobile and desktop breakpoints", () => {
    expect(wizardSource).toContain('grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6');
    expect(wizardSource).toContain('aria-label={`${title}. ${description}`}');
    expect(wizardSource).toContain('focus-visible:ring-[#71dc8a]');
    expect(wizardSource).toContain('touchAction: "manipulation"');
  });
});
