import AxeBuilder from "@axe-core/playwright";
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

const themes = ["dark", "light"] as const;

test.describe("principal route Axe baseline", () => {
  for (const theme of themes) {
    for (const route of principalRoutes) {
      test(`${route.path} in ${theme} theme has no critical or serious Axe violations`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.addInitScript((selectedTheme) => {
          window.localStorage.setItem("theme", selectedTheme);
        }, theme);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
          .toBe(theme === "dark");
        await page.evaluate(async () => {
          const viewportStep = Math.max(window.innerHeight * 0.8, 320);
          for (let y = 0; y < document.documentElement.scrollHeight; y += viewportStep) {
            window.scrollTo(0, y);
            await new Promise((resolve) => window.setTimeout(resolve, 40));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(250);

        const results = await new AxeBuilder({ page }).analyze();
        const blockers = results.violations
          .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.slice(0, 20).map((node) => ({
              target: node.target.join(" "),
              html: node.html,
              summary: node.failureSummary,
            })),
          }));

        expect(blockers, `${route.path} (${theme})\n${JSON.stringify(blockers, null, 2)}`).toEqual([]);
      });
    }
  }
});
