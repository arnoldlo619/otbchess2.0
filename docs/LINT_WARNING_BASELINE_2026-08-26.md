# Lint Warning Baseline — 2026-08-26

## Completed High-Signal Cleanup

The first active GitHub Actions run surfaced a small, high-signal warning cluster in user-facing navigation and the authentication modal. This checkpoint removes dead navigation state and icon imports, replaces the Auth modal’s non-interactive backdrop listeners with an accessible close control, and removes six stale unit-test symbols. The focused changed-file lint command now completes with zero warnings, and TypeScript, 131 related unit tests, and desktop/mobile Auth coverage pass.

The Chess.com provider has also removed its three `no-explicit-any` boundaries. Archive, monthly-game, player, and fixture data now enter through `unknown` and are normalized with narrow record, string, and finite-number guards. Two dedicated malformed/valid payload tests and 38 existing fixture tests preserve the provider contract.

The landing Home page has removed verified unreachable imports, lightbox state, and three local sections that were not mounted by the active composition. Its remaining How It Works casts now use a narrow `LandingStep` model, so its focused lint baseline is **zero warnings and zero errors**; mobile landing visual QA and landing source contracts passed.

Broadcast Control has removed 26 focused warnings by deleting confirmed dead imports/state and using established chess-square types. Its SSE events now pass through a pure guarded parser that rejects malformed payloads and unsupported lifecycle values before state updates; focused lint is **zero warnings and zero errors**, with two parser regression tests.

The OTB game service has removed its remaining untyped error, request, database-record, and update-data boundaries. Authenticated routes now use typed request bodies plus an explicit user guard, all caught failures are `unknown`, and database selections/updates use inferred schema types. Focused lint is **zero warnings and zero errors**, with two source contracts preserving these boundaries.

The SMTP results-email route now converts caught failures through one `unknown`-safe message extractor, so client error responses and per-recipient failures never read arbitrary error payloads. Its remaining eight advisory warnings are limited to the route’s legacy Express `req`/`res` annotations and are tracked separately from this completed error-safety boundary.

The OTB rating engine now relies on Drizzle’s inferred game-submission row type when selecting the host’s canonical result, removing its isolated explicit-`any` boundary without changing rating behavior. Focused lint is **zero warnings and zero errors**, with a source contract protecting the inferred selection path.

The preparation fixture suite now removes an unused quarantine counter binding while preserving its repeated-move exclusion assertion. Focused lint is **zero warnings and zero errors**, and all 38 preparation fixture tests pass.

The preparation insight engine no longer imports its unused opening-family helper. Focused lint is **zero warnings and zero errors**, and all 38 preparation fixture tests continue to pass without changing generated analysis behavior.

The private preparation-analysis pattern detector now accepts only the analyzed game results it actually uses. Focused lint is **zero warnings and zero errors**, and all 38 preparation fixture tests continue to pass.

The push subscription rate limiter now types its key-generator request as Express `Request`, preserving the established privacy-safe IP normalization while removing its isolated explicit-`any` annotation. Focused lint is **zero warnings and zero errors**, and TypeScript passes.

The Google OAuth callback unit suite no longer imports unused Vitest mocking hooks. Focused lint is **zero warnings and zero errors**, and all eight account-creation, matching, and account-linking regressions pass.

Club-battle creation and bulk-import routes now treat database failures as `unknown` and identify duplicate entries through a guarded helper. The established idempotent-import response behavior remains intact; focused lint is **zero warnings and zero errors**, with a source contract for the guarded boundary.

Club invitation creation and acceptance now read the `userId` established by the shared authentication middleware rather than an unrelated legacy request-user shape. This restores the intended authenticated action contract; focused lint is **zero warnings and zero errors**, with a regression contract covering both invitation paths.

The quads lifecycle regression suite now removes stale fixture bindings while retaining all 17 section-isolation, tiebreak, lifecycle, and roster-mutation assertions. Focused lint is **zero warnings and zero errors**, and the full quads regression suite passes.

The Chess provider proxy now uses Express request/response types for its CORS and rate-limit boundaries, preserving the established allowed-origin policy and privacy-safe IP normalization. Focused lint is **zero warnings and zero errors**, with a source contract for those boundaries.

The broadcast service now removes stale payload fields and narrows its optional creator attribution shape to Express request compatibility. Live move validation and bridge delivery payloads are unchanged; focused lint is **zero warnings and zero errors**, with a source contract for the boundary.

