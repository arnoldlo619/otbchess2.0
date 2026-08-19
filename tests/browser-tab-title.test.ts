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

  it("retains the existing ChessOTB favicon references", () => {
    expect(documentHtml).toContain("favicon_ea0457e2.ico");
    expect(documentHtml).toContain("favicon-16x16_24a28be0.png");
    expect(documentHtml).toContain("favicon-32x32_f24122c7.png");
  });
});
