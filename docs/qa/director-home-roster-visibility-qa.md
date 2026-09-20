# Director Home Check-In Roster Visibility QA

## Scope

The stale visual-edit target at `Director.tsx:3800` resolved to the registration-phase **Check-In Roster** card on the Director Home tab. This pass raises the card's typography, identity, rating, payment, and summary hierarchy to match the more readable Players and Standings tabs without changing roster, check-in, payment, edit, or removal behavior.

## Direct visual review

A sandbox-only Director registration state with 18 players was reviewed at desktop width. The Check-In Roster heading, check-in and payment progress badges, search field, desktop column labels, player identity, status chips, ELO values, Cash/Card controls, and payment footer are visibly larger and retain clear contrast in the existing dark surface. The desktop rows remain aligned on their shared grid, with no clipping or horizontal overflow. The review used only temporary browser storage and will be restored before final validation.

## Responsive design coverage

Mobile continues to use the existing card fallback rather than the desktop grid. Its player identity, rating/status labels, avatars, payment controls, and spacing now scale together; the preserved action controls remain explicit and keyboard-accessible.

The final control pass keeps Cash and Card actions at a 44px minimum touch height on mobile and a 44px-equivalent `min-h-11` height on desktop, while retaining the existing `aria-pressed` state and clear textual labels.

## Validation

| Check | Result |
|---|---|
| Focused Director and roster tests | Passed: 119 tests across console refinement, editing, scoring, and CSV coverage. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | 0 errors; six established unused-variable warnings in `Director.tsx` remain unchanged. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 established repository warnings remain. |
| Full Vitest suite | 6,981 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |
