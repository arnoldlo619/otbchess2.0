import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"), "utf8");

describe("Club Profile visitor sidebar navigation", () => {
  it("keeps the visitor rail to core destinations while preserving direct member destinations", () => {
    expect(source).toContain('(["home", "feed", "events", "members", "album", "leagues"] as const)');
    expect(source).toContain('(["home", "feed", "events", "members"] as const)');
  });

  it("keeps public Album and League access within their visitor parent experiences", () => {
    expect(source).toContain('setActiveTab("album")');
    expect(source).toContain('setActiveTab("leagues")');
    expect(source).toContain("View club albums");
    expect(source).toContain("View club leagues");
  });
});
