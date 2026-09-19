# Director Players Hierarchy Cleanup QA

## Scope

The stale visual-edit targets were manually resolved inside the current Director Players tab. The full capacity-and-attendance summary strip was removed because it duplicated the authoritative count already beside **Roster**. The Players tab was then normalized to a larger type scale across the walk-in surface, roster controls, search, filters, roster identities, results metadata, actions, empty state, and start panel.

## Desktop visual verification

A live 18-player Director preview was reviewed after the update. The Players tab now begins with the compact Roster/search control instead of the duplicate capacity panel. The `18/18` roster count remains in one location, adjacent to the Roster title. Player names, usernames, scores, record data, filter controls, and actions are visibly larger while retaining a single-row desktop roster layout and readable action spacing.

## Mobile validation boundary

The responsive Director route correctly renders its mobile Home shell at 375px. The current tab selection is in-memory rather than route-addressable, so the isolated mobile capture cannot open Players directly. The mobile Players implementation continues to use the established `sm:hidden` card-stack fallback, and the reviewed source preserves responsive, wrapping control groups rather than a compressed desktop table. Desktop browser QA directly confirmed the altered Players tab.

## Automated validation

| Check | Result |
|---|---|
| Focused Director tests | Passed: 94 tests across console refinement, editing, and Director-only scoring suites. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file lint | 0 errors; six established unused-variable warnings in `Director.tsx` remain unchanged. |
| Production build | Passed: `pnpm build`. |
| Project lint | 0 errors; 235 existing repository warnings remain. |
| Full Vitest suite | 6,980 passing, 2 skipped, 20 failures in 14 unrelated established baseline source-contract/UI suites. |
| Diff integrity | Passed: `git diff --check`. |
