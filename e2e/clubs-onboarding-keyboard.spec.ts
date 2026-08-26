import { expect, test } from "@playwright/test";

test("keyboard users can open the Clubs creation gate from the discovery CTA", async ({ page }) => {
  await page.goto("/clubs");

  const createClub = page.getByRole("button", { name: "Start a new club" });
  await createClub.scrollIntoViewIfNeeded();
  await createClub.focus();
  await expect(createClub).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog")).toBeVisible();
});
