# Lint Warning Baseline — 2026-08-26

## Completed High-Signal Cleanup

The first active GitHub Actions run surfaced a small, high-signal warning cluster in user-facing navigation and the authentication modal. This checkpoint removes dead navigation state and icon imports, replaces the Auth modal’s non-interactive backdrop listeners with an accessible close control, and removes six stale unit-test symbols. The focused changed-file lint command now completes with zero warnings, and TypeScript, 131 related unit tests, and desktop/mobile Auth coverage pass.

The Chess.com provider has also removed its three `no-explicit-any` boundaries. Archive, monthly-game, player, and fixture data now enter through `unknown` and are normalized with narrow record, string, and finite-number guards. Two dedicated malformed/valid payload tests and 38 existing fixture tests preserve the provider contract.

The landing Home page has removed verified unreachable imports, lightbox state, and three local sections that were not mounted by the active composition. Its remaining How It Works casts now use a narrow `LandingStep` model, so its focused lint baseline is **zero warnings and zero errors**; mobile landing visual QA and landing source contracts passed.

Broadcast Control has removed 26 focused warnings by deleting confirmed dead imports/state and using established chess-square types. Its SSE events now pass through a pure guarded parser that rejects malformed payloads and unsupported lifecycle values before state updates; focused lint is **zero warnings and zero errors**, with two parser regression tests.

## Remaining Baseline

The repository-wide `pnpm lint` command now reports **496 warnings and zero errors**, reduced from 509 warnings before this cleanup. The remaining warnings are predominantly legacy `@typescript-eslint/no-explicit-any` findings across server integrations and historical test fixtures, plus a smaller number of unused variables and stale lint-disable directives.

> This is a typed-maintainability backlog, not an active release failure: the green remote CI run treats lint errors as blocking and warnings as advisory. The next remediation pass should group warnings by domain and replace `any` with validated narrow types rather than suppressing the rule globally.

## Guardrails

The active CI workflow remains responsible for TypeScript, ESLint, deterministic unit/integration tests, production build, and bundle-budget enforcement. No lint severity was relaxed, no rules were disabled, and the public UI behavior was preserved.
