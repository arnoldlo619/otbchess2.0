import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directorPage = readFileSync(resolve(process.cwd(), "client/src/pages/Director.tsx"), "utf8");

describe("completed tournament View Results routing", () => {
  it("takes directors directly to the full player report", () => {
    const viewResultsAction = directorPage.match(/onClick=\{\(\) => window\.location\.href = `([^`]+)`\}[\s\S]{0,420}?View Results/);

    expect(viewResultsAction?.[1]).toBe("/tournament/${tournamentId}/report");
    expect(viewResultsAction?.[1]).not.toContain("/overview");
  });
});
