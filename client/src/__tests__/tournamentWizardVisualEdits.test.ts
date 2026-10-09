import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"),
  "utf8",
);

describe("Tournament Wizard visual edits", () => {
  it("uses the requested concise Quickstart setup copy", () => {
    expect(wizardSource).toContain('body: "Name, date, format, start!"');
    expect(wizardSource).toContain("body: QUICKSTART_HERO.hero.body");
    expect(wizardSource).not.toContain(
      "Just give your tournament a name and location. We'll set up Swiss pairings, 5 rounds, and 10+5 time control",
    );
  });

  it("keeps the shared hero title free of the removed icon container", () => {
    const heroMarkup = wizardSource.slice(
      wizardSource.indexOf("{/* Step content */}"),
      wizardSource.indexOf("{/* Step dots */}"),
    );

    expect(heroMarkup).toContain('className="mb-7"');
    expect(heroMarkup).not.toContain("w-10 h-10 rounded-xl flex items-center justify-center");
    expect(heroMarkup).not.toContain("iconImg ?");
    expect(heroMarkup).not.toContain("<Icon className=");
  });

  it("uses the landing-header wordmark for both desktop and mobile wizard chrome", () => {
    expect(wizardSource).toContain(
      'const TOURNAMENT_WIZARD_LOGO_URL = "/manus-storage/chessotb-wordmark-320_e1731168.webp";',
    );
    expect(wizardSource.match(/src=\{TOURNAMENT_WIZARD_LOGO_URL\}/g)).toHaveLength(2);
    expect(wizardSource).not.toContain("bWANpVvGVfpfXSpZ.png");
    expect(wizardSource).not.toContain("otb-logo-thumbnail_8939ab7b.png");
  });

  it("keeps the common onboarding content at a readable desktop scale", () => {
    const onboarding = wizardSource.slice(
      wizardSource.indexOf("function SegmentedOnboardingStep"),
      wizardSource.indexOf("// ─── Step 1: Details"),
    );

    expect(onboarding).toContain("max-w-3xl rounded-[24px] p-6 sm:p-9");
    expect(onboarding).toContain('className="h-14 w-full appearance-none rounded-2xl px-4 text-base font-semibold outline-none"');
    expect(onboarding).toContain("min-h-[132px] p-5");
    expect(onboarding).toContain('className="mt-1 text-sm leading-relaxed"');
  });
});
