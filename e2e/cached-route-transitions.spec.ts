import { expect, test, type Page } from "@playwright/test";

async function measureCachedTransition({
  page,
  targetPath,
  targetReady,
  sourcePath,
  sourceReady,
  prepare,
  activate,
}: {
  page: Page;
  targetPath: string;
  targetReady: RegExp;
  sourcePath: string;
  sourceReady: RegExp;
  prepare: () => Promise<void>;
  activate: () => Promise<void>;
}) {
  await page.goto(sourcePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(sourceReady).filter({ visible: true }).first()).toBeVisible();
  await prepare();
  await activate();
  await expect(page.getByText(targetReady).filter({ visible: true }).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByText(sourceReady).filter({ visible: true }).first()).toBeVisible();
  await prepare();
  await page.evaluate(() => {
    (window as Window & { __otbRouteLoaderObserved?: boolean }).__otbRouteLoaderObserved = false;
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes("Preparing the board")) {
        (window as Window & { __otbRouteLoaderObserved?: boolean }).__otbRouteLoaderObserved = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setTimeout(() => observer.disconnect(), 2_000);
  });

  const startedAt = await page.evaluate(() => performance.now());
  await activate();
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(targetPath);
  const elapsed = await page.evaluate((start) => performance.now() - start, startedAt);

  expect(elapsed, `${sourcePath} → ${targetPath}`).toBeLessThanOrEqual(500);
  await expect(page.getByText(targetReady).filter({ visible: true }).first()).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { __otbRouteLoaderObserved?: boolean }).__otbRouteLoaderObserved),
    `${sourcePath} → ${targetPath}: cached route loader flash`
  ).toBe(false);
}

test("cached Pricing to Join transition stays within 500ms", async ({ page }) => {
  await measureCachedTransition({
    page,
    targetPath: "/join",
    targetReady: /Join Tournament/i,
    sourcePath: "/pricing",
    sourceReady: /Simple, honest pricing/i,
    prepare: () => page.locator('a[href="/join"]').first().scrollIntoViewIfNeeded(),
    activate: () => page.locator('a[href="/join"]').first().click({ noWaitAfter: true }),
  });
});

test("cached Pricing to Home transition stays within 500ms", async ({ page }) => {
  await measureCachedTransition({
    page,
    targetPath: "/",
    targetReady: /Chess Clubs/i,
    sourcePath: "/pricing",
    sourceReady: /Simple, honest pricing/i,
    prepare: () => page.locator('a[href="/"]').first().scrollIntoViewIfNeeded(),
    activate: () => page.locator('a[href="/"]').first().click({ noWaitAfter: true }),
  });
});
