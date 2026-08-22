import { describe, expect, it } from "vitest";
import {
  getFormatLabel,
  getFormatShortLabel,
  getTournamentFormatLabel,
  type TournamentFormat,
} from "./formatRegistry";

describe("canonical tournament format labels", () => {
  const labels: Record<TournamentFormat, string> = {
    swiss: "Swiss",
    doubleswiss: "Double Swiss",
    roundrobin: "Round Robin",
    elimination: "Elimination",
    swiss_elim: "Swiss + Elimination",
    quads: "Quads",
  };

  it.each(Object.entries(labels) as [TournamentFormat, string][])("labels %s as %s", (format, label) => {
    expect(getTournamentFormatLabel(format)).toBe(label);
    expect(getFormatLabel(format)).toBe(label);
  });

  it("uses canonical short labels in compact surfaces", () => {
    expect(getTournamentFormatLabel("doubleswiss", { short: true })).toBe("Dbl Swiss");
    expect(getFormatShortLabel("swiss_elim")).toBe("Swiss+Elim");
  });

  it("never mislabels unknown or missing formats as Swiss", () => {
    expect(getTournamentFormatLabel(undefined)).toBe("Tournament");
    expect(getTournamentFormatLabel("legacy-format")).toBe("Tournament");
    expect(getTournamentFormatLabel("legacy-format", { fallback: "Unknown" })).toBe("Unknown");
  });
});
