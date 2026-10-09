# League Dashboard Content Readability QA

**Scope:** Standard Club League dashboards and `/league-demo` main content surfaces.

## Change

- Added a scoped `league-content-scale` to both League dashboard content shells.
- Lifted dense metadata, labels, body copy, and standard content text without changing the hero/header typography or its action/metric layout.
- Preserved responsive layout behavior: desktop content uses a 13px metadata / 14px label / 16px body baseline; mobile retains a compact but readable 12px metadata / 13px label / 15px body baseline.
- Applied the same treatment to all main tabs, including overview, matchups, standings, schedule, history, settings, Full Season panels, and the right-side upcoming-matchups panel.
- Kept visual hierarchy intact: existing heading scales remain untouched, while dense supporting content is no longer rendered at 9–12px on desktop.

## Regression coverage

`client/src/__tests__/leagueContentReadability.test.ts`

- Confirms the standard and demo League dashboards import the shared scale.
- Confirms the scale is attached to each main content shell.
- Confirms small metadata and body tokens are raised under responsive rules.
- Guards the header hero from accidental inclusion in the content-only styling scope.

## Validation

| Check | Result |
| --- | --- |
| Focused League suites | **19 passed** across readability, responsive containment, Schedule calendar, and profile presentation suites |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 6 existing `LeagueDashboard.tsx` warnings |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | Local `/league-demo`, active League, and draft League routes returned HTTP 200 |
| Browser visual QA | Desktop and mobile captures verified the expanded readable content scale on the demo and standard League dashboards |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,198 passed, 2 skipped, and 31 known unrelated failures across 19 existing suites**. The readability, League responsive, Schedule, and profile suites all pass; no failure references the new content-scale implementation.

## Notes

The scale is intentionally scoped to `.league-content-scale`, so League hero actions, metrics, and cross-platform header geometry remain independently controlled. The CSS also does not introduce continuous motion and respects the platform’s reduced-motion approach.
