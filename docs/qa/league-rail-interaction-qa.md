# League rail interaction QA

**Scope:** Remove redundant hover-tooltip overlays from the shared expandable Club-style rail **only on the live Club League dashboard and public League demo**.

## Delivered behavior

- League rail actions no longer render hover or keyboard-focus tooltip overlays.
- The rail still expands on pointer hover and keyboard focus, revealing the same full navigation labels in place.
- Retained the existing 200ms hover response: restrained icon lift/scale, accent tint, border, and shadow; active destinations remain visually stronger.
- Removed now-unused League-only descriptions for Overview, Commissioner, Matchups, Standings, Schedule, History/Summary, Requests, Settings, and return actions.
- Club dashboards retain their existing tooltip behavior through a shared `showTooltips` option that defaults to `true`.
- Preserved routes, compact-to-expanded geometry, mobile navigation, focus rings, 52px desktop targets, and reduced-motion safeguards.

## Browser QA

- Live League dashboard (`/league/NlGsu0f5XroLQNzk`), desktop 1280×1100:
  - Hovering the rail expanded it cleanly and revealed Overview, Matchups, Standings, Schedule, and Back to club labels.
  - DOM inspection confirmed `data-club-sidebar-expanded="true"` and **zero** `[role="tooltip"]` elements.
  - No overlay covered adjacent League content.
- Captured desktop route snapshots for both the live League dashboard and `/league-demo`.

## Automated validation

| Check | Result |
| --- | --- |
| Focused shared-sidebar + League suites | 29 passing tests across 4 files |
| Targeted League tooltip-removal contract | Passed (1 test) |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; 1 established `LeagueDashboard` hook-dependency warning |
| Production build | Passed (`pnpm run build`) |
| Project lint | 0 errors; 225 established warnings |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | 7,282 passed, 2 skipped; 27 established unrelated failures across 19 suites |

The full-suite failures do not include the shared sidebar tests, compact-rail tests, responsive League tests, or Commissioner workspace tests. One pre-existing `leagueBacklogReconciliation` landing-navigation assertion remains stale outside this change; the updated tooltip-removal contract passes independently.
