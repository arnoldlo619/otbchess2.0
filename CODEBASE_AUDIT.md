# CODEBASE_AUDIT.md

## Scope and method

This audit uses the product/engineering constraints in `AGENTS.md`, `ARCHITECTURE.md`, and `FEATURE_MAP.md` and inspects the current repository structure, route files, server modules, persistence helpers, schemas, tests, and package/build configuration. It is intentionally a planning document only: no production code changes are proposed in this PR.

Key commands used during audit:

- `rg --files` to inventory pages, components, server modules, tests, and docs.
- `wc -l $(rg --files -g '*.ts' -g '*.tsx' client/src server shared)` to identify oversized modules.
- `rg -n "localStorage|fetch\(|authFetch|EventSource|setInterval|setTimeout|requireAuth|requireFullAuth|app\." ...` to find data-flow, live-update, and permission boundaries.

## Executive diagnosis

ChessOTB.club has strong product breadth and a useful local-first tournament model, but the highest-risk live-event surfaces are concentrated in a small number of very large files and mixed client/server state paths. The most important technical theme is to **harden live tournament reliability before adding more product surface area**.

The platform is already split into client, server, shared schema, docs, and tests, but several feature areas have not yet been modularized enough for safe iteration:

- `client/src/pages/Director.tsx` is about 5,800 lines and owns UI, live updates, server synchronization, notification actions, check-in state, tab navigation, and result/round actions.
- `client/src/pages/Tournament.tsx` is about 2,119 lines and owns public rendering, local/server hydration, SSE, polling/timers, standings, pairings, bracket display, and mobile tabs.
- `client/src/pages/ClubDashboard.tsx` is about 6,253 lines and `client/src/pages/ClubProfile.tsx` is about 3,838 lines.
- `client/src/pages/MatchupPrep.tsx` is about 2,406 lines and mixes fetching, report state, transformations, tab layout, practice state, and premium UX.
- `server/index.ts` is about 3,118 lines and still owns many feature routes that should be in focused routers.
- `shared/schema.ts` is about 2,122 lines and includes many tables; some indexes are comments-only expectations rather than hard constraints.

## 1. Architecture and code organization

### Current structure strengths

- The client/server/shared separation is clear: SPA in `client/`, Express in `server/`, database schema in `shared/schema.ts`, Drizzle migrations in `drizzle/`.
- Routes are centralized in `client/src/App.tsx`, and pages are lazy-loaded, which is good for bundle boundaries.
- There are many focused utilities under `client/src/lib/`, including `directorState.ts`, `tournamentRegistry.ts`, `swiss.ts`, `clubsApi.ts`, `clubEventRegistry.ts`, `broadcastUtils.ts`, and `apiFetch.ts`.
- The repository has broad Vitest coverage across tournament, club, prep, openings, CV, broadcast, and auth paths.

### Current structure risks

| Risk | Evidence | Why it matters | Recommended direction |
|---|---|---|---|
| Oversized route components | `client/src/pages/Director.tsx`, `ClubDashboard.tsx`, `ClubProfile.tsx`, `LeagueDashboard.tsx`, `MatchupPrep.tsx`, `Tournament.tsx` are all large. | Large files slow AI/human review, make tests less targeted, and increase accidental regressions. | Extract feature folders by workflow: tournament director panels, public tournament panels, club dashboard sections, match-prep report sections. |
| `server/index.ts` owns too much | It registers prep, chess proxy, avatar proxy, recordings, clubs, leagues, push, tournament state, SSE, timer, analytics, public tournament, broadcast, battles, and static serving. | Production-critical routes are harder to reason about; auth consistency suffers. | Move tournament state/player/timer/public snapshot/push routes into `server/tournaments.ts` and chess proxy into `server/chessProxy.ts`. |
| UI and business logic are mixed | `Director.tsx` calls APIs, reads localStorage, manages SSE, and renders complex boards/standings. `MatchupPrep.tsx` fetches reports and renders all tabs. | Makes live-event flows difficult to harden independently from design. | Extract hooks (`useTournamentLiveSync`, `useDirectorActions`, `useMatchPrepReport`) and pure view components. |
| Local-first and server-backed data are interleaved | `client/src/lib/directorState.ts` hydrates from server, persists to localStorage, and fire-and-forget syncs to server. `client/src/lib/clubEventRegistry.ts` merges localStorage with server events. | Cross-device data divergence can happen during real events. | Add explicit source-of-truth and conflict-resolution docs/code per feature. |
| Permission model is partly local-first | `client/src/lib/tournamentRegistry.ts` tracks director sessions in localStorage; some server tournament mutation routes lack auth middleware. | Director-only actions can be hard to enforce server-side. | Add capability tokens/director code validation to sensitive tournament APIs while preserving local-first UX. |

### Repeated UI patterns that should become reusable components

