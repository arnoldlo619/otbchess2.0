import { expect, test } from "@playwright/test";

const clubUrl = "/clubs/1904-chess-club";

test.describe("Club Profile visitor contextual navigation", () => {
  test("activates Feed to Album and Events to Leagues through keyboard controls", async ({ page }) => {
    await page.goto(`${clubUrl}?tab=feed`);
    const albums = page.getByRole("button", { name: "View club albums" });
    await albums.focus();
    await expect(albums).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Albums", exact: true })).toBeVisible();

    await page.goto(`${clubUrl}?tab=events`);
    const leagues = page.getByRole("button", { name: "View club leagues" });
    await leagues.focus();
    await expect(leagues).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /league/i })).toBeVisible();
  });

  test("keeps the rendered visitor rail minimal", async ({ page }) => {
    await page.goto(`${clubUrl}?tab=feed`);
    await expect(page.getByRole("button", { name: "Album" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Leagues" })).toHaveCount(0);
    await expect(page.locator("body")).toContainText("View club albums");
  });
});
