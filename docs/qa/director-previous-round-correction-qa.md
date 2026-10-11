# Tournament Director Previous-Round Correction QA

**Scope:** Tournament Directors may correct **only the immediately preceding round**. The correction is deliberately unavailable once later results create an unsafe pairing dependency.

## Delivered behavior

- Adds a contextual **Correct Round N** action beneath the Director tournament title once Round 2 or later is active.
- Shows **Previous round locked** with an explanation when correction is not safe.
- Provides an accessible confirmation modal with each prior-round board and explicit result choices.
- Standard formats (`swiss`, `doubleswiss`, `roundrobin`, `elimination`, and `swiss_elim`) recalculate standings and regenerate a completely unreported active round from the corrected standings.
- Quads preserve the active section board assignments, including already reported boards, and recalculate section standings from the corrected result.
- Adds a result-audit entry for every changed historical game with the prior result, revised result, director identity, and timestamp.
- Replaces the active state atomically, persists it through the revision-safe state endpoint, and republishes regenerated active boards without issuing a false round-start notification.
- The modal is keyboard-dismissible with Escape, traps focus through the existing accessible overlay contract, and renders above the fixed tournament navigation.

## Guardrails

| Situation | Result |
| --- | --- |
| Registration or Round 1 | No correction path is exposed. |
| Tournament complete | No correction path is exposed. |
| Previous round was not fully complete | Correction remains locked. |
| Standard active round has any recorded board | Previous round locks to prevent invalidating live results. |
| Clean standard active round | Corrected standings regenerate active pairings. |
| Quads active round | Correction remains available; active boards remain assigned and standings update. |
| Older than the immediately preceding round | Never exposed in the UI or state API. |

## Automated validation

| Check | Result |
| --- | --- |
| Focused Director / Quads / correction regressions | **78 passed** across 6 suites |
| New state correction tests | **9 passed**: Swiss, Double Swiss, Round Robin, Elimination, Swiss-Elimination, Quads, locking and lifecycle guards |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 7 established warnings in `Director.tsx` / `directorState.ts` |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | 200: `/tournament/otb-demo-2026/manage`, `/tournament/otb-demo-2026`, `/director-access` |
| Diff integrity | `git diff --check` passed |
| Full Vitest baseline | 7,234 passed / 2 skipped / 27 established unrelated failures across 18 legacy suites |

## Browser QA

1. Seeded a clean Round-2 Swiss state; **Correct Round 1** opened the confirmation surface.
2. Changed a Round-1 result and applied it; the active Round-2 boards were regenerated from the revised standing order and the Director returned to the Home workspace with confirmation feedback.
3. Recorded an active Swiss board; the action immediately changed to **Previous round locked**.
4. Seeded an in-progress Quads state with an already reported active board; the modal explicitly stated that Quad boards stay assigned.
5. Applied a Quad Round-1 correction; current Round-2 boards stayed intact, standings and avatar standing labels recalculated, and the result activity log recorded the correction.
6. Verified Escape dismisses the modal and the modal stack index is above the fixed tournament header.
7. Captured a 390px responsive Director regression screenshot; no horizontal overflow observed in the base Director workspace.

## Known unrelated baseline issue

The full Vitest run includes pre-existing failures outside this change set. The retained log identifies the stale `tournamentWizardPaymentToggle.test.ts` source-contract expectation among them; none target the previous-round correction files or focused Director/Quads suites.
