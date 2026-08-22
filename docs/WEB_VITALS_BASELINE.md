# Principal Route Web Vitals Baseline

**Audit date:** 2026-08-22  
**Scope:** Nine principal public, participant, and director routes at desktop and mobile Playwright viewports.

## Enforced budgets

| Metric | Budget | Result |
|---|---:|---|
| Largest Contentful Paint | ≤2,500 ms | Passed on all 18 route/viewport combinations |
| Cumulative Layout Shift | ≤0.10 | Passed on all 18 route/viewport combinations |

The regression lives in `e2e/principal-web-vitals.spec.ts`. It uses Chromium `PerformanceObserver` entries for `largest-contentful-paint` and `layout-shift`, excludes shifts following recent input, emulates reduced motion, and records the LCP element for failure diagnosis.

## Measurement method

Each route is opened once to warm the Vite module graph, browser cache, and external web fonts. The harness records that cold diagnostic, waits for `document.fonts.ready`, reloads the route, then enforces the budgets on the warmed navigation after the route’s stable content appears. This prevents first-run development-module transforms and an in-flight font request from being misclassified as product LCP.

The League demo initially produced intermittent 2.7–3.2 second readings because the measured reload started before the Clash Display request completed. Once the warm-up explicitly awaited the font set, three repeated League checks passed and identified its heading LCP at 728 ms in the representative run. The full 18-check matrix then passed without product layout changes.

## Interpretation

This is a **lab-equivalent warm-cache regression**, suitable for catching future route rendering and layout-stability regressions in the development environment. It is not a substitute for production field data or a throttled cold-load Lighthouse run. The production build remains resource-limited in the sandbox, so cold production budgets should be confirmed after the next publish through the live analytics or an external Lighthouse run.

## Cached client-route transitions

`e2e/cached-route-transitions.spec.ts` enforces a **500 ms router-commit budget** on representative Pricing-to-Join and Pricing-to-Home navigation at desktop and mobile widths. Each destination is first opened and returned from inside the same application document so the route component is present in the `React.lazy` cache. The measured second activation excludes pre-click scrolling, verifies the URL commit and destination content, and rejects any flash of the full-screen “Preparing the board” fallback. All four route/viewport checks pass.

Uncached lazy-route transitions now use the same branded chess loader in a bounded, in-flow surface rather than replacing the viewport with the full-page loader. `route-loader-behavior.spec.ts` deliberately delays the Blog route chunk, confirms the compact loader is visible and shorter than the viewport, rejects `.otb-loader-page`, and verifies destination rendering on desktop and mobile.

## Interaction responsiveness

`e2e/principal-interaction-performance.spec.ts` establishes two complementary budgets at desktop and mobile widths. A real Pricing FAQ toggle is observed through Chromium Event Timing and must remain at or below the **200 ms INP-equivalent budget**. A real Quads Director draw result measures click-to-DOM-commit feedback and must remain at or below **100 ms**, after which the persisted `½–½` result is verified in the rendered board row. The eight repeated route/viewport checks pass.

The result-feedback metric intentionally measures the actual state commit rather than animation-frame scheduling, which can vary under sandbox load even after React has completed the visible state update.

## Font loading and FOIT resilience

Both external font stylesheets request `display=swap`, and the document preconnects to Google Fonts, Google font binaries, and Fontshare before loading their CSS. Body, display, and monospace stacks retain immediate system or generic fallbacks. `fontLoadingStrategy.test.ts` protects these source policies, while `font-loading-fallback.spec.ts` blocks every external font provider and confirms the landing headline and primary action remain visible with non-zero geometry on desktop and mobile. This prevents external font latency or provider failure from making core content invisible.

## Decorative animation main-thread budget

`e2e/decorative-animation-performance.spec.ts` warms the animation-heavy landing route, confirms normal-motion animations are actively running, clears startup work, and observes Chromium `longtask` entries during a two-second sustained-motion window. Four repeated desktop/mobile checks produced **zero main-thread tasks over 50 ms**, so no visual motion reduction was required. Reduced-motion behavior remains covered separately by the principal reduced-motion suite.
