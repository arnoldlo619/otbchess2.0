import { expect, test } from "@playwright/test";

type PublicClub = {
  bannerUrl?: string | null;
  avatarUrl?: string | null;
};

test("public clubs payload stays bounded and excludes embedded image data", async ({ request }) => {
  const response = await request.get("/api/clubs?limit=100");
  expect(response.ok()).toBe(true);

  const body = await response.body();
  expect(body.byteLength).toBeLessThanOrEqual(100_000);

  const payload = JSON.parse(body.toString("utf8")) as { clubs: PublicClub[] };
  expect(payload.clubs.length).toBeGreaterThan(0);
  for (const club of payload.clubs) {
    expect(club.bannerUrl ?? "").not.toMatch(/^data:image\//);
    expect(club.avatarUrl ?? "").not.toMatch(/^data:image\//);
  }
});

test("Clubs discovery promotes one visible banner and lazily defers the rest", async ({ page }) => {
  await page.goto("/clubs", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Discover Chess Clubs" })).toBeVisible();
  await expect(page.getByText(/^\d+ clubs?$/, { exact: true }).first()).toBeVisible();

  const banners = page.locator('a[href^="/clubs/"] img[role="presentation"]');
  await expect(banners.first()).toBeVisible();
  expect(await banners.count()).toBeGreaterThan(1);
  await expect(banners.first()).toHaveAttribute("loading", "eager");
  await expect(banners.first()).toHaveAttribute("fetchpriority", "high");

  const deferred = banners.nth(1);
  await expect(deferred).toHaveAttribute("loading", "lazy");
  await expect(deferred).toHaveAttribute("fetchpriority", "auto");
});
