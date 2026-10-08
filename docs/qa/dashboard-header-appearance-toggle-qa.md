# Dashboard Header Appearance Toggle QA

**Scope:** Tournament dashboards and Club dashboards (live and fixture-only demo)  
**Date:** 2026-10-08  
**Status:** Complete

## Delivered

- Added the shared `ThemeToggle` to `MinimalTournamentNav`, so player and director tournament dashboards receive the same appearance control as the landing header.
- Added the control to the live Club Dashboard header, ahead of the mobile navigation/account actions.
- Added the same control to the `/clubs/demo` header so the preview stays aligned with the production workspace.
- Preserved the existing centralized `ThemeContext` behavior, accessible labels, hover/focus styling, and user preference persistence.

## Validation

| Check | Result |
| --- | --- |
| Dashboard header source contracts | 20 passing tests across 4 focused suites |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; established warnings only |
| Project lint | 0 errors; 234 established warnings |
| Production build | `pnpm run build` passed |
| Local route health | `/tournament/otb-demo-2026`, `/clubs/demo`, and `/clubs/demo?tab=feed` returned HTTP 200 |
| Browser QA | Desktop tournament, desktop Club demo, and 390px Club demo toggle labels changed from “Switch to light mode” to “Switch to dark mode” after activation; controls stayed visible and non-overlapping |
| Full Vitest baseline | 7,171 passed, 2 skipped, with 28 unrelated established failures in 17 legacy suites; the new dashboard appearance suite passed |

## Responsive Evidence

- **Tournament desktop:** Toggle sits before the account control at the upper-right, without affecting the centered share/print action group.
- **Club desktop:** Toggle sits after the demo status badge and before account/navigation controls.
- **Club mobile (390px):** Toggle remains between the Club identity and hamburger control with no collision or horizontal overflow.

## Notes

The app theme provider expresses light appearance by removing the `dark` class from the document root; it does not add a separate `light` class. This is the established global appearance contract and was exercised successfully in browser QA.

The full-suite failures are outside this scope. The reported Tournament Wizard payment-toggle source contract, for example, targets a file unchanged since the prior Club navigation checkpoint.
