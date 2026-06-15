# RECOMMENDED_PR_SEQUENCE.md

## Guiding principle

Each PR should be small enough for a solo founder/AI-assisted workflow and should protect live tournament reliability. Avoid broad rewrites. Add tests before or with risky behavior changes.

## Phase 0 — Restore confidence in checks

### PR 1: Fix TypeScript check configuration

- **Goal:** Make `pnpm check` usable again.
- **Files:** `tsconfig.json`.
- **Change:** Add `ignoreDeprecations` or migrate away from deprecated `baseUrl` config.
- **Tests:** `pnpm check`.
- **Risk:** Low.

### PR 2: Add tournament lifecycle and duplicate-registration tests

- **Goal:** Lock down current behavior before auth/revision changes.
- **Files:** `client/src/__tests__`, `client/src/lib/__tests__`, `server/__tests__`.
- **Change:** Add tests for 8/9/32 player tournaments, duplicate usernames, byes, result correction, public snapshot after result.
- **Tests:** focused Vitest files.
- **Risk:** Low.

## Phase 1 — Live tournament safety

### PR 3: Enforce unique tournament player registrations

- **Goal:** Prevent duplicate players.
- **Files:** `shared/schema.ts`, Drizzle migration, `server/index.ts`, join/add-player tests.
- **Change:** Dedupe/upsert + unique `(tournament_id, username)` constraint.
- **Tests:** server duplicate/concurrent registration tests.
- **Risk:** Low/Medium.

### PR 4: Add tournament state revision field and stale-write warnings

- **Goal:** Detect stale state writes before enforcing hard failures.
- **Files:** `client/src/lib/directorState.ts`, `server/index.ts`, `shared/schema.ts` if needed.
- **Change:** Add revision metadata; server returns current revision; client logs/shows warning on mismatch.
- **Tests:** stale hydration and stale save tests.
- **Risk:** Medium.

### PR 5: Enforce 409 conflict on stale tournament writes

- **Goal:** Prevent stale tabs overwriting results.
- **Files:** same as PR 4.
- **Change:** Require `baseRevision`; return 409; UI offers reload/use server state.
- **Tests:** two-client conflict simulation.
- **Risk:** Medium.

### PR 6: Add director capability validation in shadow mode

- **Goal:** Identify which clients can satisfy director auth before enforcement.
- **Files:** `server/index.ts`, `server/auth.ts`, `client/src/lib/tournamentRegistry.ts`, `client/src/pages/Director.tsx`.
- **Change:** Add middleware that logs missing director proof but does not block in production yet.
- **Tests:** auth middleware unit/integration tests.
- **Risk:** Medium.

### PR 7: Enforce director capability for destructive/high-risk routes

- **Goal:** Block unauthorized state/timer/start/round/end/player-delete mutations.
- **Files:** tournament routes and director client calls.
- **Tests:** anonymous/non-owner/director capability route tests.
- **Risk:** Medium/High; deploy carefully.

## Phase 2 — Performance and UX hardening

### PR 8: Extract tournament live-sync hook for public pages

- **Goal:** Centralize SSE/timer/fetch/stale status for `Tournament.tsx`.
- **Files:** new `client/src/features/tournaments/shared/hooks/useTournamentLiveSync.ts`, `client/src/pages/Tournament.tsx`.
- **Tests:** player/public live-sync tests.
- **Risk:** Medium.

### PR 9: Extract standings selector and performance tests

- **Goal:** Compute standings once and benchmark 100-player events.
- **Files:** `client/src/lib/tournamentData.ts` or new selector module, `Tournament.tsx`, `Director.tsx`.
- **Tests:** standings selector tests and micro-benchmark.
- **Risk:** Low/Medium.

### PR 10: Split Director active tab panels

- **Goal:** Reduce rerender cost and make director UI safer to modify.
- **Files:** `client/src/pages/Director.tsx`, new tournament director components.
- **Change:** Component extraction only, no behavior changes.
- **Tests:** existing director/tournament tests.
- **Risk:** Medium.

### PR 11: Add tournament readiness checklist

- **Goal:** Prevent common pre-round failures.
- **Files:** Director components/selectors.
- **Tests:** readiness selector tests.
- **Risk:** Low.

### PR 12: Persist timer snapshots

- **Goal:** Survive server restart/redeploy during live event.
- **Files:** `shared/schema.ts`, migration, `server/index.ts` or timer service.
- **Tests:** timer save/restore tests.
- **Risk:** Medium.

## Phase 3 — Premium Match Prep

### PR 13: Match Prep structured errors and UI states

- **Goal:** Make failures actionable and premium.
- **Files:** `server/prepEngine.ts`, `server/index.ts`, `client/src/pages/MatchupPrep.tsx` or new components.
- **Tests:** invalid username, rate limit, timeout, no games.
- **Risk:** Low/Medium.

### PR 14: Extract Match Prep display model and report sections

- **Goal:** Make report wording testable and clearer.
- **Files:** new `client/src/features/match-prep/lib/reportDisplayModel.ts`, components.
- **Tests:** display model unit tests.
- **Risk:** Low/Medium.

### PR 15: Centralize Chess.com/Lichess service

- **Goal:** Shared retry/cache/error behavior across profile, prep, registration, and leagues.
- **Files:** `server/services/chesscom.ts`, `server/services/lichess.ts`, callers in `server/index.ts`, `server/prepEngine.ts`, `server/auth.ts`, `server/leagues.ts`.
- **Tests:** service mocks and caller integration tests.
- **Risk:** Medium.

### PR 16: Lazy-load Match Prep practice tab

- **Goal:** Improve first load of premium scouting report.
- **Files:** Match Prep components.
- **Tests:** render/load tests.
- **Risk:** Low.

## Phase 4 — Club/public polish and maintainability

### PR 17: Shared data-state components

- **Goal:** Consistent loading/error/empty/reconnecting UX.
- **Files:** `client/src/components/data-states/*`, selected route migrations.
- **Tests:** component tests.
- **Risk:** Low.

### PR 18: ClubProfile public section extraction

- **Goal:** Improve maintainability and public page performance.
- **Files:** `client/src/pages/ClubProfile.tsx`, new club components/hooks.
- **Tests:** club profile tests.
- **Risk:** Medium.

### PR 19: ClubDashboard admin section extraction

- **Goal:** Reduce dashboard complexity.
- **Files:** `client/src/pages/ClubDashboard.tsx`, new dashboard components.
- **Tests:** club dashboard/admin tests.
- **Risk:** Medium.

### PR 20: Move tournament server routes out of `server/index.ts`

- **Goal:** Improve server maintainability after auth/revision tests exist.
- **Files:** `server/index.ts`, `server/routes/tournaments/*`, route tests.
- **Change:** Mostly move code; preserve behavior.
- **Risk:** Medium.

## Recommended first PR after this audit

**PR 1: Fix TypeScript check configuration** should be first. It is small, low-risk, and restores trust in automated checks. Immediately after that, add tournament lifecycle/duplicate-registration tests before touching live-event behavior.

