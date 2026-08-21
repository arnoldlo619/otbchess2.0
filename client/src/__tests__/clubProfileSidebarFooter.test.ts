import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clubProfileSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"),
  "utf8",
);

describe("Club Profile side-navigation footer", () => {
  it("does not render the member-only Contact Owner footer action", () => {
    expect(clubProfileSource).not.toContain('aria-label="Contact Owner"');
    expect(clubProfileSource).not.toContain("setShowContactOwner(true)");
    expect(clubProfileSource).toContain('aria-label="Settings"');
  });
});
