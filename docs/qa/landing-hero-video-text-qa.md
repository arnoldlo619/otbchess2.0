# Landing Hero Video Text QA

**Scope:** Replace the landing-page `Over the Board.` hover-pattern treatment with a branded, chess-video-filled display treatment.

## Delivered behavior

- `Over the Board.` remains real H1 text for selection, search, and assistive technology.
- A local, silent 960×540 H.264 board-motion loop is composited into the display letters only after its first frame decodes.
- The readable branded text remains below the moving texture, preventing low-contrast frames from weakening the hero hierarchy.
- The loop plays only while the hero is in view, pauses when off-screen, and stops motion when `prefers-reduced-motion: reduce` is enabled.
- A static, theme-aware text fallback remains visible if video loading, autoplay, canvas, or decode is unavailable.
- The generated source clip was converted to a 16.08-second forward-and-reverse loop with `faststart`, no audio, and a 263,796-byte delivery weight.

## Validation

| Check | Result |
| --- | --- |
| Focused landing regression suites | Passed: 13 tests across 4 files |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with 0 errors |
| Project lint | Passed with 0 errors and 233 established warnings |
| Production build | Passed; production copy includes the exact local video asset SHA-256 |
| Asset route | Passed: local `/videos/chess-hero-text-loop.mp4` returns HTTP 200 as `video/mp4` |
| Runtime browser inspection | Passed: local source, muted looping video, decoded 960×540 frames, ready canvas, and no horizontal overflow |
| Visual QA | Passed: 1440px desktop, 390px mobile, and browser-verified light/dark appearance all preserve visible text and unclipped layout |
| Full Vitest baseline | 7,260 passed / 2 skipped / 26 unrelated known failures in 17 legacy suites; no failures in changed landing hero files |
| Diff integrity | Passed: `git diff --check` |

## Known implementation boundary

Canvas-masked video relies on browser video decoding and canvas support. The semantic text fallback is intentionally retained so the hero title remains readable and meaningful when either capability is unavailable.
