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

  it("uses icon-free members-only gates with a consistent prominent heading hierarchy", () => {
    const lockedHeadingClass = "text-lg font-bold tracking-tight sm:text-xl mb-1.5";
    expect(clubProfileSource.split(lockedHeadingClass)).toHaveLength(5);
    expect(clubProfileSource).toContain('>Members-only Feed</h3>');
    expect(clubProfileSource).toContain('>Members-only Events</h3>');
    expect(clubProfileSource).toContain('>Members-only Leagues</h3>');
  });
});
