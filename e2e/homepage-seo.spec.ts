import { expect, test } from "@playwright/test";

test("homepage metadata and descriptive H2 satisfy every strict SEO limit", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("ChessOTB.club | Chess Tournaments & Clubs Over the Board");
  const seo = await page.evaluate(() => ({
    title: document.title,
    descriptions: Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="description"]')).map((meta) => meta.content),
    keywords: Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="keywords"]')).map((meta) => meta.content),
  }));
  expect(seo.title.length).toBeGreaterThanOrEqual(30);
  expect(seo.title.length).toBeLessThanOrEqual(60);
  expect(seo.descriptions).toHaveLength(1);
  expect(seo.descriptions[0].length).toBeGreaterThanOrEqual(50);
  expect(seo.descriptions[0].length).toBeLessThanOrEqual(160);
  expect(seo.keywords).toHaveLength(1);
  const keywords = seo.keywords[0].split(",").map((keyword) => keyword.trim()).filter(Boolean);
  expect(keywords.length).toBeGreaterThanOrEqual(3);
  expect(keywords.length).toBeLessThanOrEqual(8);
  const heading = page.getByRole("heading", { level: 2, name: "Chess tournaments and leagues for local chess clubs", exact: true });
  await expect(heading).toBeVisible();
  expect((await heading.innerText()).trim().length).toBeLessThanOrEqual(80);
});

test("homepage renders one complete JSON-LD graph with runtime metadata parity", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const graph = await page.locator('script#jsonld-homepage[type="application/ld+json"]').evaluate((script) => JSON.parse(script.textContent ?? ""));
  expect(await page.locator("script#jsonld-homepage").count()).toBe(1);
  expect(graph["@context"]).toBe("https://schema.org");
  expect(graph["@graph"]).toHaveLength(3);
  expect(graph["@graph"].map((item: { [key: string]: unknown }) => item["@type"])).toEqual(["Organization", "WebSite", "WebPage"]);

  const [organization, website, webpage] = graph["@graph"];
  expect(organization).toMatchObject({
    "@id": "https://chessotb.club/#organization",
    name: "ChessOTB.club",
    alternateName: "OTB Chess",
    logo: "https://chessotb.club/brand/otb-retro-cream-green-wordmark.webp",
  });
  expect(website).toMatchObject({
    "@id": "https://chessotb.club/#website",
    url: "https://chessotb.club/",
    publisher: { "@id": "https://chessotb.club/#organization" },
  });
  expect(webpage).toMatchObject({
    "@id": "https://chessotb.club/#webpage",
    url: "https://chessotb.club/",
    isPartOf: { "@id": "https://chessotb.club/#website" },
    mainEntity: { "@id": "https://chessotb.club/#organization" },
    about: [
      { "@type": "Thing", name: "Chess clubs" },
      { "@type": "Thing", name: "Over-the-board chess tournaments" },
      { "@type": "Thing", name: "Chess leagues" },
    ],
  });

  const runtimeMetadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
  }));
  expect(webpage.name).toBe(runtimeMetadata.title);
  expect(webpage.description).toBe(runtimeMetadata.description);

  const logoResponse = await request.get(new URL(organization.logo).pathname);
  expect(logoResponse.ok()).toBeTruthy();
  expect(logoResponse.headers()["content-type"]).toContain("image/webp");
});

test("homepage JSON-LD follows SPA navigation and is absent on non-home routes", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const homepageScript = page.locator("script#jsonld-homepage");
  await expect(homepageScript).toHaveCount(1);

  await page.locator('footer a[href="/blog"]').click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(homepageScript).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(homepageScript).toHaveCount(1);

  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  await expect(page.locator("script#jsonld-homepage")).toHaveCount(0);
});