- **Live status headers:** tournament/public/director pages each show event status, round, timer, and connection context. Extract `LiveEventHeader` or `TournamentStatusHeader`.
- **Mobile tab navigation:** `Director.tsx`, `Tournament.tsx`, and club pages have bespoke tab/swipe behavior. Extract a `MobileSegmentedTabs` / `SwipeableTabs` primitive.
- **Result cards and board cards:** `Director.tsx`, `Tournament.tsx`, `PublicTournament.tsx`, and player views render pairings/results in overlapping ways. Extract `PairingCard`, `ResultEntryControls`, `BoardAssignmentCard`.
- **Loading/empty/error states:** many pages implement custom spinners and messages. Extract premium `PageState`, `InlineState`, and `DataRetryCard` components.
- **Share/QR blocks:** spectator QR, public links, invite links, club/event check-in links can use shared `ShareLinkCard` and `QRCodePanel`.

### Duplicated or divergent data access patterns

- `client/src/lib/apiFetch.ts` provides `authFetch` and `apiFetch`, but many pages still call `fetch` directly for APIs such as broadcast routes, timer routes, and some tournament flows.
- Chess.com integration appears in `server/index.ts`, `server/prepEngine.ts`, `server/auth.ts`, and `server/leagues.ts`. Centralizing upstream fetch, retry, cache, and response normalization would reduce rate-limit fragility.
- Tournament state is read from localStorage, `/api/tournament/:id/state`, `/api/tournament/:id/live-state`, and SSE streams. These are useful but need a single client-side adapter to avoid stale or conflicting state transitions.

### Ideal incremental future structure

Do not rewrite. Move toward feature slices while preserving import aliases and existing routes:

```text
client/src/
  features/
    tournaments/
      director/
        components/
        hooks/
        state/
      public/
        components/
        hooks/
      shared/
        components/
        lib/
        types.ts
    match-prep/
      components/
      hooks/
      lib/
      types.ts
    clubs/
      dashboard/
      profile/
      events/
      hooks/
      lib/
    auth/
    broadcasts/
  components/
    ui/
    layout/
    data-states/
  lib/
    api/
    chess/
    storage/
server/
  routes/
    tournaments/
    chessProxy.ts
    prep.ts
    push.ts
  services/
    tournaments/
    chesscom.ts
    lichess.ts
    authorization.ts
  repositories/
```

Start by extracting **new code only** into this structure, then move old code one seam at a time.

## 2. Data flow and API reliability

### Tournament state flow

Current flow:

1. `client/src/lib/tournamentRegistry.ts` stores tournament configuration in localStorage.
2. `client/src/lib/directorState.ts` stores mutable state in localStorage and hydrates from `/api/tournament/:id/state` if the server row is newer.
3. It saves to localStorage after 300ms and to server after 1500ms.
4. `server/index.ts` persists the entire director state as JSON in `tournament_state.state_json`.
5. Public/player pages also fetch `/api/tournament/:id/live-state`, `/api/tournament/:id/timer`, and subscribe to SSE.

Main reliability issues:

- Server state writes are whole-blob last-write-wins updates. There is no version, revision, or compare-and-swap guard.
- Server writes are fire-and-forget from the client; failures are intentionally ignored. This is good for local resilience but risky for cross-device recovery.
- Some director actions in `Director.tsx` wait with `setTimeout` and then read localStorage to push state to server. This is fragile under slow devices or throttled tabs.
- The server schema comment says `tournament_players` has a unique constraint on `(tournament_id, username)`, but the schema only defines an index on tournament ID. That means concurrent duplicate registration can still race unless enforced elsewhere.
- `tournament_state.state_json` stores a full JSON blob; shape validation is minimal at the API boundary.

### Club/event flow

Current flow:

- `client/src/lib/clubRegistry.ts` and `client/src/lib/clubEventRegistry.ts` preserve local-first behavior.
- `clubEventRegistry.ts` writes events/RSVPs/comments to localStorage and syncs to `/api/clubs/:clubId/events` and RSVP endpoints.
- `server/clubs.ts` has real server-backed club/event routes and ownership checks for many write actions.

Risks:

- Merge rules are implicit. Server and localStorage rows can diverge by edited fields, timestamps, or deleted records.
- Event comments appear local-first in the client helper; ensure server parity before marketing comments as durable/cross-device.
- Club public profile and dashboard pages are large enough that owner/admin logic can become hard to audit.

### Auth/profile flow

Current flow:

- `server/auth.ts` creates JWTs with `JWT_SECRET`, sets httpOnly cookie, and returns token for SPA fallback.
- `client/src/lib/apiFetch.ts` reads `otb-auth-token` from localStorage and sends it as `Authorization: Bearer`.
- Guest JWTs exist and `requireFullAuth` blocks guest-only sessions.

Risks:

- Token-in-localStorage fallback is an intentional Cloud Run workaround, but it increases XSS blast radius.
- Some APIs use `fetch` directly instead of `authFetch`, causing inconsistent credentials and error behavior.
- Older local-first flows may treat localStorage identity as sufficient for director actions.

