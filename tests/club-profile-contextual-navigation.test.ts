import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"), "utf8");

describe("Club Profile contextual visitor navigation", () => {
  it("uses native buttons for keyboard-accessible Feed to Album and Events to Leagues navigation", () => {
    expect(source).toMatch(/<button onClick=\{\(\) => setActiveTab\("album"\)[^>]*>View club albums<\/button>/);
    expect(source).toMatch(/<button onClick=\{\(\) => setActiveTab\("leagues"\)[^>]*>View club leagues<\/button>/);
  });
});