The quads prize-template helpers now explicitly mark their unused dispatcher context parameter while retaining the stable two-argument template-call contract. Focused lint is **zero warnings and zero errors**, and all 17 quads lifecycle regressions pass.

Bracket child-tournament creation no longer reads and parses an unused parent state record. It retains the required parent visibility inheritance; focused lint preserves seven pre-existing typed-boundary warnings with zero errors, and a source contract covers the retained visibility path.

League discovery no longer imports an unused preparation cache symbol or executes an unused bulk club query. It retains explicit iteration over authorized club identifiers; focused lint preserves seven pre-existing typed-boundary warnings with zero errors, and a source contract covers the retained discovery path.

League commissioner and player push-notification paths now narrow provider failures from `unknown` before stale-subscription cleanup or warning logs. Both preserve 404/410 subscription removal; focused lint preserves five pre-existing typed-boundary warnings with zero errors, and a regression contract covers the guarded notification boundary.

The league authorization helper now narrows the `userId` set by shared authentication middleware without an explicit-`any` request cast. Unauthorized responses are unchanged; focused lint preserves four pre-existing typed-boundary warnings with zero errors, and a source contract covers the helper.

League season-start rating fetches now use a narrow Chess.com response shape while retaining the established rapid, blitz, bullet, then daily rating precedence. Focused lint preserves three pre-existing typed-boundary warnings with zero errors, and a source contract covers the response boundary.

League week finalization now derives its database parameter and match rows from the shared database factory rather than explicit `any` annotations. Completion and week-advance behavior are unchanged; focused lint has one remaining legacy typed-boundary warning with zero errors, and a source contract covers the function.

League settings updates now use the schema-derived insert shape rather than an explicit-`any` database cast. The existing commissioner authorization and field validation rules remain intact; focused lint is **zero warnings and zero errors**, with a source contract for the typed update boundary.

Repertoire Builder protected CRUD routes now use a local Express-compatible authenticated request wrapper instead of explicit-`any` request annotations. The existing full-auth middleware, ownership filters, and free-user repertoire limit remain intact; focused lint is **zero warnings and zero errors**, with focused contracts for the protected boundary.

Bracket mutation routes now use a local Express-compatible authenticated request wrapper and a schema-derived update payload instead of explicit-`any` boundaries. Existing ownership checks, child tournament unlinking, player reassignment, and bracket spawn behavior remain intact; focused lint is **zero warnings and zero errors**, with focused contracts for the authenticated mutations.

Saved preparation report CRUD routes now read the `userId` established by shared authentication middleware instead of a stale request-user shape. This restores the intended authenticated save, list, read, and delete contract; focused lint preserves three unrelated typed-boundary warnings with zero errors, and a source contract covers every saved-report route.

Preparation routes now use a typed rate-limit request key, the inferred saved-report insert ID, and the existing authenticated request wrapper for coach insight. Input validation, rate limits, and LLM response handling remain intact; focused lint is **zero warnings and zero errors**, with expanded route contracts covering the typed boundaries.

SMTP configuration, test, and results-delivery routes now use a local full-auth-compatible request wrapper instead of legacy explicit request/response `any` annotations. User-scoped configuration access and unknown-safe delivery errors remain intact; focused lint is **zero warnings and zero errors**, with focused route and error-safety contracts.

Club event, feed, RSVP, payment-status, and check-in actions now use the shared authenticated user helper; event, feed, season, and announcement inputs use schema-derived request shapes. Existing authorization, club membership, manual payment-status privacy, and content-creation behavior remain intact; focused lint is **zero warnings and zero errors**, with focused route contracts.

The server entrypoint no longer retains an unused legacy Lichess proxy, duplicate legacy rate-limit declarations, or a stale game-session schema import. Mounted delegated routes retain their own active router-level controls; focused lint preserves fifteen remaining typed-boundary warnings with zero errors, and a source contract protects the cleanup.

Tournament analytics ownership checks now narrow the `userId` established by shared authentication middleware instead of relying on an explicit request `any` cast. Unauthorized requests retain a clear 401 response; focused lint preserves fourteen remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the route.

Tournament attendance analytics now parses only the persisted player and round fields it consumes, removing explicit `any` collections without altering walk-in or no-show calculations. Focused lint preserves twelve remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the narrow state shape.

Repeat-event growth analytics now parses only player usernames from current and historical tournament state, removing an explicit callback `any` without altering returning-player calculations. Focused lint preserves eleven remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the narrow state shape.