### Match prep flow

Current flow:

- `MatchupPrep.tsx` calls `/api/prep/:username` via `authFetch`, with filters for time control and game count.
- `server/prepEngine.ts` fetches Chess.com monthly archives, filters time controls, builds stats and recommendations, and caches reports.
- `server/index.ts` also owns prep endpoints and Chess.com/Lichess proxy endpoints.

Risks:

- Chess.com upstream failures are common under rate limits or private/unavailable accounts; UX must clearly separate invalid username, no recent games, upstream temporary failure, and not enough games.
- Report language may be technically correct but too dense for beginners unless segmented into “Play this”, “Avoid this”, “Prep 10 minutes”, and “If they surprise you” guidance.
- Caches are username keyed; filters such as rapid/blitz/game count must be included in cache identity if not already in endpoint logic.

## 3. Security and permission audit

Severity levels are relative to live tournament risk.

| Severity | Issue | Evidence/files | Recommendation |
|---|---|---|---|
| High | Several tournament mutation endpoints in `server/index.ts` do not require auth/director proof: player POST/DELETE, state PUT, timer PUT, start/round/end. | `server/index.ts` tournament routes around `/api/tournament/:id/state`, `/players`, `/timer`, `/start`, `/round`, `/end`. | Add director capability validation. Preserve join/public flows but require either authenticated owner, valid director code token, or server-issued director session for mutations. |
| High | Whole director state JSON can be overwritten by stale clients. | `client/src/lib/directorState.ts`, `server/index.ts`, `shared/schema.ts`. | Add `revision`/`updatedBy`/`updatedAt` compare-and-swap or append-only event log for critical actions. |
| Medium | JWT in localStorage fallback increases XSS impact. | `client/src/lib/apiFetch.ts`. | Keep fallback if required, but document it, tighten CSP if possible, avoid unsafe HTML, and migrate toward httpOnly-only where deployment allows. |
| Medium | External avatar proxy can fetch arbitrary HTTP(S) URLs if not restricted. | `server/index.ts` `/api/avatar-proxy`. | Add allowlist for chess.com/lichess/CDN avatars or strict URL validation and size/type limits. |
| Medium | Push notification endpoints can be abused if not tied to director permission. | `server/index.ts` `/api/push/notify/:tournamentId*`. | Require director proof and rate limit by tournament/user. |
| Low/Medium | Some uniqueness expectations are not database constraints. | `shared/schema.ts` tournament player comment vs schema index. | Add unique indexes with safe migration and duplicate cleanup. |

## 4. UI/UX and design consistency

### Strengths

- The design language is clear: dark forest green, cream, board green, premium cards, and mobile awareness.
- The app has many sophisticated OTB-specific components: QR modals, brackets, timers, live board panels, public snapshots, and club media.
- There is deliberate route-level lazy loading.

### Gaps

- Large pages use many one-off card/button/tab implementations, causing style drift.
- Director dashboard is powerful but dense. During a live event, the most common actions should be bigger and more task-oriented: start round, enter result, correct result, publish pairings, message players, timer controls.
- Public pages need a “venue screen / mobile spectator” hierarchy: current round, board assignment search, standings, QR/share, timer/status.
- Error states often need more actionable copy: “Chess.com is rate-limiting us; try refresh in 60 seconds” is better than generic failures.
- Loading states should differentiate first load, stale cache refresh, and reconnecting live updates.

## 5. Mobile and live-event readiness

Primary live-event risks:

- Venue Wi-Fi drops while director submits results or generates rounds.
- Several players refresh public page simultaneously after pairings are posted.
- Director uses an older phone and large pages rerender slowly.
- Chess.com lookups time out during registration/import.
- A stale localStorage copy overwrites server state after reconnect.

Recommended live-event posture:

- Show persistent connection/save status in director and public tournament views.
- Make result entry and correction available from a compact mobile-first board list.
- Add idempotent server endpoints for critical tournament actions.
- Add a “pre-event readiness check” page or panel: database reachable, JWT present, VAPID configured, public link enabled, player count, duplicate usernames, missing ratings, latest server sync time.
- Cache public tournament snapshots aggressively but invalidate deterministically after state writes.

## 6. Highest-leverage improvements

1. **Tournament mutation authorization and revisioning.** Prevent stale/unauthorized writes and make live events safer.
2. **Extract tournament live-sync adapter.** Centralize localStorage/server/SSE/polling logic for Director, Tournament, PlayerView, and PublicTournament.
3. **Split Director into workflow panels.** Reduce rerenders and make result/round flows safer to test.
4. **Centralize Chess.com/Lichess services.** Improve cache, retries, error classes, rate-limit messaging, and username validation across profile, prep, registration, and leagues.
5. **Create a premium data-state and mobile event UI kit.** Make loading, reconnecting, empty, error, QR, timer, result cards, and board assignments consistent.

