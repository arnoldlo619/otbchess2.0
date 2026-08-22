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

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

test.describe("principal route focus order", () => {
  for (const route of principalRoutes) {
    test(`${route.path} follows DOM order with visible keyboard focus`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();

      const positiveTabIndexes = await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').evaluateAll((elements) =>
        elements.map((element) => ({
          html: element.outerHTML.slice(0, 220),
          tabIndex: element.getAttribute("tabindex"),
        })),
      );
      expect(positiveTabIndexes, `${route.path} uses positive tabindex values`).toEqual([]);

      const expectedCount = await page.locator(focusableSelector).evaluateAll((elements) =>
        elements.filter((element) => {
          if (!(element instanceof HTMLElement)) return false;
          if (element.tabIndex < 0) return false;
          if (element.closest('[inert], [aria-hidden="true"]')) return false;
          const styles = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        }).slice(0, 10).length,
      );

      expect(expectedCount, `${route.path} should expose keyboard controls`).toBeGreaterThan(0);

      await page.evaluate(() => {
        const sentinel = document.createElement("span");
        sentinel.id = "focus-audit-sentinel";
        sentinel.tabIndex = -1;
        document.body.prepend(sentinel);
        sentinel.focus();
      });

      for (let index = 0; index < expectedCount; index += 1) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(({ selector, expectedIndex }) => {
          const visibleFocusable = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
            if (element.tabIndex < 0) return false;
            if (element.closest('[inert], [aria-hidden="true"]')) return false;
            const styles = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          });
          const active = document.activeElement as HTMLElement | null;
          const expected = visibleFocusable[expectedIndex] ?? null;
          const styles = active ? window.getComputedStyle(active) : null;
          return {
            matchesExpected: active === expected,
            activeHtml: active?.outerHTML.slice(0, 240) ?? "",
            expectedHtml: expected?.outerHTML.slice(0, 240) ?? "",
            hidden: active ? Boolean(active.closest('[inert], [aria-hidden="true"]')) : true,
            hasFocusIndicator: Boolean(
              styles &&
              ((styles.outlineStyle !== "none" && Number.parseFloat(styles.outlineWidth) >= 2) || styles.boxShadow !== "none"),
            ),
          };
        }, { selector: focusableSelector, expectedIndex: index });

        expect(state.hidden, `${route.path} focused hidden content: ${state.activeHtml}`).toBe(false);
        expect(state.matchesExpected, `${route.path} focus order mismatch\nActive: ${state.activeHtml}\nExpected: ${state.expectedHtml}`).toBe(true);
        expect(state.hasFocusIndicator, `${route.path} lacks visible focus treatment: ${state.activeHtml}`).toBe(true);
      }
    });
  }
});
