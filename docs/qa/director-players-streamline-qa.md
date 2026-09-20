# Director Players Streamline QA

## Scope

This update manually resolved three stale visual-edit targets in the Director Players tab. The redundant **Check in a walk-in** card and its local enrollment path were removed in favor of the existing **Add Player** flow. The Title and Country filtering system was removed together with its Filters button, leaving search and Rank, Points, ELO, and Name sorting as the focused roster controls. **Download CSV** now sits at the far end of the sort row.

## Desktop visual verification

The live 18-player Director preview was reviewed after the update. The Players view now opens directly to the roster toolbar without the walk-in panel. No Filters button or expanded filter controls are present. The Search field, Refresh ELO action, sort controls, and the right-aligned Download CSV action render cleanly above the roster. The player list, score data, Bye, and Withdraw controls remain available.

## Mobile review boundary

The 375px Director route renders without horizontal overflow. The active tab is in-memory rather than route-addressable, so the isolated screenshot tool cannot force the Players tab directly; the Players controls use wrapping flex layouts and retain the established `sm:hidden` roster card fallback. Desktop browser QA directly verified the changed Players state.

## Automated validation

| Check | Result |
|---|---|
| Focused Director and CSV tests | Passed: 117 tests across console refinement, editing, scoring, and roster CSV coverage. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | 0 errors; six established unused-variable warnings in `Director.tsx` remain unchanged. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 established repository warnings remain. |
| Full Vitest suite | 6,979 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |

## Action-row refinement

The refresh action was moved from the roster header to the sort row, directly beside the CSV export. The CSV control is now visually icon-only while retaining a 44px minimum touch target, tooltip, and explicit accessible name.

A live desktop review of the 18-player Director roster confirms that the top row now contains only roster identity and search. The lower row groups Sort controls on the left with Refresh ELO and a compact download icon on the right; the icon exposes **Download player roster as CSV** to assistive technology.

The 375px route shell remains free of horizontal overflow. Because the isolated capture starts at the route’s default Home tab and tab state is not URL-addressable, the updated Players row was verified directly in the live desktop browser; its wrapping flex container and retained 44px action targets protect the compact layout.

## Validation update

| Check | Result |
|---|---|
| Focused Director and CSV tests | Passed: 117 tests across console refinement, editing, scoring, and roster CSV coverage. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | 0 errors; six established unused-variable warnings in `Director.tsx` remain unchanged. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 established repository warnings remain. |
| Full Vitest suite | 6,979 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |

## Registration-action alignment refinement

The Add Player and Upload RSVPs action group now uses `self-end sm:ml-auto`, anchoring it to the far right of the roster header at desktop widths, in line with the Refresh ELO and CSV group below. On compact widths it remains independently right-aligned and continues to wrap without squeezing the search field or reducing control touch targets.

A sandbox-only registration-state review with 18 players confirmed Upload RSVPs and Add Player now land at the same far-right edge as the lower Refresh ELO and CSV controls. The search field retains its constrained reading width, and the two action rows form a clean vertical right alignment. The temporary browser state was restored after review.

## Alignment validation update

| Check | Result |
|---|---|
| Focused Director and CSV tests | Passed: 118 tests across console refinement, editing, scoring, and roster CSV coverage. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | 0 errors; six established unused-variable warnings in `Director.tsx` remain unchanged. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 established repository warnings remain. |
| Full Vitest suite | 6,980 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |
