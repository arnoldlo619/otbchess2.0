# Club Feed Composer Redesign QA

## Scope

This QA record covers the Club Feed post composer refinement: its compact-to-expanded sharing hierarchy, light and dark token model, responsive action layout, real attachment workflow, discard flow, and post submission contract. The latest refinement places the member identity in a dedicated header row and gives the expanded writing field the full composer width. It removes the decorative border-trace animation in favor of a static, theme-aware focus treatment and adds a functional toolbar for bold, italic, underline, bullet list, numbered list, quote, inline code, HTTP(S) link, and clear-formatting actions.

## Automated Validation

| Check | Result |
|---|---|
| Composer, Feed registry, and rich-text behavior | Passed: 28 focused tests |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 66 existing Club Dashboard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Project lint | Passed with 0 errors |
| Full Vitest suite | 6,963 passing, 2 skipped, and 17 established unrelated failures in accessibility-overlay, native form-label, and retired Tournament Wizard payment-toggle source-contract suites |
| Development server | Restarted cleanly after validation |

## Visual Review

The authenticated preview rendered `/clubs/w3m342vs/home` at desktop without horizontal overflow or layout breakage in the surrounding Club Feed. The preview identity was not an active member of the reviewed club, so the permission-gated composer correctly did not render. A later authenticated API check confirmed that this preview session no longer had an authenticated API identity. The compact and expanded composer states are consequently protected by source-level contracts and focused behavior tests in this validation pass; they should receive a final in-session visual spot-check when an active Club member or owner session is available. The detailed observation record is retained in `docs/qa/club-feed-composer-refinement-observations.md`.

## Preserved Product Behavior

The redesign retains the semantic post form, character counter, Escape-to-discard behavior, file type and size constraints, selected-file removal controls, async posting state, server-backed post payload, and the established author-or-owner deletion policy after publication. The formatting toolbar transforms the user’s selected text into a compact syntax stored in the existing post body. Announcements render that syntax through React nodes rather than injected HTML, and external links are limited to HTTP(S). It does not add voice, AI, GIF, or miscellaneous nonfunctional toolbar controls.
