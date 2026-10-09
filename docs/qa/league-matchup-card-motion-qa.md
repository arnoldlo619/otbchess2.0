# League Matchup Card Motion QA

**Scope:** Enlarged matchup heroes in the standard Club League dashboard and `/league-demo`.

## Change

- Added a shared `league-matchup-card` interaction class to the standard live Current Matchup hero, the demo overview Featured Matchup, and the demo Matchup-tab hero.
- Unified the treatment around a 220ms transform/shadow transition with a restrained `translateY(-2px) scale(1.012)` hover response and an accent-compatible, low-opacity shadow.
- Limited hover transforms to fine-pointer devices via `@media (hover: hover) and (pointer: fine)`; touch-first layouts stay stable with no hover animation.
- Added press feedback (`scale(1.006)`) for pointer interaction without making the card itself a new click target.
- Added `:focus-within` feedback for existing keyboard-accessible descendants, including demo player profile controls and matchup actions.
- Added `prefers-reduced-motion: reduce` overrides that remove card transitions and transforms.
- Left compact sidebar matchup rows and nested player-tile interactions unchanged to avoid over-animation and preserve existing semantics.

## Regression coverage

`client/src/__tests__/leagueMatchupCardMotion.test.ts`

- Confirms shared class placement on the live Current Matchup, demo Featured Matchup, and demo Matchup-tab hero.
- Guards the 220ms, fine-pointer-only scale/lift contract.
- Guards visible focus-within feedback.
- Guards the reduced-motion transition and transform overrides.

## Validation

| Check | Result |
| --- | --- |
| Focused League suites | **18 passed** across matchup motion, avatar source priority, responsive containment, header actions, and readability |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 5 existing `LeagueDashboard.tsx` warnings |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | `/league-demo`, active League, and draft League routes returned HTTP 200 |
| Desktop visual QA | Demo overview and Matchup-tab cards remained unclipped and visually subtle at 1440px; real active/draft League routes remained stable |
| Mobile visual QA | 390px demo, active, and draft League captures had no horizontal overflow; fine-pointer gating keeps hover transform off touch-first layouts |
| Browser interaction QA | Demo card reported `matrix(1.012, 0, 0, 1.012, 0, -2)` plus the intended soft shadow on hover; focus-within reported a visible 2px outline with 3px offset; no horizontal overflow |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,201 passed, 2 skipped, and 31 known unrelated failures across 19 existing suites**. The new motion suite and adjacent League suites passed. The unchanged failure count confirms this refinement introduced no new full-suite regression.

## Notes

Motion is intentionally applied only to the enlarged matchup surfaces. It uses compositor-friendly `transform` and `box-shadow`, retains existing player/profile and Report Result behavior, and makes no changes to League header geometry, avatar-source priority, or readability scaling.