Public tournament visibility reads and updates now narrow the `userId` established by shared authentication middleware rather than using explicit request casts. Existing 401 and owner-only protections remain intact; focused lint preserves nine remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the ownership routes.

Owner-only tournament deletion now narrows the `userId` established by shared authentication middleware instead of annotating the route request as `any`. Existing missing-auth, missing-tournament, and ownership protections remain intact; focused lint preserves eight remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the deletion route.

Broadcast settings now use the `userId` established by shared authentication middleware and a schema-derived upsert payload rather than stale request-user access and an explicit insert cast. Existing ownership checks and public snapshot invalidation remain intact; focused lint preserves six remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the route.

Public snapshot construction now consumes schema-typed player and round arrays through the exported snapshot input contract rather than explicit array casts. Existing snapshot generation and ETag behavior remain intact; focused lint preserves four remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the typed input boundary.

Protected achievement batch creation now derives its input from the player-achievement schema rather than explicit request and callback `any` annotations. Existing batch validation and achievement persistence remain intact; focused lint preserves two remaining typed-boundary warnings with zero errors, and the entrypoint contract covers the input boundary.

Protected tournament recap persistence now derives its input from the recap schema and verifies the authenticated caller owns the referenced tournament before update or creation. Existing draft/published recap behavior remains intact; focused lint preserves one remaining typed-boundary warning with zero errors, and the entrypoint contract covers the ownership gate.

Tournament analytics metadata is now parsed as `unknown` and narrowed to string fields before aggregation, removing the final entrypoint explicit-`any` boundary without changing analytics metrics. Focused lint for `server/index.ts` is **zero warnings and zero errors**, with an expanded 11-contract regression suite.

The Matchup Prep walkthrough no longer carries unused visual constants or animation deltas, and its retained transition state is marked intentionally unread. Focused lint is reduced from five warnings to one warning, isolated to a dormant `AnimatedBoard` implementation that requires a dedicated product decision before removal.

The Quads director panel no longer computes unused summary, attention, or completion-card round data. Focused lint is reduced from nine warnings to five warnings, isolated to dormant icon/progress UI and callback shapes that require a dedicated UI decision before removal.

The registration modal no longer retains unused player aliases, time-control state, or an unused player-card side binding. Focused lint is reduced from seven warnings to three warnings, isolated to error-boundary and avatar-fallback accessibility work for a dedicated pass.

Registration modal session creation now guards caught failures as `unknown` and retains a clear fallback message for QR and direct head-to-head flows. Focused lint is reduced to one warning, isolated to the existing avatar fallback accessibility boundary.

The registration modal avatar fallback is now React-managed rather than mutating DOM markup directly, preserving initials when an avatar fails. One explicit image-error accessibility warning remains for later component-level refactoring; it is not suppressed.

The V3 Matchup Prep scout report no longer imports unused icons or its obsolete AI summary module. Focused lint is **zero warnings and zero errors**, with no change to report content or interaction behavior.

Final Standings no longer carries unused game typing, medal presentation data, or an inactive elimination label helper. Focused lint is **zero warnings and zero errors**, with placement calculations unchanged.

The Chessnut board panel no longer imports unused calibration or piece-map symbols, and its inactive appearance prop is explicitly marked unused. Focused lint is **zero warnings and zero errors**, with connection and live-board behavior unchanged.

The Chrome Bluetooth panel no longer carries unused download/zap icons, and its inactive board and diagnostics appearance props are explicitly marked unused. Focused lint is **zero warnings and zero errors**, with device connection and diagnostics behavior unchanged.

## Remaining Baseline

The repository-wide `pnpm lint` command now reports **496 warnings and zero errors**, reduced from 509 warnings before this cleanup. The remaining warnings are predominantly legacy `@typescript-eslint/no-explicit-any` findings across server integrations and historical test fixtures, plus a smaller number of unused variables and stale lint-disable directives.

> This is a typed-maintainability backlog, not an active release failure: the green remote CI run treats lint errors as blocking and warnings as advisory. The next remediation pass should group warnings by domain and replace `any` with validated narrow types rather than suppressing the rule globally.

## Guardrails

The active CI workflow remains responsible for TypeScript, ESLint, deterministic unit/integration tests, production build, and bundle-budget enforcement. No lint severity was relaxed, no rules were disabled, and the public UI behavior was preserved.
