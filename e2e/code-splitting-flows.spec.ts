import { expect, test } from "@playwright/test";

test("Prep Analysis is requested only after navigating to its route", async ({ page }) => {
  const requestedModules: string[] = [];
  page.on("request", (request) => {
    requestedModules.push(request.url());
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Chess Clubs/i).filter({ visible: true }).first()).toBeVisible();
  expect(requestedModules.some((url) => url.includes("/pages/PrepAnalysis.tsx"))).toBe(false);

  await page.goto("/prep/analysis", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Analysis unavailable|Game Analysis|Position Analysis/i })).toBeVisible();
  expect(requestedModules.some((url) => url.includes("/pages/PrepAnalysis.tsx"))).toBe(true);
});
