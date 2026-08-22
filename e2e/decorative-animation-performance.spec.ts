import { expect, test } from "@playwright/test";

type LongTaskWindow = Window & {
  __otbLongTasks?: number[];
};

test("decorative landing motion does not create main-thread long tasks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const target = window as LongTaskWindow;
    target.__otbLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) target.__otbLongTasks!.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Chess Clubs, Chess Tournaments/i })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Chess Clubs, Chess Tournaments/i })).toBeVisible();
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    (window as LongTaskWindow).__otbLongTasks = [];
  });
  const runningAnimations = await page.evaluate(() =>
    document.getAnimations().filter((animation) => animation.playState === "running").length
  );
  expect(runningAnimations).toBeGreaterThan(0);

  await page.waitForTimeout(2_000);
  const longTasks = await page.evaluate(() => (window as LongTaskWindow).__otbLongTasks ?? []);
  expect(longTasks, `long tasks: ${longTasks.map((duration) => duration.toFixed(1)).join(", ")}`).toEqual([]);
});
