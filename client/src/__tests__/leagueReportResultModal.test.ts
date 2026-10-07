import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(import.meta.dirname, "../pages/LeagueDashboard.tsx"),
  "utf8"
);
const reportModalSource = dashboardSource.slice(
  dashboardSource.indexOf("function ReportResultModal"),
  dashboardSource.indexOf("// ── Main Component")
);

describe("League commissioner result report modal", () => {
  it("uses a centered, accessible responsive dialog shell", () => {
    expect(reportModalSource).toContain('className="modal-overlay z-[210] px-4 py-5 sm:px-6"');
    expect(reportModalSource).toContain('className="modal-card w-full max-w-[34rem] rounded-[2rem]');
    expect(reportModalSource).toContain('role="dialog"');
    expect(reportModalSource).toContain('aria-labelledby="league-report-result-title"');
    expect(reportModalSource).toContain("useAccessibleOverlay({");
  });

  it("promotes the result action to the platform h1 typography without a battle icon", () => {
    expect(reportModalSource).toContain("<h1");
    expect(reportModalSource).toContain('id="league-report-result-title"');
    expect(reportModalSource).toContain('fontFamily: "\'Clash Display\', sans-serif"');
    expect(reportModalSource).toContain("text-3xl font-black");
    expect(reportModalSource).not.toContain("<Swords");
    expect(reportModalSource).not.toContain("Submit Official Report");
  });

  it("keeps result outcomes clear with responsive premium interaction feedback", () => {
    expect(reportModalSource).toContain('aria-pressed={selected === opt.value}');
    expect(reportModalSource).toContain("hover:-translate-y-0.5 hover:shadow-lg");
    expect(reportModalSource).toContain("group-hover:scale-110");
    expect(reportModalSource).toContain("hover:-translate-y-px hover:shadow-lg");
    expect(reportModalSource).toContain("backdropFilter: \"blur(8px)\"");
  });
});
