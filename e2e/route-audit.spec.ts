import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/auth",
  "/terms",
  "/blog",
  "/training",
  "/pricing",
  "/pro/success",
  "/tournaments",
  "/director-access",
  "/clock",
  "/clubs",
  "/clubs/leaderboard",
  "/league",
  "/league-demo",
  "/prep",
  "/prep/analysis",
  "/games",
  "/record",
  "/record/camera",
  "/otb/leaderboard",
  "/openings",
  "/openings/demo",
  "/repertoire",
  "/join",
  "/404",
] as const;

const dynamicFallbackRoutes = [
  "/clubs/route-audit-missing-club",
  "/tournament/route-audit-missing-tournament",
  "/league/route-audit-missing-league",
  "/blog/route-audit-missing-post",
  "/join/route-audit-invalid-code",
  "/rsvp/route-audit-invalid-form",
  "/invite/route-audit-invalid-token",
  "/game/route-audit-missing-game/analysis",
  "/openings/route-audit-missing-opening",
  "/repertoire/route-audit-missing-repertoire",
  "/live/route-audit-missing-tournament",
  "/live/board/route-audit-missing-board",
] as const;

function collectUnexpectedPageErrors(page: import("@playwright/test").Page): string[] {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message !== "WebSocket closed without opened.") pageErrors.push(error.message);
  });
  return pageErrors;
}

test.describe("canonical public routes", () => {
  for (const route of publicRoutes) {
    test(`${route} returns a rendered public surface`, async ({ page }) => {
      const pageErrors = collectUnexpectedPageErrors(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("body")).not.toHaveText("");
      expect(pageErrors).toEqual([]);
    });
  }

  test("Terms is reachable from the landing footer", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const termsLink = page.locator("footer").getByRole("link", { name: "Terms", exact: true });
    await expect(termsLink).toHaveAttribute("href", "/terms");
    await termsLink.click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
  });
});

test.describe("dynamic route recovery", () => {
  for (const route of dynamicFallbackRoutes) {
    test(`${route} renders a safe fallback instead of a blank or crash`, async ({ page }) => {
      const pageErrors = collectUnexpectedPageErrors(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("body")).not.toHaveText("");
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("legacy aliases", () => {
  test("tools redirects once to training and preserves context", async ({ page }) => {
    await page.goto("/tools?utm_source=route-audit#tools", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/training\?utm_source=route-audit#tools$/);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("create redirects into the tournament wizard without looping", async ({ page }) => {
    await page.goto("/create?utm_source=route-audit#host", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/?utm_source=route-audit#host$/);
    await expect(page.getByRole("heading", { name: /Create a Tournament/i }).first()).toBeVisible();
  });
});
