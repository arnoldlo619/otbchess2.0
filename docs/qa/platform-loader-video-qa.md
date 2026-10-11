# Official ChessOTB Loader Video QA

## Scope

Replaced the shared `OTBLoader` mark with the supplied official ChessOTB Club loader animation. The application shell and the existing route, full-page, and async states that use this shared component now adopt the official motion without changing their individual layouts.

## Implementation

- Local video: `client/public/videos/chessotb-club-loader.mp4`
  - H.264, 700 × 700, 50 fps, 4.38 seconds, 183,425 bytes.
- Local poster: `client/public/videos/chessotb-club-loader-poster.webp`
  - Used before the first decoded frame and as the no-motion still.
- Shared component: `client/src/components/OTBLoader.tsx`
  - Muted, inline, looping video for normal motion preferences.
  - Uses the poster and disables autoplay/looping when `prefers-reduced-motion: reduce` is active.
  - Retains the former seven-square loader as a runtime fallback if the video cannot load.
  - Keeps existing `role="status"`, concise labels, and dark/light presentation behavior.

## Validation

| Check | Result |
| --- | --- |
| Focused loader and route-loader tests | Pass — 4 tests across 2 suites |
| TypeScript (`pnpm exec tsc --noEmit`) | Pass |
| Changed-file ESLint | Pass — 0 errors |
| Project lint (`pnpm lint`) | Pass — 0 errors, 233 established warnings |
| Production build (`pnpm run build`) | Pass |
| Local video and poster endpoints | Pass — both HTTP 200 |
| Production asset copy | Pass — both assets present in `dist/public/videos` |
| Video decode | Pass — decoded midpoint frame successfully |
| Browser runtime QA | Pass — `readyState=4`, 700 × 700 intrinsic video, silent playback, 132 × 132 rendered loader, no horizontal overflow |
| Appearance QA | Pass — readable label and quiet shadow treatment on light and dark loader surfaces; loop remained active after one 4.38-second duration |
| Reduced-motion contract | Pass — source regression confirms media-query behavior; video pauses and returns to the poster still |

## Full Regression Baseline

`pnpm vitest run` completed with **7,263 passing / 2 skipped / 26 known unrelated failures across 17 existing suites**. The focused `otb-loader-contract` and `routeLoaderSemantics` suites pass; no failure was attributed to this change.

## Notes

The official animation replaces the shared loading mark only. Existing task-specific progress indicators, skeletons, and button-level spinners remain unchanged because they communicate granular work rather than page or application loading.
