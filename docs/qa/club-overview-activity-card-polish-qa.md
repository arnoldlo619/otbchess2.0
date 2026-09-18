# Club Overview Activity Card Polish QA

## Scope

This verification resolves the stale visual-edit targets in `ClubDashboard.tsx`. The existing **Recent Activity** cards were still present and were manually refined to improve title hierarchy and scanability while removing the decorative activity-type SVGs requested by the edit instruction.

## Implemented Changes

Each activity `<article>` now has a larger responsive minimum height, increased image treatment, and a more generous spacing rhythm. Post titles now use semantic `h2` elements with a responsive `text-base` to `text-lg` scale rather than small paragraph text. Decorative trophy, update, event, and poll SVG type icons were removed from the text column. The useful, readable activity category remains integrated into the media label, so card type is still clear without redundant iconography.

## Validation

| Check | Result |
|---|---|
| Target inspection | Confirmed that both requested targets remained present before the manual patch |
| Focused regression coverage | Passed: 19 tests across activity-card and Club Operations dashboard suites |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 66 existing Club Dashboard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Project lint | Passed with 0 errors; 236 pre-existing warnings remain |
| Full Vitest suite | 6,965 passing, 2 skipped, and 18 established unrelated source-contract failures in tournament-format-card, accessibility-overlay, native form-label, and retired Wizard payment-toggle coverage |
| Browser review | The public Feed shell loaded without page-level breakage; owner-only Overview cards were not available to the unauthenticated preview identity |

## Visual QA Boundary

The accessible preview route resolved to the public **Feed** tab rather than the owner-only Overview tab, so the updated Recent Activity cards could not be directly captured in the browser. Source-level tests protect the larger card geometry, `h2` title hierarchy, and absence of the removed SVGs. No feed data, membership, or club configuration was modified during verification.
