# League Rail Logo Transition — QA Record

**Date:** 2026-10-20  
**Scope:** Club League Dashboard and public League Demo desktop navigation rail.

## Delivered behavior

- The collapsed League rail restores the familiar `!!` thumbnail (`/brand/otb-animated-nav-thumbnail.webp`).
- Hovering or keyboard-focusing the rail expands it into the supplied retro cream-and-green `OTB!!` wordmark.
- The transition is a contained 200 ms opacity and transform crossfade; the compact thumbnail recedes as the wordmark enters from an 8 px offset.
- The expanded wordmark is a dedicated, tightly cropped 600 × 209 WebP asset (35 KB), prepared from the supplied logo without black presentation padding.
- The behavior is opt-in through `compactBrandLogo` and `expandedBrandLogo`; the shared Club dashboard default remains unchanged.
- Both visual layers are presented through one semantic return button. The inactive layer is hidden from assistive technology, the button retains its existing focus ring and active feedback, and reduced-motion users receive no transition.
- The mobile League header and bottom navigation are untouched.

## Browser QA

| Surface | Result |
| --- | --- |
| Live League `/league/NlGsu0f5XroLQNzk` | Collapsed rail shows the `!!` thumbnail. Expanded rail shows the full retro `OTB!!` wordmark, fully contained inside its 64 px-high brand slot. |
| League Demo `/league-demo` | Same compact-to-expanded identity behavior, verified with all Demo navigation labels and no main-content overlap. |
| Desktop | Captured live and demo surfaces at 1440 × 1000. The hover state reflows into the already reserved 264 px rail column. |
| Mobile | Captured live and demo surfaces at 390 × 844. The desktop-only rail is absent and existing mobile header/navigation remains intact. |
| Accessibility | Browser geometry inspection confirmed both live and demo wordmarks remain inside the 168 px-wide button / 64 px-high header slot. Keyboard expansion remains supported by the shared rail focus handlers. |

## Automated validation

| Check | Result |
| --- | --- |
| Focused rail and League suites | **43 passed** across 5 files: shared sidebar behavior, compact rail contracts, League reconciliation, responsive layout, and header action contracts. |
| TypeScript | `pnpm exec tsc --noEmit --pretty false` passed. |
| Changed-file ESLint | **0 errors**; one pre-existing `LeagueDashboard.tsx` hook-dependency warning. |
| Production build | `pnpm run build` passed. |
| Project lint | **0 errors, 224 established warnings**. |
| Diff integrity | `git diff --check` passed. |
| Full Vitest baseline | **7,299 passed, 2 skipped, 25 existing unrelated failures** in 17 other suites. The changed shared-rail and League suites pass in the full run. |

## Notes

The supplied wordmark originally included large transparent presentation space above and below the artwork. The rail-specific derivative retains the full logo and its green shadow while preventing visual clipping at navigation scale.
