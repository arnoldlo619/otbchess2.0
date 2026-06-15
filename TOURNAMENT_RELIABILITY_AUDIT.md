# TOURNAMENT_RELIABILITY_AUDIT.md

## Executive summary

Tournament management is the core ChessOTB.club workflow and should be hardened before major new feature expansion. The current system has a useful local-first design, strong UI breadth, and broad tests, but the most serious reliability risks are:

1. Critical mutation endpoints are not consistently director-authorized.
2. Full tournament state is saved as a last-write-wins JSON blob.
3. Director UI actions sometimes depend on delayed localStorage reads after state changes.
4. Duplicate player constraints are not fully enforced at the database level.
5. Live state is spread across localStorage, server snapshots, SSE, timers, and public cache.

## Current tournament workflow map

### Creation

- UI: `client/src/components/TournamentWizard.tsx`.
- Registry: `client/src/lib/tournamentRegistry.ts`.
- Optional club link: `clubId`, `clubName`, cover image fields in tournament config.
- User tournament metadata routes: `server/auth.ts` contains `/api/auth/user/tournaments` and join/slug helpers.

### Director state

- Hook/store: `client/src/lib/directorState.ts`.
- UI: `client/src/pages/Director.tsx`.
- Server snapshot: `server/index.ts` `/api/tournament/:id/state`.
- Database: `shared/schema.ts` `tournamentState` table with full `state_json`.

### Player registration

- Join page: `client/src/pages/Join.tsx`.
- Local player registration helper: `client/src/lib/registrationStore.ts`.
- Server player rows: `server/index.ts` `/api/tournament/:id/players`.
- Database: `shared/schema.ts` `tournamentPlayers`.

### Pairings/results

- Pairing and scoring utilities: `client/src/lib/tournamentData.ts`, `client/src/lib/swiss.ts`, `client/src/lib/styleAwarePairings.ts`.
- Director actions: `client/src/lib/directorState.ts` functions such as `startTournament`, `enterResult`, `generateNextRound`, `addLatePlayer`, `removePlayer`, cutoff/elimination helpers.
- UI entry points: `client/src/pages/Director.tsx`, board/result cards, swap/cutoff/edit modals.

### Public/spectator pages

- Public route: `client/src/pages/Tournament.tsx`.
- Public snapshot route: `server/index.ts` `/api/public/tournament/:slug` and public mode routes.
- Public tournament page: `client/src/pages/PublicTournament.tsx`.
- QR/share components: `QRModal`, `SpectatorQRScreen`, `SpectatorShareModal`, public bracket/timer components.

### Live updates

- SSE subscriber registry: `server/index.ts` in-memory `sseSubscribers` map.
- Player stream and tournament stream endpoints: `server/index.ts`.
- Timer store: `server/index.ts` in-memory `timerStore` and timeout maps.
- Push subscriptions: `shared/schema.ts` `pushSubscriptions`, server push routes.

## Critical reliability findings

### TR-1: Critical tournament mutations need director authorization

**Problem:** Several mutation routes appear unauthenticated or not director-scoped: full state PUT, player POST/DELETE, timer PUT, start/round/end. Some routes with public effects should not rely on obscurity of tournament ID.

**Affected files/modules:**

- `server/index.ts` tournament routes.
- `client/src/pages/Director.tsx` direct mutation calls.
- `client/src/lib/directorState.ts` server sync.
- `client/src/lib/tournamentRegistry.ts` director session/director code.

**Why it matters:** During a live tournament, unauthorized or accidental writes could alter pairings, results, timers, or player registrations.

**Suggested fix:**

- Introduce a server-side director capability model:
  - Authenticated owner can mutate.
  - Director code can be exchanged for short-lived server-issued director token.
  - Public/player routes remain read-only except explicit join/result submission flows.
- Add middleware `requireTournamentDirector(req, res, next)` in a new tournament route module.
- Keep local-first director UX, but require auth/capability when syncing to server.

**Complexity:** Medium/Large.
**Risk of change:** Medium; can break live flows if rolled out too broadly. Start in shadow/audit mode.
**Own PR:** Yes.

### TR-2: Last-write-wins state JSON can overwrite newer results

**Problem:** `client/src/lib/directorState.ts` debounces server writes; `server/index.ts` accepts full-state PUT and overwrites `state_json`. There is no revision guard.

**Why it matters:** If a director opens two tabs/devices, an older tab can overwrite a corrected result or new round.

**Suggested fix:**

- Add `revision` and `lastActionId` to persisted state.
- Server requires `baseRevision` for mutations and rejects stale writes with `409`.
- Client shows “server has newer data” and offers reload/merge.
- Short term: add `updatedAt` conflict warnings before server save.

**Complexity:** Medium.
**Risk of change:** Medium.
**Own PR:** Yes.

### TR-3: Delayed localStorage reads after actions are fragile

