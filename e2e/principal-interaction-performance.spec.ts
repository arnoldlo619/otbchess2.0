import { expect, test } from "@playwright/test";

type InteractionWindow = Window & {
  __otbMaxEventDuration?: number;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as InteractionWindow;
    target.__otbMaxEventDuration = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        target.__otbMaxEventDuration = Math.max(target.__otbMaxEventDuration ?? 0, entry.duration);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
});

test("principal FAQ interaction stays within the 200ms INP-equivalent budget", async ({ page }) => {
  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Simple, honest pricing/i })).toBeVisible();

  const faq = page.getByRole("button", { name: "Is anything actually free right now?" });
  await faq.scrollIntoViewIfNeeded();
  await faq.click();
  await expect(page.getByText(/During open beta, all Pro features are unlocked/i)).toBeVisible();
  await page.waitForTimeout(100);

  const maxDuration = await page.evaluate(() => (window as InteractionWindow).__otbMaxEventDuration ?? 0);
  expect(maxDuration, "Pricing FAQ max event duration").toBeLessThanOrEqual(200);
});

test("Quads result selection paints feedback within 100ms", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=mid", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tablist", { name: "Round tabs" })).toBeVisible();

  await page.getByRole("button", { name: /Open result entry for Board/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /Enter result for Board/i });
  await expect(dialog).toBeVisible();
  const drawButton = dialog.getByRole("button", { name: "Draw ½–½" });

  const feedbackMs = await drawButton.evaluate((button) => new Promise<number>((resolve, reject) => {
    const panel = button.closest('[role="dialog"]');
    if (!panel) {
      reject(new Error("Result panel not found"));
      return;
    }
    const startedAt = performance.now();
    const observer = new MutationObserver(() => {
      if (!panel.isConnected) {
        observer.disconnect();
        resolve(performance.now() - startedAt);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (button as HTMLButtonElement).click();
  }));

  expect(feedbackMs, "Quads result click-to-DOM-feedback").toBeLessThanOrEqual(100);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("½–½", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
