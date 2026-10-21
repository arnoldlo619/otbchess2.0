# Live League Player Overview — Head-to-Head QA

**Scope:** Production `LeagueDashboard` player Overview only. The League Demo was intentionally not changed.

## Delivered experience

- Replaced the compact current-matchup row with a clear, player-first head-to-head presentation.
- Both players use their Chess.com profile photo when available, with the saved avatar and initials fallback retained for unavailable photos.
- Raised the profile treatment to **72px desktop** and a still-prominent **64px mobile**, while keeping both players side by side on narrow viewports.
- Added accessible color labels, current League ratings, a centered `VS` focal point, and a completed-games-only head-to-head summary bar.
- The summary derives from actual finalized meetings between the two current opponents; no placeholder history is shown.
- Preserved profile-card navigation, the existing League form summary, Prep Scout action, keyboard focus treatments, and motion-reduction behavior.

## Avatar cache reliability correction

During authenticated browser QA, the live roster arrived after the batch avatar hook's empty initial render. Although the Chess.com proxy had already returned valid profile-image URLs, cache-backed values were not reconciled into hook state after the username list changed, leaving initials visible.

`useChessAvatars` now reconciles memory/session cache entries whenever the normalized roster key changes and resets its loading state only when a network fetch is actually required. A regression test covers a late-arriving League roster with an existing session-cached photo.

## Focused validation

- `pnpm vitest run tests/use-chess-avatar.test.ts client/src/__tests__/leagueCurrentMatchupAvatar.test.ts client/src/__tests__/leagueContentReadability.test.ts`
  - **3 files / 11 tests passed**
- `pnpm exec tsc --noEmit --pretty false` passed.
- Changed-file ESLint reported **0 errors** and one pre-existing `react-hooks/exhaustive-deps` warning in `LeagueDashboard.tsx:980`.
- `git diff --check` passed before release validation.

## Authenticated browser QA

A temporary two-player active League fixture was created solely for QA with two completed prior meetings (one win, one draw) and one current pending meeting, then removed in full after the test.

| Viewport | Result |
| --- | --- |
| Desktop, 1440px | Both real Chess.com profile photos resolved at **72 × 72px**; ratings, color labels, centered `VS`, and `1W / 1D / 0W` head-to-head data rendered correctly. |
| Mobile, 390px | Both real Chess.com profile photos resolved at **64 × 64px** and stayed side by side. The card was contained from x=16 to x=374 (**358px** wide), both full player names fit, the head-to-head bar was visible, and no horizontal overflow occurred. |
| Dark appearance | Confirmed active for both responsive checks, with readable foreground, muted metadata, rating, and contrast-safe result accents. |

The temporary QA Club, League, League players, weeks, matches, standings, browser session, and test account were deleted after verification; a follow-up database check returned zero QA records.

## Release validation

| Check | Result |
| --- | --- |
| Production build | Passed (`pnpm run build`) |
| Project lint | 0 errors, 225 established warnings |
| Full Vitest baseline | 7,310 passed, 2 skipped, 26 known unrelated failures across 18 suites |
| Diff integrity | Passed (`git diff --check`) |

The full-suite failure inventory is unchanged from the preceding checkpoint in count and affected suites. It contains no failure in `use-chess-avatar`, `leagueCurrentMatchupAvatar`, `leagueContentReadability`, or the Commissioner/League workspace suites. The remaining source-contract and infrastructure expectations are concentrated in pre-existing browser metadata, legacy Club layout, loader, service-worker, tournament-format-card, accessibility-landmark, route-inventory, and tournament Wizard suites.
