import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"),
  "utf8",
);

describe("Tournament Wizard segmented onboarding", () => {
  it("uses the requested focused sequence before creation", () => {
    const stages = wizardSource.slice(
      wizardSource.indexOf("const ONBOARDING_STEPS = ["),
      wizardSource.indexOf("] as const;", wizardSource.indexOf("const ONBOARDING_STEPS = [")),
    );

    expect(stages).toContain('label: "Name"');
    expect(stages).toContain('label: "Date"');
    expect(stages).toContain('label: "Location"');
    expect(stages).toContain('label: "Settings"');
    expect(stages).toContain('label: "Time control"');
    expect(stages).toContain('label: "Ratings"');
    expect(stages).toContain('label: "Preview"');
    expect(wizardSource).toContain("const quickstartStepCount = ONBOARDING_STEPS.length + 1");
  });

  it("renders a distinct focused step component rather than the legacy all-at-once Quickstart form", () => {
    expect(wizardSource).toContain("function SegmentedOnboardingStep");
    expect(wizardSource).toContain("mode === \"quickstart\" && step < ONBOARDING_STEPS.length");
    expect(wizardSource).toContain("<SegmentedOnboardingStep");
    expect(wizardSource).not.toContain('mode === "quickstart" && step === 0 && <QuickstartForm');
  });

  it("routes standard Schedule Tournament entry and legacy schedule drafts through the shared flow", () => {
    expect(wizardSource).toContain('draft?.mode === "schedule" ? "quickstart"');
    expect(wizardSource).toContain('if (m === "quickstart" || m === "schedule")');
    expect(wizardSource).toContain('setMode("quickstart")');
  });

  it("creates a reviewable tournament structure before the share handoff", () => {
    expect(wizardSource).toContain("Tournament structure");
    expect(wizardSource).toContain('data.name.trim() || "Your tournament"');
    expect(wizardSource).toContain("is ready to create.");
    expect(wizardSource).toContain("Create Tournament");
    expect(wizardSource).toContain("quickstartStepCount - 1");
  });

  it("keeps required name, date, and time-control validation in the segmented flow", () => {
    const validation = wizardSource.slice(
      wizardSource.indexOf("const canAdvance ="),
      wizardSource.indexOf("// registerTournamentNow", wizardSource.indexOf("const canAdvance =")),
    );

    expect(validation).toContain("data.name.trim().length > 0");
    expect(validation).toContain("data.date.trim().length > 0");
    expect(validation).toContain("data.timePreset.trim().length > 0");
  });

  it("uses the requested three dropdowns for tournament settings", () => {
    expect(wizardSource).toContain('aria-label="Tournament Format"');
    expect(wizardSource).toContain('aria-label="Tournament Rounds"');
    expect(wizardSource).toContain('aria-label="Maximum Players"');
    expect(wizardSource).toContain("selectFormat(event.target.value as WizardData");
  });
});
