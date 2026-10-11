# Landing Hero Line-Shadow Text QA

**Scope:** Replace the animated in-text chess video within the landing hero’s “Over the Board.” headline with the supplied Line Shadow Text direction, adapted to ChessOTB’s typography, forest palette, responsive hierarchy, and accessibility requirements.

## Implementation

- Replaced `VideoText` in the hero headline with a reusable semantic `LineShadowText` component at `client/src/components/ui/line-shadow-text.tsx`.
- Kept the headline readable as normal DOM text; the duplicate `::after` layer is decorative and driven by `data-shadow`.
- Added a slow 12-second diagonal line scan to the shadow layer with a foreground/shadow z-index separation for visible depth.
- Added theme-specific forest/pale-green tokens for dark mode and high-contrast forest/soft-green tokens for light mode.
- Added a `prefers-reduced-motion` override that freezes the line texture in a stable state.
- Removed the retired `video-text.tsx` component and renamed the local media constant to `LANDING_CHESS_VIDEO_SOURCE`; the previously approved stats divider retains the local chess video background.

## Validation

| Check | Result |
| --- | --- |
| Focused source contracts | Passed: 13 tests across line-shadow hero, Home visual, and stats-divider suites |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with no warnings or errors |
| Project lint | Passed with 0 errors and 233 established warnings |
| Production build | Passed: `pnpm run build` |
| Route and retained video asset | Passed: `/` and `/videos/chess-hero-text-loop.mp4` returned HTTP 200 |
| Desktop visual QA | Passed: 1440px dark hero retains a readable two-line title with a clearly offset, textured line shadow |
| Mobile visual QA | Passed: 390px hero wraps cleanly, preserves CTA access, and has no visible horizontal overflow |
| Appearance QA | Passed: browser review confirmed contrast and visual treatment in both dark and light modes |
| Runtime inspection | Passed: animated pseudo-layer, repeated-line background, distinct foreground layer, and no horizontal overflow confirmed |
| Full Vitest baseline | 7,263 passed / 2 skipped / 26 known unrelated legacy failures across 17 suites |

## Known Baseline Notes

The full-suite failures predate this update and do not include the landing hero line-shadow implementation. The existing aggregate image-loading threshold is also stale at 35 expected optimized images versus 34 current images.
