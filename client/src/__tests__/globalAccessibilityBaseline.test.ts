import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const appSource = readFileSync(path.resolve("client/src/App.tsx"), "utf8");
const cssSource = readFileSync(path.resolve("client/src/index.css"), "utf8");
const pageDirectory = path.resolve("client/src/pages");
const pageSources = readdirSync(pageDirectory)
  .filter((fileName) => fileName.endsWith(".tsx"))
  .map((fileName) => ({
    fileName,
    source: readFileSync(path.join(pageDirectory, fileName), "utf8"),
  }));

describe("global accessibility baseline", () => {
  it("provides a keyboard-visible skip link targeting the application main region", () => {
    expect(appSource).toContain('href="#main-content"');
    expect(appSource).toContain('className="otb-skip-link"');
    expect(appSource).toContain('<main id="main-content" tabIndex={-1} aria-label="Main content">');
    expect(cssSource).toContain(".otb-skip-link:focus-visible");
  });

  it("moves focus to main content after client-side route navigation", () => {
    expect(appSource).toContain("function RouteFocusManager()");
    expect(appSource).toContain("const [location] = useLocation()");
    expect(appSource).toContain('document.getElementById("main-content")');
    expect(appSource).toContain("mainContent.focus({ preventScroll: true })");
    expect(appSource).toContain("if (!userMovedFocus) focusMainContent()");
    expect(appSource).toContain('document.addEventListener("keydown", noteUserInteraction');
  });

  it("keeps exactly one main landmark in the routed application shell", () => {
    expect(appSource.match(/<main\b/g)).toHaveLength(1);
    const pagesWithMain = pageSources.filter(({ source }) => /<main\b/.test(source));
    expect(pagesWithMain.map(({ fileName }) => fileName)).toEqual([]);
  });

  it("uses theme-aware, high-visibility focus tokens and a three-pixel indicator", () => {
    expect(cssSource.match(/--otb-focus-ring:/g)).toHaveLength(2);
    expect(cssSource).toMatch(/:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--otb-focus-ring\)/);
    expect(cssSource).toContain("outline-offset: 3px");
  });
});
