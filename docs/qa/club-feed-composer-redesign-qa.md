# Club Feed Composer Redesign QA

## Scope

This QA record covers the Club Feed post composer refinement: its expanded sharing hierarchy, light and dark token model, responsive action layout, real attachment workflow, discard flow, and post submission contract.

## Automated Validation

| Check | Result |
|---|---|
| Composer and Feed registry contracts | Passed: 24 focused tests |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; existing Club Dashboard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Project lint | Passed with 0 errors |
| Full Vitest suite | 6,959 passing, 2 skipped, and 17 pre-existing failures in unrelated accessibility-overlay, native form-label, and retired Tournament Wizard payment-toggle source-contract suites |
| Development server | Restarted cleanly after validation |

## Visual Review

The authenticated preview rendered `/clubs/w3m342vs/home` at desktop and at 375px without horizontal overflow or layout breakage in the surrounding Club Feed. The preview identity was not an active member of the reviewed club, so the permission-gated composer correctly did not render. The expanded composer is consequently protected by source-level contracts and focused behavior tests in this validation pass; it should receive a final in-session visual spot-check when an active Club member or owner session is available.

## Preserved Product Behavior

The redesign retains the semantic post form, character counter, Escape-to-discard behavior, file type and size constraints, selected-file removal controls, async posting state, server-backed post payload, and the established author-or-owner deletion policy after publication.
