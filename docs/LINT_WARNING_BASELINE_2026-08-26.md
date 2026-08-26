# Lint Warning Baseline — 2026-08-26

## Completed High-Signal Cleanup

The first active GitHub Actions run surfaced a small, high-signal warning cluster in user-facing navigation and the authentication modal. This checkpoint removes dead navigation state and icon imports, replaces the Auth modal’s non-interactive backdrop listeners with an accessible close control, and removes six stale unit-test symbols. The focused changed-file lint command now completes with zero warnings, and TypeScript, 131 related unit tests, and desktop/mobile Auth coverage pass.

## Remaining Baseline

The repository-wide `pnpm lint` command now reports **496 warnings and zero errors**, reduced from 509 warnings before this cleanup. The remaining warnings are predominantly legacy `@typescript-eslint/no-explicit-any` findings across server integrations and historical test fixtures, plus a smaller number of unused variables and stale lint-disable directives.

> This is a typed-maintainability backlog, not an active release failure: the green remote CI run treats lint errors as blocking and warnings as advisory. The next remediation pass should group warnings by domain and replace `any` with validated narrow types rather than suppressing the rule globally.

## Guardrails

The active CI workflow remains responsible for TypeScript, ESLint, deterministic unit/integration tests, production build, and bundle-budget enforcement. No lint severity was relaxed, no rules were disabled, and the public UI behavior was preserved.
