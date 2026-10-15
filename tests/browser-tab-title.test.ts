import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const documentHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const homePage = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const pageMetaHook = readFileSync(resolve(process.cwd(), "client/src/hooks/usePageMeta.ts"), "utf8");

describe("browser tab metadata", () => {
  it("uses the concise Play Chess OTB document title", () => {
    expect(documentHtml).toContain("<title>Play Chess OTB</title>");
    expect(homePage).toContain('title: "Play Chess OTB"');
    expect(pageMetaHook).toContain('const DEFAULT_PAGE_TITLE = "Play Chess OTB"');
  });

  it("uses retro cream-and-green favicon references", () => {
    expect(documentHtml).toContain('href="/favicon.ico" sizes="any"');
    expect(documentHtml).toContain('href="/brand/otb-retro-favicon-16.png"');
    expect(documentHtml).toContain('href="/brand/otb-retro-favicon-32.png"');
    expect(documentHtml).toContain('href="/brand/otb-retro-app-icon-192.png"');
    expect(documentHtml).toContain('href="/brand/otb-retro-app-icon-180.png"');
  });
});
