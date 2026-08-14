import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("Create a Tournament card system", () => {
  it("applies the premium shared card treatment to all four tournament modes", () => {
    expect(wizard).toContain("tournament-mode-card--quickstart");
    expect(wizard).toContain("tournament-mode-card--schedule");
    expect(wizard).toContain("tournament-mode-card--large");
    expect(wizard).toContain("tournament-mode-card--quads");
    expect((wizard.match(/tournament-mode-card__icon/g) ?? []).length).toBe(4);
  });

  it("keeps every mode a native accessible button with its original selection action", () => {
    expect(wizard).toContain('onClick={() => onSelect("quickstart")}');
    expect(wizard).toContain('onClick={() => onSelect("schedule")}');
    expect(wizard).toContain('onClick={() => onSelect("large_event")}');
    expect(wizard).toContain('onClick={() => onSelect("quads")}');
    expect((wizard.match(/aria-label=/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("uses reduced-motion-safe premium card styling", () => {
    expect(styles).toContain(".tournament-mode-card");
    expect(styles).toContain(".tournament-mode-card:hover");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
