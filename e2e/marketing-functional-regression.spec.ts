import { expect, test } from "@playwright/test";

test("landing acquisition CTA opens the tournament Join entry", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Chess Clubs, Chess Tournaments/i })).toBeVisible();

  await page.getByRole("link", { name: "Join a Tournament", exact: true }).first().click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join Tournament" })).toBeVisible();
});

test("Pricing FAQ reveals the open-beta answer without entering checkout", async ({ page }) => {
  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Simple, honest pricing/i })).toBeVisible();

  const faq = page.getByRole("button", { name: "Is anything actually free right now?" });
  await faq.click();
  await expect(page.getByText(/During open beta, all Pro features are unlocked/i)).toBeVisible();
});

test("Journal category filters update URL state and visible posts", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "The ChessOTB.club Journal & Community" })).toBeVisible();

  const tournamentFilter = page.getByRole("tab", { name: /Filter by Tournaments/i });
  await tournamentFilter.click();
  await expect(tournamentFilter).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/category=Tournaments/);
  await expect(page.getByText(/Complete Guide to Hosting Your First OTB Chess Tournament/i).first()).toBeVisible();
});

test("Join entry exposes code, QR, and disabled-safe continuation controls", async ({ page }) => {
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Join Tournament" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tournament Code" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Scan QR Code/i })).toBeVisible();
});

test("404 and invalid-code variants expose actionable recovery routes", async ({ page }) => {
  await page.goto("/missing-marketing-page", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "This board is empty." })).toBeVisible();
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/missing-marketing-page?error=invalid-code", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "That code didn't match." })).toBeVisible();
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "Join Tournament" })).toBeVisible();
});
