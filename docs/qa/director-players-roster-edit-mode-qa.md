# Director Players Roster Edit Mode QA

## Scope

The Players tab now provides a registration-only **Edit Players** control beside **Add Player**. It intentionally exposes removal controls only after the director enters edit mode, then requires an explicit confirmation before a player is removed. Once a tournament starts, the edit mode and its removal controls are automatically cleared, leaving the existing late-registration and withdrawal paths unchanged.

## Functional safeguards

The removal flow is limited by the existing `registration` lifecycle guard in `useDirectorState`. A confirmed removal clears the player from the roster and the local check-in set, so the check-in count, CSV export, and pairing eligibility cannot retain a stale player reference. For a provisional Quads setup, the same player ID is removed from every section's `playerIds` list before the tournament begins.

## Visual and interaction review

A sandbox Director roster was switched to a temporary registration state and reviewed on the Players tab. The default view showed the compact **Add Player** and **Edit Players** actions with no per-row destructive controls. Activating **Edit Players** changed the control to **Done** and revealed clearly labeled Remove actions at the far right of each desktop row. A Remove action opened a focused confirmation dialog with **Keep player** and **Remove player** choices, with copy explaining that the player will not be paired when the tournament begins.

The confirmation flow was exercised with a sandbox-only roster: the player count changed from 18 to 17, the player disappeared from the roster, and the success notice was shown. The original sandbox state was restored immediately afterward; no user or production tournament data was changed.

## Validation

| Check | Result |
|---|---|
| Focused Director regression tests | Passed: 97 tests across Director console, editing, and scoring suites. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file ESLint | Passed with 0 errors. Seven existing warnings remain in `Director.tsx` and `directorState.ts`. |
| Diff integrity | Passed: `git diff --check`. |
| Browser QA | Passed: default, edit-mode, cancellation, confirmed removal, and sandbox-state restoration. |

## Full-project checks

- `pnpm lint` completed with **0 errors** and 235 pre-existing warnings across the project.
- `pnpm build` passed.
- The full Vitest run produced **6,984 passing tests, 2 skipped, and 22 known unrelated failures** in 15 files. The failures remain in the established accessibility-overlay/form-label/global-landmark source contracts, retired Tournament Wizard payment-toggle contract, and tournament-format-card source contracts. The focused Director suites covering this change pass.

## Behavioral boundary

This is a pre-start roster management tool, not a withdrawal replacement. Directors still use the existing withdrawal/reinstate workflow once a tournament is underway, preserving completed pairings and results.
