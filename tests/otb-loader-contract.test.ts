import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OTB_LOADER_POSTER_SOURCE,
  OTB_LOADER_VIDEO_SOURCE,
  OTBLoader,
} from "../client/src/components/OTBLoader";

describe("OTBLoader", () => {
  it("renders the announced official loader video with an optional status label", () => {
    const markup = renderToStaticMarkup(createElement(OTBLoader, { label: "Building your opponent report", isDark: true }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Building your opponent report"');
    expect(markup).toContain("Building your opponent report");
    expect(markup).toContain(`src="${OTB_LOADER_VIDEO_SOURCE}"`);
    expect(markup).toContain(`poster="${OTB_LOADER_POSTER_SOURCE}"`);
    expect(markup).toContain("otb-loader__video");
    expect(markup).toContain("playsInline");
    expect(markup).toContain("muted");
    expect(markup).toContain("otb-loader--dark");
  });

  it("has a full-page surface, a local asset, and a legacy failure-safe fallback", () => {
    const markup = renderToStaticMarkup(createElement(OTBLoader, { fullPage: true, isDark: false }));
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "client/src/components/OTBLoader.tsx"), "utf8");

    expect(markup).toContain("otb-loader-page");
    expect(css).toContain(".otb-loader__video");
    expect(css).toContain("@keyframes otb-loader-square-path");
    expect(css).toContain(".otb-loader__square { animation: none; }");
    expect(source).toContain("onError={() => setVideoUnavailable(true)}");
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("autoPlay={!reducedMotion}");
    expect(source).toContain("loop={!reducedMotion}");
  });
});
