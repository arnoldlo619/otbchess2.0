import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"),
  "utf8",
);

describe("Tournament Wizard payment-method toggle layout", () => {
  it("uses contained flex switch geometry instead of an unanchored absolute thumb", () => {
    expect(wizardSource).toContain('data-payment-method-toggle={method.toLowerCase().replace(/\\s+/g, "-")}');
    expect(wizardSource).toContain("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5");
    expect(wizardSource).toContain('enabled ? "translateX(20px)" : "translateX(0)"');
    expect(wizardSource).toContain('enabled ? "On" : "Off"');
    expect(wizardSource).not.toContain("absolute top-0.5 h-4 w-4");
  });
});
