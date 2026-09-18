# Club Feed Card Hierarchy QA

## Scope

This refinement removes duplicate metadata from completed tournament-result cards and aligns the Feed card heading scale with the Club Overview Recent Activity cards.

## Design Resolution

Completed tournament-result cards now expose a single accent date marker at the start of the header and one `h2` result title. The secondary **Tournament results** label and relative-date text are intentionally suppressed for this type, preventing the repeated wording and conflicting dates shown in the reported interface. Optional format and player-count metadata remains available beneath the title when present. Other Feed cards now also use the same responsive `h2` scale as the Overview activity cards: `text-base` at compact widths and `text-lg` from the small breakpoint upward.

## Validation

| Check | Result |
|---|---|
| Focused Feed hierarchy, feed registry, and Overview-card coverage | Passed: 27 tests |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 66 existing Club Dashboard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Project lint | Passed with 0 errors; 236 existing warnings remain |
| Full Vitest suite | 6,967 passing, 2 skipped, and 18 established unrelated source-contract failures in tournament-format-card, accessibility-overlay, native form-label, and retired Wizard payment-toggle coverage |
| Browser review | Confirmed on the public Club Feed that completed-result headers now show one date marker and omit the duplicated secondary result label and relative timestamp |

The Feed card link, tournament results visual, optional result metadata, post rendering, pin affordance, and author-or-owner deletion behavior remain unchanged.
