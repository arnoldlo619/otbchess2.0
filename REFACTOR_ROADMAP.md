# REFACTOR_ROADMAP.md

## Roadmap principles

- Do not rewrite major systems.
- Protect live tournament workflows first.
- Every risky refactor should be preceded by tests or wrapped behind backward-compatible adapters.
- Prefer extracting seams from existing files over changing behavior.
- Most roadmap items should be separate PRs.

## P0 — Must fix for live tournament safety

### P0.1 Add director authorization to tournament mutations

- **Problem:** Sensitive tournament mutation routes are not consistently protected by auth/director proof.
- **Why it matters:** Unauthorized or accidental writes could alter live event state.
- **Affected files/modules:** `server/index.ts`, `server/auth.ts`, `client/src/lib/tournamentRegistry.ts`, `client/src/pages/Director.tsx`, `client/src/lib/directorState.ts`.
- **Suggested fix:** Add tournament director capability middleware and a token exchange for director code. Start by logging/soft-enforcing, then enforce on state/timer/start/round/end/player delete routes.
- **Complexity:** Large.
- **Risk level:** Medium/High.
- **Order:** tests → middleware → client token plumbing → phased enforcement.
- **Own PR:** Yes.

### P0.2 Add revision/conflict detection to tournament state

- **Problem:** Whole-state PUT is last-write-wins.
- **Why it matters:** Stale tabs can overwrite corrected results.
- **Affected files/modules:** `client/src/lib/directorState.ts`, `server/index.ts`, `shared/schema.ts`.
- **Suggested fix:** Add `revision` and `baseRevision`; server returns 409 on stale writes; UI shows reload/merge prompt.
- **Complexity:** Medium.
- **Risk level:** Medium.
- **Order:** schema/state type → server check → client handling → tests.
- **Own PR:** Yes.

### P0.3 Enforce unique tournament players

- **Problem:** Duplicate prevention is application-level; schema lacks the documented unique constraint.
- **Why it matters:** Duplicate players break pairings/standings trust.
- **Affected files/modules:** `shared/schema.ts`, Drizzle migration, `server/index.ts`, `client/src/pages/Join.tsx`.
- **Suggested fix:** Dedupe existing rows, add unique `(tournament_id, username)`, use upsert, improve duplicate UI.
- **Complexity:** Medium.
- **Risk level:** Low/Medium.
- **Order:** duplicate audit script → migration → server upsert → tests.
- **Own PR:** Yes.

### P0.4 Fix TypeScript deprecation check failure

- **Problem:** `pnpm check` exits non-zero due `baseUrl` deprecation in `tsconfig.json` under current TypeScript behavior.
- **Why it matters:** CI/typecheck cannot distinguish real errors from config failure.
- **Affected files/modules:** `tsconfig.json`.
- **Suggested fix:** Add `ignoreDeprecations` or migrate alias config to supported approach.
- **Complexity:** Small.
- **Risk level:** Low.
- **Order:** config-only PR, run `pnpm check`.
- **Own PR:** Yes.

## P1 — High-impact performance/reliability improvements

### P1.1 Extract tournament live-sync adapter

- **Problem:** LocalStorage, server state, SSE, timer fetch, and polling logic are spread across route files and hooks.
- **Why it matters:** Public pages and director pages can diverge or become stale.
- **Affected files/modules:** `client/src/lib/directorState.ts`, `client/src/pages/Tournament.tsx`, `client/src/pages/Director.tsx`, `server/index.ts`.
- **Suggested fix:** Add `client/src/features/tournaments/shared/hooks/useTournamentLiveSync.ts` that normalizes snapshot, SSE status, stale state, and last updated time.
- **Complexity:** Medium.
- **Risk level:** Medium.
- **Order:** read-only hook for public page → director usage → remove duplicate code.
- **Own PR:** Yes.

### P1.2 Split Director into workflow panels

- **Problem:** `Director.tsx` combines everything in one very large file.
- **Why it matters:** Result entry and round generation become harder to optimize/test.
- **Affected files/modules:** `client/src/pages/Director.tsx`, board card components, standings/bracket/settings sections.
- **Suggested fix:** Extract `DirectorHomePanel`, `PlayersPanel`, `PairingsPanel`, `StandingsPanel`, `BracketPanel`, `SettingsPanel`, and action hooks without changing behavior.
- **Complexity:** Large but incremental.
- **Risk level:** Medium.
- **Order:** pure component extraction → memoization → hook extraction.
- **Own PR:** Multiple PRs.

### P1.3 Centralize Chess.com/Lichess services

- **Problem:** Upstream chess API logic is duplicated across prep, profile, proxy, and league code.
- **Why it matters:** Rate limits and errors degrade registration and premium prep.
- **Affected files/modules:** `server/index.ts`, `server/prepEngine.ts`, `server/auth.ts`, `server/leagues.ts`.
- **Suggested fix:** Add shared services with consistent timeout/retry/user-agent/cache/error taxonomy.
- **Complexity:** Medium.
- **Risk level:** Medium.
- **Order:** create service wrapper → migrate one caller → tests → migrate remaining callers.
- **Own PR:** Yes.

### P1.4 Add tournament readiness checklist

