import { expect, test } from "@playwright/test";

test("an uncached lazy route uses the in-flow loader instead of a full-screen loader", async ({ page }) => {
  let delayedBlogChunk = false;
  await page.route("**/src/pages/Blog.tsx*", async (route) => {
    delayedBlogChunk = true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Chess Clubs/i })).toBeVisible();

  const blogLink = page.locator('a[href="/blog"]').first();
  await blogLink.scrollIntoViewIfNeeded();
  await blogLink.click({ noWaitAfter: true });

  const loader = page.locator("[data-route-loader]");
  await expect(loader).toBeVisible();
  await expect(page.getByRole("status", { name: "Preparing the page" })).toBeVisible();
  await expect(page.locator(".otb-loader-page")).toHaveCount(0);

  const loaderHeight = await loader.evaluate((element) => element.getBoundingClientRect().height);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(loaderHeight).toBeLessThan(viewportHeight);
  expect(delayedBlogChunk).toBe(true);

  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.getByRole("heading", { name: /Journal & Community/i })).toBeVisible();
});
