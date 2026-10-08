# Club Dashboard Sidebar Branding and Footer QA

## Scope

Standardize the desktop Club Dashboard navigation rail across the real workspace, demo workspace, Club Meetup, and event check-in pages.

## Implemented behavior

- The sidebar header always renders the ChessOTB **OTB!! thumbnail mark**; uploaded Club avatars no longer replace this platform navigation identity.
- The header mark remains the accessible action for returning to the Club context.
- **Feed** now uses the `MessagesSquare` communication icon and **Members** uses the `UsersRound` community icon.
- Existing chess-native icons remain unchanged for Album, Events, League, and Settings.
- The redundant `Back to Club` desktop footer action is removed.
- **Settings** is now the footer action, where available to the current user.
- The demo, Meetup, and check-in contexts use the same shared sidebar and footer behavior.

## Validation

- Focused Vitest: 28 assertions passed across shared sidebar, compact rail, private Club demo, and Club League navigation coverage.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Targeted ESLint: no errors; established warnings only.
- Project lint: 0 errors and 234 established warnings.
- Production build: passed.
- Local route health: `/clubs/demo`, Feed, Events, and League views returned HTTP 200.
- Desktop visual review: verified the compact rail and expanded 261 px sidebar at 1440×900; the OTB!! brand button, new Feed/Members glyphs, and bottom-aligned Settings control are all visible and non-overlapping.
- Mobile screenshot review: the existing responsive hamburger navigation remains intact.
- Full Vitest baseline: 7,165 passed, 2 skipped, and 25 unrelated legacy failures across 17 suites; the focused Club sidebar suites pass cleanly.

## Notes

- The recurring `cv_queue_poll_error` in the dev-server log is an unrelated background CV queue/database issue and did not affect Club route rendering or validation.