- **Problem:** Directors can start events with duplicates, missing ratings, low player count, unresolved sync issues, or public links off.
- **Why it matters:** Prevents live-event failures before round 1.
- **Affected files/modules:** `client/src/pages/Director.tsx`, `client/src/lib/directorState.ts`, `client/src/lib/tournamentData.ts`.
- **Suggested fix:** Add readiness panel with checks: players >= 2, duplicates, missing ratings/manual ratings, public link, latest server sync, push config/subscribers, odd player bye warning.
- **Complexity:** Medium.
- **Risk level:** Low.
- **Order:** selector tests → panel → CTA integration.
- **Own PR:** Yes.

### P1.5 Improve Match Prep error/report model

- **Problem:** Prep errors and report language need stronger premium clarity.
- **Why it matters:** Match Prep is a premium differentiator.
- **Affected files/modules:** `client/src/pages/MatchupPrep.tsx`, `server/prepEngine.ts`, `server/index.ts`, `shared/schema.ts`.
- **Suggested fix:** Structured error codes, display model extraction, confidence/sample-size metadata, beginner-readable report sections.
- **Complexity:** Medium.
- **Risk level:** Low/Medium.
- **Order:** error taxonomy → UI states → display model → cache metadata.
- **Own PR:** Multiple PRs.

## P2 — Maintainability and UX improvements

### P2.1 Extract public tournament components

- **Problem:** `Tournament.tsx` owns many public/player concerns.
- **Why it matters:** Public/spectator UX needs focused optimization.
- **Affected files:** `client/src/pages/Tournament.tsx`, `client/src/pages/PublicTournament.tsx`, public bracket/timer components.
- **Suggested fix:** Extract `TournamentHero`, `PairingsPanel`, `StandingsPanel`, `PlayerSearch`, `LiveConnectionBadge`, `MobileTournamentTabs`.
- **Complexity:** Medium.
- **Risk:** Low/Medium.
- **Own PR:** Yes.

### P2.2 Create premium data-state component set

- **Problem:** Loading/error/empty/reconnecting states are inconsistent.
- **Why it matters:** Premium UX and live-event trust depend on clear states.
- **Affected files:** broad client pages and components.
- **Suggested fix:** Add `PageState`, `InlineError`, `ReconnectBadge`, `LastUpdatedText`, `RetryButton` under shared components.
- **Complexity:** Small/Medium.
- **Risk:** Low.
- **Own PR:** Yes.

### P2.3 Modularize club profile/dashboard

- **Problem:** Club pages are very large and mix public profile, admin, events, feed, media, members, and tournaments.
- **Why it matters:** Club pages are public premium surfaces and will grow.
- **Affected files:** `client/src/pages/ClubProfile.tsx`, `client/src/pages/ClubDashboard.tsx`, club components, `client/src/lib/clubEventRegistry.ts`.
- **Suggested fix:** Extract feed, events, members, hero, admin panels, upload widgets, and server-sync hooks.
- **Complexity:** Large.
- **Risk:** Medium.
- **Own PR:** Multiple PRs.

### P2.4 Move server tournament routes out of `server/index.ts`

- **Problem:** `server/index.ts` owns too many routes.
- **Why it matters:** Auth and validation consistency suffer.
- **Affected files:** `server/index.ts`, future `server/routes/tournaments.ts`, `server/routes/push.ts`.
- **Suggested fix:** Move route groups without behavior changes after tests exist.
- **Complexity:** Medium/Large.
- **Risk:** Medium.
- **Own PR:** Yes, after P0 tests.

### P2.5 Add mobile director result-entry polish

- **Problem:** Director controls are dense under pressure.
- **Why it matters:** Phones are primary live-event devices.
- **Affected files:** `client/src/pages/Director.tsx`, board/result components.
- **Suggested fix:** Compact board list, sticky round controls, bigger result buttons, one-tap correction workflow, confirm destructive actions.
- **Complexity:** Medium.
- **Risk:** Low/Medium.
- **Own PR:** Yes.

## P3 — Future scalability and polish

### P3.1 Normalize tournament events/results

- **Problem:** Full JSON state limits auditability and concurrency.
- **Why it matters:** Larger tournaments and analytics need durable action history.
- **Suggested fix:** Add event log or normalized games/results tables while keeping state snapshot for reads.
- **Complexity:** Large.
- **Risk:** High.
- **Own PR:** Later, only after revisioning and tests.

### P3.2 Multi-instance live updates

- **Problem:** SSE/timers are process-local.
- **Why it matters:** Horizontal scaling needs shared pub/sub and durable timers.
- **Suggested fix:** Introduce shared pub/sub only when deployment requires it.
- **Complexity:** Large.
- **Risk:** Medium.
- **Own PR:** Later.

### P3.3 Visual regression and bundle dashboards

- **Problem:** Premium UI can drift.
- **Why it matters:** Public club/tournament pages are marketing surfaces.
- **Suggested fix:** Add screenshot smoke tests and bundle-size reporting after core reliability work.
- **Complexity:** Medium.
- **Risk:** Low.
- **Own PR:** Later.

## What not to refactor yet

- Do not replace the local-first tournament model wholesale; it is valuable for weak venue Wi-Fi.
- Do not normalize all tournament state immediately; add revisioning/action endpoints first.
- Do not add Redis/pub-sub until multi-instance deployment requires it.
- Do not rewrite the design system; create shared primitives and migrate gradually.
- Do not move every file into feature folders at once; only move files as part of focused behavior-safe PRs.

