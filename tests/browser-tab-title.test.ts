import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const documentHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const homePage = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const pageMetaHook = readFileSync(resolve(process.cwd(), "client/src/hooks/usePageMeta.ts"), "utf8");

describe("browser tab metadata", () => {
  it("uses the current ChessOTB Home page title contract", () => {
    expect(documentHtml).toContain("<title>ChessOTB.club | Chess Tournaments &amp; Clubs Over the Board</title>");
    expect(homePage).toContain('title: "ChessOTB.club | Chess Tournaments & Clubs Over the Board"');
    expect(pageMetaHook).toContain('const DEFAULT_PAGE_TITLE = "ChessOTB.club | Chess Tournaments & Clubs Over the Board"');
  });

  it("uses the supplied checkerboard OTB favicon references", () => {
    expect(documentHtml).toContain('href="/favicon.ico" sizes="any"');
    expect(documentHtml).toContain('href="/brand/otb-checker-favicon-16.png"');
    expect(documentHtml).toContain('href="/brand/otb-checker-favicon-32.png"');
    expect(documentHtml).toContain('href="/brand/otb-checker-app-icon-192.png"');
    expect(documentHtml).toContain('href="/brand/otb-checker-app-icon-180.png"');
  });
});
