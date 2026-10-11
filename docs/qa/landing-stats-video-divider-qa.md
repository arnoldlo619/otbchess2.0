# Landing Statistics Video Divider QA

**Scope:** Replace the static Club/Platform statistics divider treatment with the approved local chess loop from the landing hero, retaining a readable foreground in either appearance mode.

## Implementation

- Resolved the stale visual-edit target manually: the referenced section is the `StatsBar` at `Home.tsx` line 578.
- Reused the local `/videos/chess-hero-text-loop.mp4` asset rather than adding a second media source.
- Added `StatsVideoBackground`, which:
  - is muted, looping, inline, decorative, and excluded from the accessibility tree;
  - waits for viewport intersection before playing and pauses outside the viewport;
  - pauses when `prefers-reduced-motion` is active;
  - preserves the existing solid forest background as a fallback when playback is unavailable or blocked.
- Added an opaque forest-green gradient scrim between the video and statistic content, with content retained at `z-index: 10`.
- Preserved the chess-board texture above the video as a low-opacity branded layer.

## Validation

| Check | Result |
| --- | --- |
| Focused source contracts | Passed: 13 tests across stats-divider, hero-video, and Home visual suites |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with no warnings or errors |
| Project lint | Passed with 0 errors and 233 established warnings |
| Production build | Passed: `pnpm run build` |
| Route and video asset health | Passed: `/` and `/videos/chess-hero-text-loop.mp4` returned HTTP 200 |
| Desktop visual QA | Passed: 1440px full-page render preserves readable centered metrics over a subdued video background |
| Mobile visual QA | Passed: 390px full-page render preserves the stacked metrics and no visible horizontal clipping |
| Runtime browser QA | Passed in light mode: video readyState 4, playing at 0.77s, `object-fit: cover`, forest scrim present, content at z-index 10, no horizontal overflow |
| Appearance QA | Passed: visual review in light and dark modes confirmed consistent high-contrast metric text and restrained media treatment |
| Full Vitest baseline | 7,263 passed / 2 skipped / 26 known unrelated legacy failures across 17 suites |

## Known Baseline Notes

The full suite’s 26 failures predate this update and do not involve the landing statistics divider. The existing aggregate image-loading suite retains its stale 35-image threshold while the current project contains 34 optimized image tags.