**Problem:** `Director.tsx` contains patterns that call a state action, wait with `setTimeout`, then read `otb-director-state-v*` from localStorage to POST `/start`, `/round`, or `/state`.

**Why it matters:** Debounce timing can fail on slow phones, background tabs, or under CPU throttling, causing stale server broadcasts.

**Suggested fix:**

- Make `useDirectorState` action methods return the next state or expose an `onStateCommitted` callback.
- Add explicit action endpoints that receive action payloads rather than reading whole localStorage state after a timeout.
- Replace magic 300/350/1500ms waits with promises or reducer action results.

**Complexity:** Medium.
**Risk:** Medium.
**Own PR:** Yes.

### TR-4: Player duplicate prevention should be database-enforced

**Problem:** `shared/schema.ts` comment says unique `(tournament_id, username)`, but `tournamentPlayers` only defines `tournamentIdx`. `server/index.ts` checks for existing rows before insert, but concurrent requests can race.

**Why it matters:** Duplicate registrations create pairing/standing confusion and board assignment errors.

**Suggested fix:**

- Add migration to dedupe existing rows and add unique index `(tournament_id, username)`.
- Update insert to use DB upsert semantics.
- Normalize username/platform consistently before persistence.

**Complexity:** Small/Medium.
**Risk:** Low/Medium after dedupe.
**Own PR:** Yes.

### TR-5: Timer state is not durable across server restarts

**Problem:** Timer snapshots and scheduled push timeouts are in memory in `server/index.ts`.

**Why it matters:** A deployment/restart during a tournament loses authoritative timer state and pending warning/expiry notifications.

**Suggested fix:**

- Short term: persist latest timer snapshot in `tournament_state` or a dedicated `tournament_timers` table.
- On server start, restore running timers and recompute remaining warning/expiry delays.
- Continue using in-memory timers for delivery speed.

**Complexity:** Medium.
**Risk:** Low/Medium.
**Own PR:** Yes.

## Edge-case audit

### Odd player counts and byes

- Pairing utilities appear to support BYE games; `Director.tsx` has `ByeCard` and `directorState.ts` handles bye paths.
- Tests include Swiss pairing and elimination tests.
- Hardening needed: one bye per player per tournament where possible, clear UI for bye result, and manual override guardrails.

### Late players

- `directorState.ts` has `addLatePlayer` logic.
- Hardening needed: UI should explain whether late player receives a bye, is paired immediately, or waits until next round. Server sync should treat late-add as an action with revision.

### Withdrawals/removals

- `directorState.ts` has `removePlayer` and `removePlayerRound1`.
- Hardening needed: separate “withdraw from future rounds” from “delete mistaken registration”. Preserve audit trail after round 1 starts.

### Incorrect results and corrections

- Result editing is supported through director actions and undo-related components.
- Hardening needed: audit log of result corrections, visible “last changed” metadata, and conflict detection when result changes after standings were published.

### Missing ratings

- Tournament config supports rating type and manual pairing rating fields.
- Hardening needed: pre-start readiness check listing unrated players, duplicate ratings, and platform lookup failures.

### Duplicate players

- Needs DB-level unique constraint and UI duplicate resolution.

### Public display stale data

- Public snapshots are cached and invalidated after state writes. This is good.
- Hardening needed: public page should show “last updated” and reconnecting/stale indicators.

## Recommended hardening backlog

| Priority | Item | Problem | Suggested fix | Complexity | Own PR |
|---|---|---|---|---|---|
| P0 | Director auth/capability for mutation routes | Server accepts sensitive writes without consistent director proof. | Add middleware and phased enforcement. | Large | Yes |
| P0 | State revision/conflict detection | Stale clients can overwrite results. | Add revision/baseRevision and 409 flow. | Medium | Yes |
| P0 | Unique tournament player constraint | Concurrent duplicate registrations possible. | Dedupe + unique index + upsert. | Medium | Yes |
| P1 | Remove setTimeout/localStorage action sync | State broadcasts can lag/stale on slow devices. | Return next state from actions or create action endpoints. | Medium | Yes |
| P1 | Pre-start readiness checklist | Directors may start with duplicates/missing ratings/config issues. | Add readiness panel in Director home/settings. | Medium | Yes |
| P1 | Result correction audit trail | Mistakes are common in OTB events. | Add correction metadata and optional history. | Medium | Yes |
| P1 | Persist timer snapshots | Restart loses timer state. | Add table or state field + restore logic. | Medium | Yes |
| P2 | Public stale/reconnect status | Spectators may see old pairings. | Add last-updated and connection badge. | Small | Yes |
| P2 | Tournament action tests | Current tests broad but need concurrency simulations. | Add API/state conflict tests. | Medium | Yes |
| P3 | Normalized tournament tables | Full JSON blob limits future scale. | Add event log or games/results tables later. | Large | Yes, later |

