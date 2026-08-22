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

test("landing footer and demo calls to action use their canonical destinations", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Tools", exact: true })).toHaveAttribute("href", "/training");
  await expect(footer.getByRole("link", { name: "Host Tournament", exact: true })).toHaveAttribute("href", "/tournaments/new");
  await expect(footer.getByRole("link", { name: "Join a Tournament", exact: true })).toHaveAttribute("href", "/join");
  await expect(footer.getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");

  await page.getByTestId("final-live-tournament-demo").click();
  await expect(page).toHaveURL(/\/tournament\/otb-demo-2026\/manage$/);
});

test("homepage stats show skeletons before resolving zero API counts to published floors", async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });

  await page.route("**/api/platform/stats", async (route) => {
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tournaments: 0, players: 0, clubs: 0 }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("platform-stats-loading")).toHaveCount(4);
  releaseResponse?.();
  await expect(page.getByTestId("platform-stats-loading")).toHaveCount(0);

  const tournamentStat = page.getByText("Tournaments Hosted", { exact: true }).locator("..");
  await tournamentStat.scrollIntoViewIfNeeded();
  await expect(tournamentStat).toContainText("300+");
  await expect(page.getByText("Players Registered", { exact: true }).locator("..")).toContainText("550+");
  await expect(page.getByText("Chess Clubs", { exact: true }).locator("..")).toContainText("80+");
});

test("Quads Director controls remain accessible and contained on mobile and desktop", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=mid", { waitUntil: "domcontentloaded" });
  const roundTabs = page.getByRole("tablist", { name: "Round tabs" });
  await expect(roundTabs).toBeVisible();
  await expect(page.getByRole("group", { name: "Section view" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Round 1/i })).toHaveAttribute("aria-selected", /true|false/);

  const roundOneBox = await page.getByRole("tab", { name: /Round 1/i }).boundingBox();
  expect(roundOneBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
