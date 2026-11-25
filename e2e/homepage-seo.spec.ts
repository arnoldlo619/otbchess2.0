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
