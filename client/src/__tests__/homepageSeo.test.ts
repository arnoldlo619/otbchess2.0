// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageMeta } from "../hooks/usePageMeta";

const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const seo = home.match(/usePageMeta\(\{\s*title: "([^"]+)",\s*description: "([^"]+)",\s*keywords: "([^"]+)",\s*path: "\/"/);
if (!seo) throw new Error("Homepage SEO configuration missing");
const [, title, description, keywords] = seo;
const heading = "Chess tournaments and leagues for local chess clubs";

function expectLimits() {
  expect(document.title.length).toBeGreaterThanOrEqual(30);
  expect(document.title.length).toBeLessThanOrEqual(60);
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  expect(description.length).toBeGreaterThanOrEqual(50);
  expect(description.length).toBeLessThanOrEqual(160);
  const keywords = (document.querySelector('meta[name="keywords"]')?.getAttribute("content") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  expect(keywords.length).toBeGreaterThanOrEqual(3);
  expect(keywords.length).toBeLessThanOrEqual(8);
  expect(new Set(keywords).size).toBe(keywords.length);
}

afterEach(() => { cleanup(); document.head.innerHTML = ""; });

describe("homepage SEO strict limits", () => {
  it("ships bounded metadata in initial HTML before JavaScript executes", () => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    expectLimits();
    expect(document.title).toBe(title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(description);
    expect(document.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe(keywords);
  });

  it("sets document.title and creates missing description/keywords tags through the SEO hook", () => {
    document.head.innerHTML = "";
    const { rerender } = renderHook(() => usePageMeta({ title, description, keywords, path: "/" }));
    rerender();
    expectLimits();
    expect(document.title).toBe(title);
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[name="keywords"]')).toHaveLength(1);
  });

  it("updates existing metadata without duplicates and retains a valid title on cleanup", () => {
    document.head.innerHTML = '<title>Old title</title><meta name="description" content="Old"><meta name="keywords" content="Old">';
    const { rerender, unmount } = renderHook(({ pageKeywords }) => usePageMeta({ title, description, keywords: pageKeywords, path: "/" }), { initialProps: { pageKeywords: "old, stale, keywords" } });
    rerender({ pageKeywords: keywords });
    expectLimits();
    expect(document.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe(keywords);
    expect(document.querySelectorAll('meta[name="keywords"]')).toHaveLength(1);
    unmount();
    expect(document.title).toBe(title);
  });

  it("renders the descriptive hero subtitle as an H2 no longer than 80 characters", () => {
    expect(heading.length).toBeLessThanOrEqual(80);
    expect(home).toMatch(new RegExp(`<h2\\b[^>]*>\\s*${heading}\\s*</h2>`));
  });
});
