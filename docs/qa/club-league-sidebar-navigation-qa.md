# Club League Sidebar Navigation QA

**Scope:** Promote Club League from an Events subview to a first-class Club workspace destination, remove duplicate League creation controls, and remove the inaccurate `EVENTS` header label from the League workspace.

## Delivered behavior

- The Club sidebar includes a dedicated **League** destination beside Events.
- The League quick action, desktop sidebar, mobile drawer, app-level League discovery, and League dropdown now resolve to `?tab=leagues`.
- Events now renders only upcoming Club events; League content no longer appears beneath Events.
- League owners/directors see exactly one **New League** action in the workspace header. The former duplicate inline button is removed.
- The League header uses the same compact social-header system as Feed, Events, and Members, but intentionally omits the inaccurate `EVENTS` suffix.
- The read-only Club demo mirrors the dedicated League nav item and workspace hierarchy.

## Validation

| Check | Result |
|---|---|
| Focused Club, League, sidebar, auth, and wizard regressions | 93 passed across 9 suites |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; established warnings only |
| Production build | Passed (`pnpm run build`) |
| Local route health | 200: `/clubs/demo`, `/clubs/demo?tab=leagues`, `/clubs/demo?tab=events`, and `/clubs/otb-chess-club/home?tab=leagues` |
| Deprecated League subview search | No `tab=events&view=leagues`, `view=leagues`, or `eventsFilter` references remain in the Club Dashboard path |
| Desktop browser QA | Verified the Club demo sidebar opens a dedicated League workspace with a single League header and no Events suffix |
| Mobile visual QA | Verified the 390×844 Club demo layout retains the hamburger navigation entry point and avoids horizontal overflow |
| Full Vitest baseline | 7,131 passed, 2 skipped; 26 unrelated legacy failures across 17 suites |

## Notes

The project retains established unrelated ESLint warnings in `ClubDashboard.tsx`; no lint errors were introduced by this change. The full-suite baseline includes pre-existing failures outside this scope (including an unchanged Tournament Wizard payment-toggle source-contract expectation); all focused Club/League navigation coverage passes. The local Playwright package does not include a browser binary in this sandbox, so mobile League-drawer interaction was additionally covered by the focused source contracts and the managed browser/mobile screenshot evidence.
