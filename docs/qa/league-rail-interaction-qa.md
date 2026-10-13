# League rail interaction QA

**Scope:** Smooth hover states and descriptive tooltips for the shared expandable Club-style rail used by the live Club League dashboard and public League demo.

## Delivered behavior

- Added a restrained 200ms hover response to rail actions: a small icon lift/scale, more legible accent tint, border, and shadow. The active destination remains visually stronger than hover.
- Added a delayed tooltip treatment for every brand, primary, settings, and footer rail action. Tooltips present the action label plus a short, route-specific purpose.
- Added League-specific descriptions for Overview, Commissioner, Matchups, Standings, Schedule, Summary/History, Requests, Settings, and return actions in both the live dashboard and demo.
- Preserved existing navigation destinations, compact-to-expanded rail behavior, and mobile navigation.

## Accessibility and motion

- Buttons retain their concise accessible names; tooltip content supplements rather than replaces control labels.
- Tooltip content is available on keyboard focus and pointer hover.
- Existing `focus-visible` rings, logical tab order, touch-safe controls, and `prefers-reduced-motion` transition safeguards remain in place.
- Hover state is guarded from touch pointers.

## Visual and runtime QA

- Browser review: `/league-demo` at desktop width.
  - Rail expands smoothly without overlapping League content.
  - Hover state confirmed: Commissioner icon computes to `translateY(-1px) scale(1.04)`.
  - Keyboard focus on Commissioner exposes the tooltip: “Report results and advance the demo week.”
  - Tooltip remains on the opaque right-side rail surface and does not use emojis.

## Automated validation

| Check | Result |
| --- | --- |
| Focused sidebar + League suites | 37 passing tests across 6 files |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | 0 errors; 1 established `LeagueDashboard` hook-dependency warning |
| Production build | Passed (`pnpm run build`) |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | 7,281 passed, 2 skipped; 27 established unrelated failures across 19 suites |

The full-suite failures do not include the shared sidebar tests, compact-rail tests, or affected League interaction suites.
