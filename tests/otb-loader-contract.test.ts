import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OTBLoader } from "../client/src/components/OTBLoader";

describe("OTBLoader", () => {
  it("renders an announced seven-square loader with an optional status label", () => {
    const markup = renderToStaticMarkup(createElement(OTBLoader, { label: "Building your opponent report", isDark: true }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Building your opponent report"');
    expect(markup).toContain("Building your opponent report");
    expect((markup.match(/otb-loader__square/g) ?? []).length).toBe(7);
    expect(markup).toContain("otb-loader--dark");
  });

  it("has a full-page surface and reduced-motion-safe keyframes in global CSS", () => {
    const markup = renderToStaticMarkup(createElement(OTBLoader, { fullPage: true, isDark: false }));
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(markup).toContain("otb-loader-page");
    expect(css).toContain("@keyframes otb-loader-square-path");
    expect(css).toContain(".otb-loader__square { animation: none; }");
  });
});
