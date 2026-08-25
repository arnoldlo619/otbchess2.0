import { expect, test } from "@playwright/test";

const publicClubPath = "/clubs/national-city-chess-club";

test("club discovery search opens a verified public club profile", async ({ page }) => {
  await page.goto("/clubs", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Discover Chess Clubs" })).toBeVisible();
  await expect(page.getByText("23 clubs", { exact: true })).toBeVisible();

  const search = page.getByRole("textbox", { name: "Search by name, location, or category" });
  await search.fill("National City");
  const clubLink = page.getByRole("link").filter({ hasText: "National City Chess Club" }).first();
  await expect(clubLink).toBeVisible();
  await clubLink.click();

  await expect(page).toHaveURL(/\/clubs\/[^/?]+$/);
  await expect(page.getByRole("heading", { name: "National City Chess Club" })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Join/i }).first()).toBeVisible();
});

test("guest users can inspect the real club-creation wizard without mutating data", async ({ page }) => {
  await page.goto("/clubs", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Discover Chess Clubs" })).toBeVisible();

  await page.getByRole("button", { name: "Create Club", exact: true }).click();
  const gate = page.getByRole("dialog", { name: "Create a Club" });
  await expect(gate).toBeVisible();
  await gate.getByRole("button", { name: "Preview wizard without signing in" }).click();

  const wizard = page.getByRole("dialog", { name: "Create Club" });
  await expect(wizard).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Club Name" })).toBeFocused();
  await expect(page.getByText("Step 1 of 6", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(wizard).toBeHidden();
});

test("public club feed, events, members, and leagues tabs expose correct guest states", async ({ page }) => {
  await page.goto(publicClubPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "National City Chess Club" })).toBeVisible();

  await page.getByRole("button", { name: "Feed", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Members-only Feed" })).toBeVisible();

  await page.getByRole("button", { name: "Events", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Members-only Events" })).toBeVisible();

  await page.getByRole("button", { name: "Members", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Members-only" })).toBeVisible();

  await page.getByRole("button", { name: "Leagues", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Members-only Leagues" })).toBeVisible();
});

test("club league demo opens standings with its default bracket display and navigable sections", async ({ page }) => {
  await page.goto("/league-demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "ChessOTB Club League" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playoff Bracket" })).toBeVisible();
  await expect(page.getByText("Champion", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Bracket Display/i })).toBeVisible();

  await page.getByRole("button", { name: /Standings Table/i }).click();
  await expect(page.getByRole("heading", { name: "Playoff Bracket" })).toBeHidden();
  await expect(page.getByText("Magnus Carlsen", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Bracket Display/i }).click();
  await expect(page.getByRole("heading", { name: "Playoff Bracket" })).toBeVisible();
});
