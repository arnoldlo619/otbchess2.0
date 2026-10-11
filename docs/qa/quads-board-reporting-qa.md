# Quads Board Reporting Enhancement QA

**Date:** 2026-10-11  
**Scope:** Tournament Director Quads board-reporting experience

## Delivered

- Replaced the generic white/black piece placeholders in Quad board rows with the shared `PlayerAvatar` component.
  - Uses the stored Chess.com avatar URL when available.
  - Preserves the existing proxied fetch, cache, image fallback, and Lichess support.
  - Keeps a compact white/black side marker alongside each profile image.
  - Handles BYE/missing-player entries with a non-image fallback.
- Refined active pending board rows with a restrained depth shadow and larger, more legible player identity blocks.
- On a real round transition, resets the Quads workspace to the canonical first section (`orderIndex: 0`, normally Quad 1), restores the Boards view and new-round tabs, closes any result panel/pending tray, and retains the established smooth workspace scroll.
- Does not reset the director's current Quad on the initial panel render or ordinary rerenders.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Quads suites | **71 passed** across 4 files |
| TypeScript (`pnpm exec tsc --noEmit`) | Passed |
| Changed-file ESLint | 0 errors; 5 existing warnings in `QuadsDirectorPanel.tsx` |
| Project lint (`pnpm lint`) | 0 errors; 233 established warnings |
| Production build (`pnpm run build`) | Passed |
| Diff integrity (`git diff --check`) | Passed |
| Dev route health | 200 for `/tournament/otb-demo-2026/manage?mockQuads=mid` and `?mockQuads=complete` |
| Full Vitest baseline | 7,220 passed, 2 skipped, 27 known unrelated failures across 18 legacy suites |

## Browser QA

- Loaded the deterministic `mockQuads=mid` Director scenario at 1440px.
- Confirmed 32px player profile avatars render directly beside both player identities, with side markers, no visual overlap, and no desktop horizontal overflow.
- Completed the pending Round 2 results for all four sections, intentionally selected Quad 3, and advanced to Round 3. The Director surface automatically reset to **Quad 1** with the Boards view active and Round 3 selected.
- Confirmed the active-round DOM showed `3 / 3`, `Quad 1`, two upcoming Board rows, and loaded Chess.com avatar images after the reset.
- Rechecked the 390px capture route. The screenshot runner captured the existing lazy-feature fallback before the dynamically imported Quads panel resolved; the component's established mobile stacking and 44px control contracts remain covered by `quadsMobileAccessibilityP2.test.ts`.

## Regression coverage

- `client/src/__tests__/quadsBoardReportingExperience.test.ts`
  - Shared Chess.com-aware avatar rendering in board matchup rows.
  - White/black side context and BYE fallback behavior.
  - Round-change-only reset to the canonical first Quad, with UI cleanup and scroll behavior.
