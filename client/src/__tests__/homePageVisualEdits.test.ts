import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8",
);

describe("Home page visual edits", () => {
  it("keeps the requested Chess Club starter headings", () => {
    expect(homeSource).toContain("The Chess Club Starter Pack");
    expect(homeSource).toContain("Your Chess Club Website");
    expect(homeSource).not.toContain("Everything a Chess Club");
    expect(homeSource).not.toContain("Club Roster & Events");
  });

  it("renders the requested OTB Studio content card with a safe external CTA", () => {
    expect(homeSource).toContain('tag="OTB Studio"');
    expect(homeSource).toContain('title="Create Chess Club Content"');
    expect(homeSource).toContain(
      'description="Film and edit your clubs OTB game play clips on one platform."',
    );
    expect(homeSource).toContain('cta="Create a Clip"');
    expect(homeSource).toContain('href="https://otbstudio.lovable.app"');
    expect(homeSource).toContain("external");
    expect(homeSource).toContain('rel={external ? "noopener noreferrer" : undefined}');
    expect(homeSource).not.toContain('title="Intuitive Host Dashboard"');
  });
});
