# Swiss–Elimination Cutoff Override QA

**Date:** 2026-10-06  
**Scope:** Post-auto-generation bracket cutoff override in the Director Bracket tab.

## Verified behavior

- `resetElimination(cutoffSize)` rebuilds the first elimination round from the completed Swiss standings while retaining the Swiss round history.
- Only power-of-two cutoff sizes up to the eligible roster size are selectable.
- An override is rejected at the state layer when a non-BYE elimination result already exists.
- The Director Bracket header exposes one **Change cutoff** control for Swiss + Elimination events.
- The modal communicates the selected cutoff, elimination round count, and players eliminated after Swiss.
- Once bracket play has begun, selector and apply controls are disabled and a clear lock explanation is shown.
- Dialog focus, Escape, close action, and responsive layout use the shared accessibility overlay behavior.

## Automated validation

- `pnpm vitest run tests/cutoff-override.test.tsx client/src/__tests__/publicBracketView.test.ts` — **41 passed**
- `pnpm exec tsc --noEmit` — **passed**
- Changed-file ESLint — **0 errors**; 7 established warnings in `directorState.ts` / `Director.tsx`.
- `git diff --check` — **passed**

## Visual QA

- Desktop (1440 × 900): modal is centered, restrained, and readable over the Director bracket context.
- Mobile (375 × 812): power-of-two selector remains touch-friendly and the action row fits without horizontal overflow.

## Baseline note

Full Vitest baseline: **7,116 passed, 2 skipped, 30 unrelated legacy failures across 16 suites**. The cutoff override regression suite passes. One known unrelated failure is `client/src/__tests__/accessibleOverlayInvariant.test.ts`, which expects three `useAccessibleOverlay` usages in `TournamentWizard.tsx` while the current source contains two. The cutoff modal’s own shared-overlay contract passes.
