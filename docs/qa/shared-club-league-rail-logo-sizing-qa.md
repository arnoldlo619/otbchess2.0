# Shared Club and League Rail Logo Sizing — QA Record

**Date:** 2026-10-21  
**Scope:** Shared desktop navigation rail used by Club Dashboard, Club Demo, League Dashboard, and League Demo.

## Delivered behavior

- Reduced the expanded retro cream-and-green `OTB!!` wordmark from **168px** to the approved **120px** width.
- The resulting rendered wordmark is approximately **120 × 42px**, providing a lighter brand signature inside the existing 64px rail-header slot.
- Compact desktop rails use the familiar `!!` thumbnail: `/brand/otb-animated-nav-thumbnail.webp`.
- Expanded desktop rails crossfade to `/brand/otb-retro-cream-green-rail-wordmark.webp` with the existing 200ms, transform-and-opacity-only transition.
- Live Club Dashboard and Club Demo now explicitly use the same compact and expanded brand assets as the live League Dashboard and League Demo.
- Existing return destinations remain intact: Club surfaces return to all clubs, the live League returns to the club, and the League Demo returns home.
- Keyboard expansion, visible focus states, and reduced-motion support remain unchanged. Mobile navigation is unchanged.

## Visual and runtime QA

| Surface | Result |
| --- | --- |
| Club Demo `/clubs/demo` | Compact rail shows `!!`; expanded rail shows the smaller retro wordmark without crowding the navigation. |
| League Demo `/league-demo` | Matches Club Demo exactly: same two assets, same 120px expanded button, same visual scale. |
| Geometry | Browser inspection confirmed both expanded rails render a **120px**-wide wordmark at **41.8px** tall, fully contained within the brand button. |
| Desktop | Verified compact and expanded states at 1440 × 1000. |
| Mobile | Verified both surfaces at 390 × 844; the desktop-only rail change does not alter existing mobile headers or navigation. |

## Automated validation

| Check | Result |
| --- | --- |
| Focused Club/League rail suites | **47 passed** across 5 files, including runtime shared-sidebar behavior, source contracts, Club Demo, and League layout coverage. |
| TypeScript | `pnpm exec tsc --noEmit --pretty false` passed. |
| Changed-file ESLint | **0 errors**; 67 established warnings across the selected legacy dashboard files. |
| Production build | `pnpm run build` passed. |
| Project lint | **0 errors, 224 established warnings**. |
| Route health | `/clubs/demo`, `/league-demo`, and `/league/NlGsu0f5XroLQNzk` all returned HTTP 200. |
| Diff integrity | `git diff --check` passed. |
| Full Vitest baseline | **7,299 passed, 2 skipped, 25 established unrelated failures** across 17 other suites. The changed Club/League shared-rail suites pass in the full run. |
