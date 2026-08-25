import { expect, test } from "@playwright/test";

test("failed platform statistics never render as factual zeros", async ({ page }) => {
  await page.route("**/api/platform/stats", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const tournaments = page.getByText("Tournaments Hosted", { exact: true });
  await tournaments.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("platform-stats-loading")).toHaveCount(0);

  await expect(tournaments.locator("..")).toContainText("300+");
  await expect(page.getByText("Players Registered", { exact: true }).locator("..")).toContainText("550+");
  await expect(page.getByText("Chess Clubs", { exact: true }).locator("..")).toContainText("80+");
});

test("every public demo route clearly labels preview data", async ({ page }) => {
  await page.goto("/league-demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Demo Season", { exact: true })).toBeVisible();

  await page.goto("/openings/demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You're previewing the Openings Library/i)).toBeVisible();

  await page.goto("/openings/demo/demo-london-system", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You're previewing the Openings Library/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "London System" })).toBeVisible();
});
