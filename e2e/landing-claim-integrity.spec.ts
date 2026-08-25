import { expect, test } from "@playwright/test";

test("landing page omits unverifiable social proof and preserves the final conversion path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Chess Clubs/i })).toBeVisible();
  await expect(page.getByText("Avg. Host Rating", { exact: true })).toHaveCount(0);
  await expect(page.getByText("From the Community", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Clubs that made the move.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Growing your chess club starts here/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Free Tournament" })).toBeVisible();
});

test("platform stats failure never falls back to invented activity counts", async ({ page }) => {
  await page.route("**/api/platform/stats", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
  });
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "Live platform activity is temporarily unavailable." })).toBeVisible();
  await expect(page.getByText("Tournaments Hosted", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Players Registered", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Chess Clubs", { exact: true })).toHaveCount(0);
});
