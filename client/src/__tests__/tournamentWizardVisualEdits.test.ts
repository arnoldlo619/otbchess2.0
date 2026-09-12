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

    expect(heroMarkup).toContain('className="mb-6"');
    expect(heroMarkup).not.toContain("w-10 h-10 rounded-xl flex items-center justify-center");
    expect(heroMarkup).not.toContain("iconImg ?");
    expect(heroMarkup).not.toContain("<Icon className=");
  });
});
