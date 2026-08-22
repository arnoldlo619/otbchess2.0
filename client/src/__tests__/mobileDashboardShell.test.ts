import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");

const dashboardFiles = [
  "client/src/pages/ClubProfile.tsx",
  "client/src/pages/ClubDashboard.tsx",
  "client/src/pages/LeagueDashboard.tsx",
];

describe("mobile dashboard shells", () => {
  it.each(dashboardFiles)("contains horizontal overflow at the viewport shell in %s", (relativePath) => {
    const source = readFileSync(resolve(projectRoot, relativePath), "utf8");
    expect(source).toContain("h-[100dvh] w-full max-w-full overflow-hidden overscroll-x-none");
    expect(source).toContain("min-w-0 overflow-x-hidden overflow-y-auto");
  });

  it.each(dashboardFiles)("reserves bottom-nav plus device safe-area space in %s", (relativePath) => {
    const source = readFileSync(resolve(projectRoot, relativePath), "utf8");
    expect(source).toMatch(/pb-\[calc\((5rem|7rem)\+env\(safe-area-inset-bottom,0px\)\)\]/);
  });
});
