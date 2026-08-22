import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", ready: /Chess Clubs/i },
  { path: "/auth", ready: /Welcome back/i },
  { path: "/pricing", ready: /Simple, honest pricing/i },
  { path: "/join", ready: /Join Tournament/i },
  { path: "/tournaments", ready: /^Archive$/i },
  { path: "/prep", ready: /Prepare for your next match/i },
  { path: "/league-demo", ready: /ChessOTB Club League/i },
  { path: "/tournament/otb-demo-2026", ready: /OTB!! Open 2026/i },
  { path: "/tournament/otb-demo-2026/manage", ready: /OTB!! Open 2026/i },
];

for (const route of routes) {
  test(`${route.path} uses appropriately sized and deferred images`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();

    const eagerBelowFold = await page.locator("img").evaluateAll((images) => images.flatMap((image, index) => {
      const rect = image.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.25 || image.loading === "lazy") return [];
      return [{ index, src: image.currentSrc || image.src, top: Math.round(rect.top), loading: image.loading || "auto" }];
    }));

    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 700) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "auto" }), y);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(200);

    const oversized = await page.locator("img").evaluateAll((images) => images.flatMap((image, index) => {
      const rect = image.getBoundingClientRect();
      if (!image.complete || image.naturalWidth === 0 || rect.width < 24 || rect.height < 24) return [];
      const widthRatio = image.naturalWidth / rect.width;
      const heightRatio = image.naturalHeight / rect.height;
      const ratio = Math.max(widthRatio, heightRatio);
      if (ratio <= 3 || image.naturalWidth <= 512) return [];
      return [{
        index,
        src: image.currentSrc || image.src,
        natural: `${image.naturalWidth}x${image.naturalHeight}`,
        rendered: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        ratio: Number(ratio.toFixed(1)),
      }];
    }));

    expect(eagerBelowFold, `${route.path}: eager below-fold images`).toEqual([]);
    expect(oversized, `${route.path}: oversized rendered images`).toEqual([]);
  });
}
