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
    expect(wizardSource).toContain('{ label: "Event"');
    expect(wizardSource).toContain("Review the plan below.");
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

  it("keeps single-field stages concise without repeating their field labels", () => {
    const nameStep = wizardSource.slice(
      wizardSource.indexOf("if (step === 0) {"),
      wizardSource.indexOf("if (step === 1) {"),
    );
    const dateStep = wizardSource.slice(
      wizardSource.indexOf("if (step === 1) {"),
      wizardSource.indexOf("if (step === 2) {"),
    );
    const locationStep = wizardSource.slice(
      wizardSource.indexOf("if (step === 2) {"),
      wizardSource.indexOf("if (step === 3) {"),
    );

    expect(nameStep).toContain('ariaLabel="Tournament name"');
    expect(nameStep).not.toContain('<Label isDark={isDark} hint="required">Tournament Name</Label>');
    expect(dateStep).toContain('ariaLabel="Tournament date"');
    expect(dateStep).not.toContain('<Label isDark={isDark}>Date</Label>');
    expect(locationStep).toContain('ariaLabel="Tournament location"');
    expect(locationStep).not.toContain('<Label isDark={isDark} hint="optional">Location</Label>');
  });

  it("uses the shell step context instead of repeating card-level titles or eyebrows", () => {
    const segmentedSteps = wizardSource.slice(
      wizardSource.indexOf("function SegmentedOnboardingStep"),
      wizardSource.indexOf("// ─── Step 1: Details"),
    );

    expect(segmentedSteps).not.toContain(">Tournament name</p>");
    expect(segmentedSteps).not.toContain(">Tournament date</p>");
    expect(segmentedSteps).not.toContain(">Location</p>");
    expect(segmentedSteps).not.toContain(">Tournament settings</p>");
    expect(segmentedSteps).not.toContain(">Time control</p>");
    expect(segmentedSteps).not.toContain(">Platform and ELO</p>");
    expect(segmentedSteps).not.toContain(">Tournament structure</p>");
    expect(segmentedSteps).not.toContain("<h3");
    expect(segmentedSteps).not.toContain("What should players call this event?");
    expect(segmentedSteps).not.toContain("When are you playing?");
    expect(segmentedSteps).not.toContain("Where will the boards be set?");
    expect(segmentedSteps).not.toContain("Build the tournament structure.");
    expect(segmentedSteps).not.toContain("What will you set your clocks to?");
    expect(segmentedSteps).not.toContain("What ratings should shape pairings?");
    expect(wizardSource).toContain('title: "Name your\\ntournament"');
    expect(wizardSource).toContain('title: "When are you\\nplaying?"');
    expect(wizardSource).toContain('title: "Set the\\nlocation"');
    expect(wizardSource).toContain('title: "Shape the\\ncompetition"');
    expect(wizardSource).toContain('title: "Set the\\nclock"');
    expect(wizardSource).toContain('title: "Choose a\\nrating source"');
    expect(wizardSource).toContain('title: "Review the\\nstructure"');
  });

  it("uses the requested three dropdowns for tournament settings", () => {
    expect(wizardSource).toContain('aria-label="Tournament Format"');
    expect(wizardSource).toContain('aria-label="Tournament Rounds"');
    expect(wizardSource).toContain('aria-label="Maximum Players"');
    expect(wizardSource).toContain("selectFormat(event.target.value as WizardData");
  });

  it("uses the streamlined Time Control shell title", () => {
    expect(wizardSource).toContain('title: "Set the\\nclock"');
    expect(wizardSource).not.toContain("What will you set your clocks to?");
    expect(wizardSource).not.toContain("How fast will the clocks run?");
  });

  it("keeps the Tournament Structure preview readable at its active summary scale", () => {
    const preview = wizardSource.slice(
      wizardSource.indexOf("const formatLabel = getTournamentFormatLabel"),
      wizardSource.indexOf("// ─── Brackets Step 1", wizardSource.indexOf("const formatLabel = getTournamentFormatLabel")),
    );

    expect(preview).toContain("text-3xl font-black leading-tight tracking-tight sm:text-4xl");
    expect(preview).toContain("text-base font-bold");
    expect(preview).toContain("text-sm font-bold sm:text-base");
    expect(preview).toContain("text-base font-semibold sm:text-lg");
  });
});
