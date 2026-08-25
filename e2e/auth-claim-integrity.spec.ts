import { expect, test } from "@playwright/test";

test("authentication page presents product purpose without invented community social proof", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByText("Sign in to your OTB Chess account.", { exact: true })).toBeVisible();
  await expect(page.getByText("Join 700+ OTB players", { exact: true })).toHaveCount(0);
  await expect(page.locator('img[src*="images.unsplash.com"]')).toHaveCount(0);
  await expect(page.locator("form").getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
});
