import { expect, test } from "@playwright/test";

const principalRoutes = [
  { path: "/", ready: /Chess Clubs/i },
  { path: "/auth", ready: /Welcome back/i },
  { path: "/pricing", ready: /Simple, honest pricing/i },
  { path: "/join", ready: /Join Tournament/i },
  { path: "/tournaments", ready: /^Archive$/i },
  { path: "/league-demo", ready: /^ChessOTB Club League$/i },
  { path: "/prep", ready: /Prepare for your next match/i },
  { path: "/tournament/otb-demo-2026", ready: /OTB!! Open 2026/i },
  { path: "/tournament/otb-demo-2026/manage", ready: /OTB!! Open 2026/i },
] as const;

test.describe("principal route reduced-motion fallback", () => {
  for (const route of principalRoutes) {
    test(`${route.path} renders complete content without prolonged CSS motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();

      const motionPreference = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      expect(motionPreference).toBe(true);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(50);

      const prolonged = await page.locator("body *:visible").evaluateAll((elements) =>
        elements
          .map((element) => {
            const styles = window.getComputedStyle(element);
            return {
              html: element.outerHTML.slice(0, 220),
              animationDuration: styles.animationDuration,
              transitionDuration: styles.transitionDuration,
            };
          })
          .filter(({ animationDuration, transitionDuration }) => {
            const parse = (value: string) => Math.max(
              ...value.split(",").map((duration) => {
                const normalized = duration.trim();
                if (normalized.endsWith("ms")) return Number.parseFloat(normalized);
                if (normalized.endsWith("s")) return Number.parseFloat(normalized) * 1000;
                return 0;
              }),
            );
            return parse(animationDuration) > 20 || parse(transitionDuration) > 20;
          }),
      );

      expect(prolonged, `${route.path} has prolonged reduced-motion styles`).toEqual([]);
    });
  }

  test("state-changing Auth and Archive controls retain explicit feedback", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByRole("textbox", { name: "Display name" })).toBeVisible();

    await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
    const filters = page.getByTestId("archive-filter-toggle");
    await expect(filters).toHaveAccessibleName("Show tournament filters");
    await filters.click();
    await expect(filters).toHaveAccessibleName("Hide tournament filters");
    await expect(filters).toHaveAttribute("aria-expanded", "true");
  });
});
