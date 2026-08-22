import { expect, test } from "@playwright/test";

const coreRoutes = [
  { path: "/", heading: /Chess Clubs/i },
  { path: "/auth", text: "Welcome back" },
  { path: "/pricing", heading: /Simple, honest pricing/i },
  { path: "/tournaments", heading: /^Archive$/i },
  { path: "/league-demo", heading: /^ChessOTB Club League$/i },
  { path: "/prep", heading: /Prepare for your next match/i },
] as const;

test.describe("core public entry routes", () => {
  for (const route of coreRoutes) {
    test(`${route.path} renders without page-level overflow`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
      if ("heading" in route) {
        await expect(page.getByRole("heading", { name: route.heading }).filter({ visible: true }).first()).toBeVisible();
      } else {
        await expect(page.getByText(route.text, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      }
      await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      expect(pageErrors.filter((message) => message !== "WebSocket closed without opened.")).toEqual([]);
    });
  }
});

test("legacy create alias preserves campaign context and opens the tournament wizard", async ({ page }) => {
  await page.goto("/create?utm_source=e2e&format=quads#choose", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/?utm_source=e2e&format=quads#choose$/);
  await expect(page.getByRole("heading", { name: /Create a Tournament/i }).first()).toBeVisible();
});

test("landing Host Tournament CTA opens the canonical creation flow", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Host Tournament/i }).first().click();
  await expect(page.getByRole("heading", { name: /Create a Tournament/i }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("authentication and join entry points expose their primary actions", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Sign In/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Sign Up$/i }).click();
  await expect(page.getByRole("button", { name: /Create Account/i }).first()).toBeVisible();

  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Join.*Tournament/i).first()).toBeVisible();
});
