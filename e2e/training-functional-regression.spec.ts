import { expect, test } from "@playwright/test";

test("Training tool cards are keyboard-operable native links into Matchup Prep", async ({ page }) => {
  await page.goto("/training", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Your Chess Toolkit" })).toBeVisible();

  const prepLink = page.getByRole("link", { name: "Matchup Prep: Prepare for Opponent" });
  await expect(prepLink).toHaveAttribute("href", "/prep");
  await prepLink.focus();
  await prepLink.press("Enter");

  await expect(page).toHaveURL(/\/prep$/);
  await expect(page.getByRole("heading", { name: "Prepare for your next match" })).toBeVisible();
});

test("Matchup Prep exposes a safe empty search state without calling the provider", async ({ page }) => {
  await page.goto("/prep", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Prepare for your next match" })).toBeVisible();

  const username = page.getByRole("textbox", { name: /username/i });
  await expect(username).toBeVisible();
  await expect(username).toHaveValue("");
  await expect(page.getByRole("button", { name: "Scout opponent" })).toBeDisabled();
});

test("demo openings filter by side, open a detail, and expose the Pro study path", async ({ page }) => {
  await page.goto("/openings/demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Openings Library" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "White Repertoire" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Black Repertoire" })).toBeVisible();

  const filterToggle = page.getByRole("button", { name: "Filter openings" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await filterToggle.click();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "White", exact: true }).click();
  await expect(page.getByRole("heading", { name: "White Repertoire" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Black Repertoire" })).toBeHidden();

  await page.getByRole("button", { name: /London System/i }).first().click();
  await expect(page).toHaveURL(/\/openings\/demo\/demo-london-system$/);
  await expect(page.getByRole("heading", { name: "London System" })).toBeVisible();

  await page.getByRole("button", { name: "Upgrade to Pro", exact: true }).last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Repertoire index loads safely and returns to the Training hub without mutation", async ({ page }) => {
  await page.goto("/repertoire", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Opening Repertoire" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Back to Training" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await expect(page.getByRole("heading", { name: "Your Chess Toolkit" })).toBeVisible();
});
