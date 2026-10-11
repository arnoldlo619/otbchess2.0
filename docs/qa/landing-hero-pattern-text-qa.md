# Landing Hero Pattern Text QA

**Scope:** Correct the landing hero’s “Over the Board.” animation so it follows the supplied Pattern Text reference instead of the previously introduced outline-and-glow interpretation.

## Implementation

- Added `client/src/components/ui/pattern-text.tsx` at the project’s existing UI component path.
- Replaced the retired `LineShadowText` hero usage with `PatternText` in `Home.tsx`.
- Implemented the supplied animation model: semantic duplicate text in `::after`, a 45° repeating pattern clipped to text, a compact 0.065em offset, and a 15-second background-position shift.
- Removed the custom outlined scan, foreground wrapper, blur, and heavy shadow that caused the prior mismatch.
- Adapted only the light/dark forest color tokens for ChessOTB and retained a static reduced-motion state.
- Preserved the existing hero typography scale, two-line desktop composition, semantic H1/H2 structure, CTA layout, and stats-divider video.

## Validation

| Check | Result |
| --- | --- |
| Focused hero contracts | Passed: 13 tests across pattern text, landing visual, and stats-divider suites |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with no warnings or errors |
| Project lint | Passed with 0 errors and 233 established warnings |
| Production build | Passed: `pnpm run build` |
| Route and local video asset | Passed: `/` and `/videos/chess-hero-text-loop.mp4` returned HTTP 200 |
| Desktop visual QA | Passed: 1440px dark and light views preserve hierarchy, visible patterned offset, and full CTA access |
| Mobile visual QA | Passed: 390px hero remains readable with no horizontal overflow and stacked touch targets |
| Runtime inspection | Passed: exact duplicate text, animated 8px texture, 5.2px responsive offset, and no horizontal overflow confirmed in both themes |
| Reduced motion | Passed: style contract freezes the decorative pattern at a stable background position |
| Full Vitest baseline | 7,263 passed / 2 skipped / 26 known unrelated legacy failures across 17 suites |

## Baseline Note

The full-suite failures are pre-existing and unrelated to the landing hero Pattern Text update. No focused hero, Home, or stats-divider test failed.

## Visibility Repair

### Root cause

The decorative duplicate text used a negative z-index inside an isolated stacking context. This allowed it to sit behind the hero surface rather than reliably behind the readable glyphs, while its 15-second texture shift was too slow to register as purposeful motion.

### Resolution

- Added an explicit foreground text layer at `z-index: 1`.
- Kept the patterned duplicate in the same isolated stack at `z-index: 0`, using a responsive 5–10px offset.
- Increased the pattern contrast and shortened the diagonal texture shift to a visible five-second loop.
- Preserved the semantic headline and static reduced-motion fallback.

### Repair validation

- Runtime layer order confirmed as foreground `1` / patterned duplicate `0`, with no horizontal overflow.
- Dark runtime geometry: 7.2px offset, 6.4px texture, and an active five-second animation.
- Desktop dark/light and mobile dark visual checks confirm the moving pattern is visible without affecting headline readability or CTA access.
