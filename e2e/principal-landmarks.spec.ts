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

test.describe("principal route landmark semantics", () => {
  for (const route of principalRoutes) {
    test(`${route.path} exposes one main and uniquely named visible navigation regions`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();

      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.locator("main main, main [role='main']")).toHaveCount(0);

      const visibleNavigationNames = await page.locator("nav:visible").evaluateAll((elements) =>
        elements.map((element) => {
          const ariaLabel = element.getAttribute("aria-label")?.trim();
          if (ariaLabel) return ariaLabel;
          const labelledBy = element.getAttribute("aria-labelledby");
          if (!labelledBy) return "";
          return labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ");
        })
      );

      expect(visibleNavigationNames.every(Boolean), `${route.path}: every visible nav must be named`).toBe(true);
      expect(new Set(visibleNavigationNames).size, `${route.path}: visible nav names must be unique`).toBe(
        visibleNavigationNames.length
      );
    });
  }
});
