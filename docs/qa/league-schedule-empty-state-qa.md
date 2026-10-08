# League Schedule Empty-State Crash Repair QA

**Scope:** Club League Dashboard → Schedule navigation for pre-season Full Season Leagues.

## Root cause

Draft Full Season Leagues correctly have no persisted `league_weeks` until the commissioner generates the season. `LeagueMonthCalendar` assumed a first week was always present and attempted to access `weeks[0].deadline`, causing `Cannot read properties of undefined (reading 'deadline')` and activating the global error boundary.

## Repair

- Made the calendar date resolver accept an absent week safely.
- Added a deliberate pre-season Schedule state rather than rendering invalid week controls.
- Changed the header summary to **Draft / Not generated** and labels the duration as a season rather than scheduled weeks when no fixtures exist.
- Suppressed the selected-week matchup details panel until real weeks are available.
- Added source and server-rendered regression coverage for an empty draft schedule.

## Validation

| Check | Result |
|---|---|
| Reproduction | Confirmed on persisted draft Full Season League `LEXTY-W_TW2YuLY8`: Schedule crashed before repair |
| Browser regression | After repair, clicking Schedule rendered **“Schedule opens when the season begins”** with no error boundary |
| Existing active League | Verified Schedule still renders its interactive monthly weeks and matchup details |
| Focused tests | **53 passed** across Schedule, lifecycle, and demo responsiveness suites |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Project lint | passed with **0 errors** and 233 established warnings |
| Production build | `pnpm run build` passed |
| Diff integrity | `git diff --check` passed |

## Full-suite baseline

`pnpm vitest run` reports **7,193 passed, 2 skipped, 29 unrelated legacy failures across 17 suites**. The added Schedule test passes. The known unrelated failures include stale source-contract expectations such as `tournamentWizardPaymentToggle.test.ts`.
