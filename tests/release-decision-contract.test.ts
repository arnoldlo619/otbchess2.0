import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const currentReport = readFileSync(resolve(process.cwd(), "RELEASE_DECISION_2026-08-25.md"), "utf8");
const historicalReport = readFileSync(resolve(process.cwd(), "RELEASE_REPORT_PHASE6.md"), "utf8");

describe("current release decision contract", () => {
  it("keeps controlled beta conditional and blocks broad paid launch", () => {
    expect(currentReport).toContain("CONDITIONAL GO for controlled free-beta onboarding");
    expect(currentReport).toContain("NO-GO for broad paid marketing or paid membership launch");
    expect(currentReport).toContain("P0-01");
    expect(currentReport).toContain("P1-01");
    expect(currentReport).toContain("P1-03");
  });

  it("contains deployment, rollback, evidence, and reference sections", () => {
    expect(currentReport).toContain("## Deployment checklist");
    expect(currentReport).toContain("## Rollback plan");
    expect(currentReport).toContain("## Evidence snapshot");
    expect(currentReport).toContain("## References");
    expect(currentReport).toContain("GitHub `main`");
    expect(currentReport).toContain("Stripe checkout");
  });

  it("marks the stale Phase 6 verdict as superseded", () => {
    expect(historicalReport).toContain("Superseded:");
    expect(historicalReport).toContain("RELEASE_DECISION_2026-08-25.md");
  });
});
