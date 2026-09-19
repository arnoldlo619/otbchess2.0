# Hero Dashboard Mockup Width QA

## Design adjustment

The stale visual-edit selector was manually resolved to the outer `HeroDashboardMockup` wrapper. The narrow `max-w-5xl` frame was replaced with a viewport-aware product-preview width that retains intentional page gutters, caps at `82rem`, and remains centered independently of the text container. The existing full-width image, frame, motion, dark/light source swap, and desktop-only behavior are unchanged.

## Desktop visual review

A 1440px preview confirms the mockup now occupies nearly the full hero width while retaining a balanced 32px outer gutter and a clear relationship to the centered hero copy. The frame remains below the CTAs, stays visually contained, and has no horizontal overflow.

## Mobile visual review

A 375px preview remains clean and contains no horizontal overflow. The mockup remains intentionally hidden below the `md` breakpoint, preserving the existing mobile-first hero focus on the announcement, headline, and primary actions.

## Automated validation

| Check | Result |
|---|---|
| Focused Hero mockup contract | Passed: 1 test. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | Passed with 0 errors or warnings. |
| Project lint | 0 errors; 236 existing repository warnings remain. |
| Production build | Passed: `pnpm build`. |
| Full Vitest suite | 6,978 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |
