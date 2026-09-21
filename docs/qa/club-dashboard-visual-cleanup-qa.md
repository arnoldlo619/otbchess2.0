# Club Dashboard Visual Cleanup QA

## Scope

This cleanup refines the Club Dashboard owner overview and compact desktop sidebar without changing club data, permissions, navigation destinations, or Feed/Event behavior.

## Changes verified

- The legacy **Needs Attention** block has been removed completely rather than left as permanently disabled markup.
- Owner Quick Actions preserve their three real operational destinations: New Meetup, Tournament, and Post. Their icons now use a neutral monochrome treatment, while their labels use a more readable 14–15px scale and 56–64px action height.
- Compact sidebar controls now use a clearer non-active hover layer, accent-tinted icon feedback, and a restrained lift/scale. The active state retains the stronger 52% brand frame, and keyboard focus, press feedback, touch gating, and reduced-motion safeguards remain distinct.
- The compact sidebar brand trigger is now 64px and centered within its header slot, preserving its Back to all clubs label and behavior.

## Visual review

The public Club Dashboard route was inspected at desktop and 375px. The compact rail remains clean, the expanded hover rail retains its centered navigation stack, and the enlarged brand mark is clearer without adding a container border. The public route remains free of horizontal overflow on mobile.

The available preview identities are not club owners, so the owner-gated Overview Quick Actions could not be opened live. The change is protected by source-contract coverage, TypeScript validation, and the same existing overview owner gate; no owner permissions or routing were changed.

## Validation

| Check | Result |
|---|---|
| Focused dashboard tests | Passed: 24 tests across overview, compact-rail, and operations suites. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file ESLint | Passed with 0 errors. Existing `ClubDashboard.tsx` warnings remain. |
| Desktop review | Passed: compact and expanded sidebar states reviewed on the public Dashboard. |
| Mobile review | Passed: 375px public Dashboard capture remains contained and readable. |
| Diff integrity | Passed: `git diff --check`. |

## Full-project checks

- `pnpm lint` completed with **0 errors** and 235 established project warnings.
- `pnpm build` passed.
- The full Vitest suite produced **6,986 passing tests, 2 skipped, and 25 known unrelated source-contract failures** across the established accessibility-overlay, form-label, global-landmark, retired Tournament Wizard payment-toggle, and tournament-format-card suites. The focused Club Dashboard suites for this change pass.
