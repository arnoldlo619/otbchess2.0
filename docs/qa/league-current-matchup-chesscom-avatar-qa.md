# League Current Matchup Chess.com Avatar QA

**Scope:** Current Matchup player portraits in the standard Club League dashboard.

## Change

- Current Matchup now consumes the same cache-backed `useChessAvatars` result as League standings, schedules, and profile views.
- Chess.com profile photos take priority over stored platform avatars, without a second per-matchup fetch path.
- While a Chess.com photo resolves, the hero reserves the exact avatar footprint with a shimmer placeholder rather than flashing initials or shifting the layout.
- If Chess.com has no profile photo, the existing stored avatar or initials fallback remains intentional and stable.

## Validation

| Check | Result |
| --- | --- |
| Focused avatar and League tests | **13 passed** across 4 files |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 5 established `LeagueDashboard` warnings |
| Production build | passed |
| Live proxy smoke check | `arnoldadri` and `magnuscarlsen` returned profile images; `hansontwitch` correctly returned no image and retains the initials fallback |
| Diff integrity | `git diff --check` passed |
| Full Vitest baseline | 7,154 passed, 2 skipped, and 27 unrelated existing failures across 18 suites |

## Behavior contract

1. Resolve the player Chess.com username against the shared League avatar cache.
2. Render the Chess.com image when available.
3. Maintain a fixed-size loading skeleton while resolving.
4. Fall back to the persisted avatar, then initials, only if no Chess.com image exists.
