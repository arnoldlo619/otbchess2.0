# Create League Wizard Typography and Icon Cleanup — QA

**Date:** 2026-10-08  
**Scope:** `CreateLeagueWizard` visual hierarchy, layout, and decorative-icon cleanup.

## Delivered

- Enlarged the modal from `max-w-2xl` to `max-w-3xl` for a clearer desktop working surface while retaining an inset mobile layout.
- Established a stronger type hierarchy:
  - screen titles: 30–32px;
  - wizard context title: 18px;
  - body copy and values: 16px;
  - primary actions: 16px.
- Removed decorative Sparkles, Trophy, crown, shield, and rotation imagery from the flow.
- Retained only functional Lucide controls for selection confirmation, navigation, close, loading, and the no-club state.
- Added restrained hover elevation to choice controls and preserved the existing focus, keyboard, Escape, and submission behavior.

## Validation

| Check | Result |
|---|---|
| Focused wizard/lifecycle tests | 64 passed across 3 files |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | Passed with zero warnings/errors |
| Project ESLint | Passed with 0 errors and 233 established warnings |
| Production build | Passed |
| Local route health | `/league/new` returned HTTP 200 |
| Public preview route health | `/league/new` returned HTTP 200 |
| Visual QA | Reviewed desktop 1440px and mobile 390px screenshots; modal is contained, centered, and has readable hierarchy at both sizes |

## Regression Note

A separate accessibility source-contract test remains pre-existingly failing because `TournamentWizard.tsx` currently has two `useAccessibleOverlay` calls while that test expects three. The Create League wizard's own overlay invariant passes and this change does not touch `TournamentWizard.tsx`.

## Full-suite baseline

`pnpm vitest run` completed with **7,186 passed**, **2 skipped**, and **29 known unrelated failures across 17 suites**. The focused Create League wizard presentation, creation, and League lifecycle tests pass; no full-suite failure references `CreateLeagueWizard`.
