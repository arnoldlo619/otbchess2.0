import { expect, test } from "@playwright/test";

const principalRoutes = [
  { path: "/", ready: /Chess Clubs/i },
  { path: "/auth", ready: /Welcome back/i },
  { path: "/pricing", ready: /Simple, honest pricing/i },
  { path: "/clubs", ready: /Discover Chess Clubs/i },
  { path: "/join", ready: /Join Tournament/i },
  { path: "/tournaments", ready: /^Archive$/i },
  { path: "/league-demo", ready: /^ChessOTB Club League$/i },
  { path: "/prep", ready: /Prepare for your next match/i },
  { path: "/tournament/otb-demo-2026", ready: /OTB!! Open 2026/i },
  { path: "/tournament/otb-demo-2026/manage", ready: /OTB!! Open 2026/i },
] as const;

type VitalWindow = Window & {
  __otbVitals?: { lcp: number; cls: number; lcpElement: string; lcpUrl: string };
};

test.describe("principal route web-vital budgets", () => {
  for (const route of principalRoutes) {
    test(`${route.path} stays within warm-cache LCP and CLS budgets`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(() => {
        const target = window as VitalWindow;
        target.__otbVitals = { lcp: 0, cls: 0, lcpElement: "unknown", lcpUrl: "none" };

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime < target.__otbVitals!.lcp) continue;
            target.__otbVitals!.lcp = entry.startTime;
            const lcpEntry = entry as PerformanceEntry & { element?: Element; url?: string };
            const element = lcpEntry.element;
            target.__otbVitals!.lcpElement = element
              ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${Array.from(element.classList).slice(0, 3).join(".")}:${element.textContent?.trim().slice(0, 60) ?? ""}`
              : "unknown";
            const rawUrl = lcpEntry.url || element?.getAttribute("src") || "none";
            if (rawUrl.startsWith("data:")) {
              target.__otbVitals!.lcpUrl = `${rawUrl.slice(0, 32)}…`;
            } else {
              try {
                target.__otbVitals!.lcpUrl = new URL(rawUrl, window.location.href).pathname;
              } catch {
                target.__otbVitals!.lcpUrl = rawUrl.slice(0, 120);
              }
            }
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
            if (!entry.hadRecentInput) target.__otbVitals!.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      // Warm the Vite module graph and browser cache. Production cold-load evidence
      // remains a separate deployment check because sandbox builds are resource-bound.
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const coldMetrics = await page.evaluate(() =>
        (window as VitalWindow).__otbVitals ?? { lcp: 0, cls: 0, lcpElement: "unknown", lcpUrl: "none" }
      );
      console.log(
        `[web-vitals:cold] ${route.path} LCP=${coldMetrics.lcp.toFixed(0)}ms CLS=${coldMetrics.cls.toFixed(3)} element=${coldMetrics.lcpElement} url=${coldMetrics.lcpUrl}`
      );
      if (route.path === "/clubs") {
        const resourceTimings = await page.evaluate(() =>
          performance.getEntriesByType("resource")
            .filter((entry) => entry.name.includes("/api/clubs") || entry.name.includes("exit-chess-club"))
            .map((entry) => {
              const resource = entry as PerformanceResourceTiming;
              return {
                name: new URL(resource.name).pathname,
                startTime: Math.round(resource.startTime),
                responseStart: Math.round(resource.responseStart),
                responseEnd: Math.round(resource.responseEnd),
                transferSize: resource.transferSize,
              };
            })
        );
        console.log(`[web-vitals:resources] /clubs ${JSON.stringify(resourceTimings)}`);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();
      await page.waitForTimeout(800);

      const metrics = await page.evaluate(() => (window as VitalWindow).__otbVitals ?? { lcp: 0, cls: 0, lcpElement: "unknown", lcpUrl: "none" });
      console.log(`[web-vitals:warm] ${route.path} LCP=${metrics.lcp.toFixed(0)}ms CLS=${metrics.cls.toFixed(3)} element=${metrics.lcpElement} url=${metrics.lcpUrl}`);

      expect(metrics.lcp, `${route.path}: LCP`).toBeGreaterThan(0);
      expect(metrics.lcp, `${route.path}: LCP`).toBeLessThanOrEqual(2_500);
      expect(metrics.cls, `${route.path}: CLS`).toBeLessThanOrEqual(0.1);
    });
  }
});
