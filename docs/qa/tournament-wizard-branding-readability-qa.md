# Tournament Wizard Branding & Readability QA

## Scope

- Replaced the Tournament Wizard's text-only `OTB!!` treatment with the shared ChessOTB wordmark asset used by the landing header.
- Increased the visual hierarchy and readable type scale across the focused onboarding flow.
- Removed the redundant decorative hero icon containers so the setup content is less generic and visually noisy.

## Acceptance checks

| Area | Verification |
| --- | --- |
| Shared brand asset | Desktop hero and mobile header render `TOURNAMENT_WIZARD_LOGO_URL` as an `img` with `alt="OTB Chess"`. |
| Logo visibility | Desktop wordmark renders at 42px high; mobile wordmark renders at 28px high. |
| Desktop hierarchy | Hero title uses `text-5xl` / `xl:text-[3.65rem]`; supporting copy uses a 17px, relaxed line-height treatment. |
| Mobile hierarchy | Mobile step title uses `text-xl`; top-bar context uses 15px; helper copy uses `text-base` and relaxed leading. |
| Setup controls | Large text inputs, native selects, option cards, preview cards, status notices, and action buttons use 16px-or-larger body sizing where users read or act. |
| Decorative cleanup | `HeroPanel` no longer emits the unused per-step icon container; the setup screen preserves only meaningful functional icons. |
| Accessibility | The full-screen dialog retains its existing accessible dialog semantics, focus management, keyboard support, and appropriately labelled close controls. |

## Validation

- Focused Vitest: `14 passed` across `tournamentWizardVisualEdits` and `tournamentWizardSegmentedOnboarding`.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- Changed-file ESLint: `0 errors`; 9 established warnings in `TournamentWizard.tsx` only.
- Project lint: `0 errors`; 233 established warnings.
- Production build: passed.
- Browser QA: opened `/?action=create`, selected Quickstart, and verified the desktop (`1440×900`) and mobile (`390×844`) full-screen flows with no rendered alerts. The shared wordmark element resolved to `/manus-storage/chessotb-wordmark-320_e1731168.webp` at 75.1×42px on desktop.
- Route health: local and public `/?action=create` returned HTTP `200`.
- Diff integrity: `git diff --check` passed.
- Full Vitest baseline: `7,194 passed`, `2 skipped`, and `30 established failures` across `18` unrelated legacy suites. The focused Wizard presentation suites pass in that run.

## Known baseline note

`client/src/__tests__/tournamentWizardPaymentToggle.test.ts` is an unrelated existing source-contract failure for a deferred payment-method UI branch. It is not changed by this typography/branding update and is intentionally left out of the focused suite.
