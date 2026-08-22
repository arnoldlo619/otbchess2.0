import { expect, test } from "@playwright/test";

test("landing content remains readable when external font providers are unavailable", async ({ page }) => {
  await page.route(/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|cdn\.fontshare\.com)/, (route) => route.abort());

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: /Chess Clubs, Chess Tournaments/i });
  await expect(heading).toBeVisible();
  await expect(page.getByRole("link", { name: "Join a Tournament", exact: true }).first()).toBeVisible();

  const rendered = await heading.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      fontFamily: styles.fontFamily,
      visibility: styles.visibility,
      opacity: Number.parseFloat(styles.opacity),
      width: rect.width,
      height: rect.height,
    };
  });

  expect(rendered.fontFamily).toContain("sans-serif");
  expect(rendered.visibility).toBe("visible");
  expect(rendered.opacity).toBeGreaterThan(0);
  expect(rendered.width).toBeGreaterThan(0);
  expect(rendered.height).toBeGreaterThan(0);
});
