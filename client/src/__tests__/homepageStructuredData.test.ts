// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, StrictMode } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHomepageStructuredData } from "../hooks/useHomepageStructuredData";
import { usePageMeta } from "../hooks/usePageMeta";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const seo = home.match(/usePageMeta\(\{\s*title: "([^"]+)",\s*description: "([^"]+)",\s*keywords: "([^"]+)",\s*path: "\/"/);
if (!seo) throw new Error("Homepage SEO configuration missing");
const [, title, description, keywords] = seo;
const homeUrl = "https://chessotb.club/";
const selector = 'head script#jsonld-homepage[type="application/ld+json"]';

function graph() {
  return JSON.parse(document.querySelector(selector)?.textContent ?? "") as {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  };
}

function references(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(references);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [
    ...(typeof object["@id"] === "string" ? [object["@id"]] : []),
    ...Object.values(object).flatMap(references),
  ];
}

afterEach(() => { cleanup(); document.head.innerHTML = ""; });

describe("homepage JSON-LD", () => {
  it("parses a single graph with stable canonical identities and the current logo", () => {
    renderHook(useHomepageStructuredData);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    const data = graph();
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"].map((node) => node["@type"])).toEqual(["Organization", "WebSite", "WebPage"]);
    expect(data["@graph"].map((node) => node["@id"])).toEqual([
      `${homeUrl}#organization`, `${homeUrl}#website`, `${homeUrl}#webpage`,
    ]);
    for (const node of data["@graph"]) expect(node.url).toBe(homeUrl);
    expect(data["@graph"][0]).toMatchObject({
      name: "ChessOTB.club", alternateName: "OTB Chess",
      logo: `${homeUrl}brand/otb-retro-cream-green-wordmark.webp`,
    });
  });

  it("resolves every graph reference and explicitly describes the chess topics", () => {
    renderHook(useHomepageStructuredData);
    const nodes = graph()["@graph"];
    const ids = new Set(nodes.map((node) => node["@id"]));
    expect(ids.size).toBe(nodes.length);
    for (const id of references(nodes)) expect(ids.has(id)).toBe(true);
    expect(nodes[1].publisher).toEqual({ "@id": `${homeUrl}#organization` });
    expect(nodes[2].isPartOf).toEqual({ "@id": `${homeUrl}#website` });
    expect(nodes[2].mainEntity).toEqual({ "@id": `${homeUrl}#organization` });
    expect(nodes[2].about).toEqual([
      { "@type": "Thing", name: "Chess clubs" },
      { "@type": "Thing", name: "Over-the-board chess tournaments" },
      { "@type": "Thing", name: "Chess leagues" },
    ]);
  });

  it("matches the homepage runtime metadata without altering its strict limits", () => {
    renderHook(() => {
      usePageMeta({ title, description, keywords, path: "/" });
      useHomepageStructuredData();
    });
    const page = graph()["@graph"][2];
    expect(page.name).toBe(document.title);
    expect(page.description).toBe(document.querySelector('meta[name="description"]')?.getAttribute("content"));
    expect(title.length).toBe(56);
    expect(description.length).toBe(152);
    expect(keywords.split(",")).toHaveLength(6);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(homeUrl);
  });

  it("does not invent physical clubs, events, reviews, contacts or search actions", () => {
    renderHook(useHomepageStructuredData);
    const json = document.querySelector(selector)?.textContent ?? "";
    expect(json).not.toMatch(/"(?:SportsClub|LocalBusiness|Event|SportsEvent|aggregateRating|review|address|telephone|email|sameAs|potentialAction|SearchAction)"/);
  });

  it("remains singular through StrictMode, rerenders, unmounts and remounts", () => {
    const { rerender, unmount } = renderHook(useHomepageStructuredData, {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    rerender();
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll(selector)).toHaveLength(0);
    renderHook(useHomepageStructuredData);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
  });

  it("replaces stale homepage markup without removing Article or other page schemas", () => {
    document.head.innerHTML = '<script id="jsonld-homepage" type="application/ld+json">{}</script><script id="jsonld-article" type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Existing article"}</script>';
    const article = document.getElementById("jsonld-article");
    const originalArticle = article?.textContent;
    const { unmount } = renderHook(useHomepageStructuredData);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(graph()["@graph"]).toHaveLength(3);
    unmount();
    expect(document.querySelectorAll(selector)).toHaveLength(0);
    expect(document.getElementById("jsonld-article")).toBe(article);
    expect(article?.textContent).toBe(originalArticle);
  });

  it("is mounted only by Home, not the shared initial HTML shell", () => {
    expect(home.match(/\buseHomepageStructuredData\(\)/g)).toHaveLength(1);
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(html).not.toContain("jsonld-homepage");
  });
});
