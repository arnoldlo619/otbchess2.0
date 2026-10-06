# Active Tournament Banner — Creation Flow QA

**Date:** 2026-10-06

## Scope

Prevent the persistent **ActiveTournamentBanner** from overlapping the full-screen Tournament Wizard at any creation step, whether it is opened from the landing page or a Club Dashboard.

## Implementation

- Moved wizard activity state into `client/src/lib/tournamentWizardActivity.ts`.
- The wizard records its mounted/open lifecycle and emits an in-page activity event.
- `ActiveTournamentBanner` subscribes to that event and returns no banner while the wizard is active.
- Home uses the shared signal for restored, opened, and closed wizard sessions.
- Existing tournament-route and join-flow suppression remain unchanged.

## Verification

| Check | Result |
| --- | --- |
| Rendered active banner outside creation flow | Passed |
| Rendered banner suppression while wizard activity is active | Passed |
| Wizard lifecycle ownership across entry points | Passed by source and rendered contract coverage |
| Existing join-flow visibility coverage | Passed |
| Focused Vitest | **35/35 passed** across 2 files |
| TypeScript | Passed with 0 errors |
| Changed-file ESLint | Passed with 0 errors; 9 established `TournamentWizard` warnings remain |
| Production build | Passed |
| Local and public preview HTTP checks | `200` / `200` |
| Diff integrity | Passed (`git diff --check`) |

## Notes

A temporary active-tournament browser fixture was removed after QA. The browser had retained one stale hot-module error referencing the old exported activity key during the file move; a fresh navigation loaded the updated Home page successfully, and TypeScript plus production build verified the resolved import graph.
