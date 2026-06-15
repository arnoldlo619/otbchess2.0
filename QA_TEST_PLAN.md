# QA_TEST_PLAN.md

## Testing strategy overview

ChessOTB.club should optimize QA around live OTB tournament reliability. The test strategy should have four layers:

1. **Pure unit tests** for pairing, standings, tiebreak, report display models, validators, and data selectors.
2. **Integration tests** for localStorage/server sync, auth, APIs, tournament lifecycle, club events, and prep endpoints.
3. **Browser/E2E smoke tests** for critical user journeys on mobile and desktop.
4. **Manual pre-event checklist** for production readiness before running a real tournament.

The repository already has broad Vitest coverage under `client/src/__tests__`, `client/src/components/__tests__`, `client/src/lib/__tests__`, `server/__tests__`, and `tests/`. The next step is to organize tests by live-event risk.

## P0 test coverage to add or strengthen

### 1. Tournament lifecycle simulation

**Goal:** Simulate a complete tournament from creation to final standings.

**Recommended tests:**

- 8-player Swiss: create players, start, enter all results, generate next round, verify no rematches, final standings.
- 9-player Swiss: verify byes, no repeat byes where possible, board assignments stable.
- 32-player event: performance budget for standings/pairing generation.
- Swiss-elim: Swiss phase cutoff, bracket generation, semifinal/final/third-place game.
- Double-Swiss: verify expected double-round behavior and no illegal duplicate pairings beyond format rules.

**Affected files:** `client/src/lib/directorState.ts`, `client/src/lib/swiss.ts`, `client/src/lib/tournamentData.ts`, `client/src/__tests__/*swiss*`, `*tournamentLifecycle*`, `*elimination*`.

### 2. Concurrent state update tests

**Goal:** Prevent stale tabs from overwriting newer results.

**Recommended tests:**

- Two clients load same state; client A enters result; client B tries stale save; server rejects with 409 after revisioning PR.
- State hydration chooses server only when server is newer.
- Fire-and-forget failure does not wipe local state.

**Affected files:** `client/src/lib/directorState.ts`, `server/index.ts` or future `server/routes/tournaments/*`.

### 3. Tournament mutation authorization tests

**Goal:** Ensure only directors can mutate tournament state.

**Recommended tests:**

- Anonymous can read public state but cannot PUT full state.
- Player can register only through intended join endpoint.
- Authenticated non-owner cannot start/end/round/timer unless they have director capability.
- Director token/code can mutate only its tournament.

**Affected files:** `server/index.ts`, `server/auth.ts`, `client/src/lib/tournamentRegistry.ts`.

### 4. Duplicate registration tests

**Goal:** Prevent duplicate players in server and UI.

**Recommended tests:**

- Same username with different casing dedupes.
- Concurrent POSTs produce one row after unique constraint/upsert.
- Duplicate join returns clear UI copy.
- Manual add and join link cannot create separate entries for same platform username.

**Affected files:** `server/index.ts`, `shared/schema.ts`, `client/src/pages/Join.tsx`, `client/src/components/AddPlayerModal.tsx`.

## Match Prep test plan

### Unit tests

- Report display model converts raw report into beginner-readable sections.
- Confidence level changes with game count/sample size.
- Recommendation wording includes sample size and avoids overclaiming.
- Cache key includes username, time-control filter, game count, and engine version after cache PR.

### Integration tests

- Invalid username returns `username_not_found` and UI shows spelling guidance.
- Chess.com timeout returns retryable `upstream_timeout`.
- Rate limit returns retry guidance.
- No rapid games with rapid filter suggests switching to all/blitz.
- Saved reports list shows last analyzed and engine version.

**Affected files:** `client/src/pages/MatchupPrep.tsx`, future match-prep hooks/lib, `server/prepEngine.ts`, `server/index.ts` prep routes.

## Club/event test plan

### Unit/integration tests

- LocalStorage event creation merges with server event sync without duplicating.
- RSVP add/update/delete handles offline/local first then server sync.
- Owner/admin controls are hidden and server-rejected for non-admin users.
- Event check-in works from QR route on mobile.
- Club banner/avatar upload validates file size/type and falls back gracefully.

**Affected files:** `client/src/lib/clubEventRegistry.ts`, `client/src/lib/clubRegistry.ts`, `server/clubs.ts`, `client/src/pages/ClubProfile.tsx`, `client/src/pages/ClubDashboard.tsx`.

## Auth/profile test plan

- Register/login/logout/refresh flows.
- Guest session can access allowed pages but receives `GUEST_FORBIDDEN` for full-auth actions.
- Profile update handles Chess.com/Lichess failures without losing existing profile fields.
- LocalStorage token fallback works, but pages also work with cookie-only auth.
- Staff/pro flags are enforced server-side for gated admin/pro features.

**Affected files:** `server/auth.ts`, `client/src/context/AuthContext.tsx`, `client/src/lib/apiFetch.ts`, `server/billing.ts`, `server/adminStaff.ts`.

## Public/spectator/live test plan

- Public tournament page loads from empty localStorage/fresh device.
- Public page shows stale/reconnecting state when SSE disconnects.
- SSE reconnect does not duplicate event handlers or leak connections.
- Timer fetch fallback works when SSE event missed.
- QR links resolve on mobile without prior localStorage.
- Public bracket and standings update after director result changes.

**Affected files:** `client/src/pages/Tournament.tsx`, `client/src/pages/PublicTournament.tsx`, `server/index.ts`, `server/publicSnapshot.ts`.

## Mobile QA checklist

Run on iPhone Safari, Android Chrome, and a small desktop width:

- Join tournament by QR code.
- Register player with and without Chess.com username found.
- Director starts tournament from phone.
- Enter result with one hand; verify touch targets are large enough.
- Correct a mistaken result.
- Generate next round and publish pairings.
- Player searches/finds their board.
- Spectator opens public link from fresh browser.
- Timer banner remains readable.
- Network goes offline for 20 seconds, then reconnects.
- Refresh page mid-round.
- Dark/light theme contrast remains acceptable.

## Manual QA checklist for PR 2 tournament lifecycle tests

Use this focused checklist when reviewing the PR 2 safety-net tests before moving on to database duplicate enforcement or state revisioning:

- Desktop happy path: create an 8-player Swiss test tournament, start round 1, enter all results, generate later rounds, and confirm standings update after each completed round.
- Mobile happy path: on a narrow viewport, register from a join link, open the director console, and confirm pairings/results remain readable while entering a result.
- Empty/error state: verify a tournament with fewer than two players cannot start and duplicate local registration returns clear duplicate handling instead of adding another player.
- Tournament workflow: verify a 9-player event assigns exactly one bye per round and avoids repeat bye recipients while alternatives remain available.
- Auth/permission check: no permission behavior changes are expected in this PR; use this test-only safety net before later director-capability enforcement.
- Public page check: after correcting a result, confirm the public snapshot/standings reflect the corrected winner and updated score.
- Edge cases: confirm a 32-player first round pairs every player exactly once and produces no validation errors.
- Previous PR regression check: run `pnpm check` and record whether the TypeScript-check configuration from PR 1 remains usable in the local dependency set.

## Manual QA checklist for PR 3 unique tournament player registrations

Use this focused checklist when reviewing the PR 3 duplicate-registration hardening before moving on to tournament state revisioning:

- Desktop happy path: open a tournament join link, register one Chess.com player, refresh the director console, and confirm the player appears exactly once.
- Mobile happy path: scan/open the same join link on a phone-width viewport and re-submit the same username with different casing; confirm the roster still shows one player with refreshed details.
- Empty/error state: submit the join form with a missing username and confirm the existing validation/error copy remains clear.
- Tournament workflow: register enough players to start a small Swiss event and confirm pairings use the deduped roster, not duplicate server rows.
- Auth/permission check: no permission behavior changes are expected in this PR; duplicate prevention applies to the public join/add-player registration endpoint only.
- Public page check: open the public tournament page from a fresh browser after duplicate re-submission and confirm player counts/standings do not double-count that player.
- Edge cases: try concurrent duplicate submissions for the same tournament/username and confirm the database keeps one `(tournament_id, username)` row.
- Previous PR regression check: rerun the PR 2 lifecycle safety tests to confirm byes, result corrections, and public snapshots still behave as expected.

## Manual QA checklist for consolidated live tournament reliability

Use this checklist when reviewing the consolidated duplicate-registration plus state-revision safety pass:

- Desktop happy path: open the director console, add players, start round 1, enter a result, and confirm the state saves successfully after refresh.
- Mobile happy path: repeat result entry on a phone-width viewport and confirm the public/player page receives the latest pairings or standings.
- Empty/error state: load a fresh tournament with no saved server state and confirm local-first behavior still works without a blocking error.
- Tournament workflow: with two director tabs open, save a result in tab A, then attempt to save stale state from tab B and confirm the server returns a revision conflict instead of overwriting tab A.
- Auth/permission check: no director capability enforcement is included in this pass; use existing access boundaries and note this remains a later hardening item.
- Public page check: after a successful non-conflicting save, refresh a public tournament page and confirm the snapshot reflects the latest server state.
- Edge cases: confirm duplicate player re-submission still leaves one roster row, and stale state conflict handling does not remove localStorage fallback data.
- Previous PR regression check: rerun focused tournament lifecycle and duplicate-registration tests.

## Manual pre-tournament release checklist

Before using production for a real event:

1. Run typecheck/lint/tests or documented focused subset.
2. Confirm `DATABASE_URL`, `JWT_SECRET`, VAPID keys, email, and Stripe settings relevant to the event.
3. Create test tournament with same format/player count class.
4. Add/import players and verify duplicates/missing ratings.
5. Open director dashboard on primary and backup device.
6. Open public page from fresh/incognito device.
7. Test QR join and QR spectator links.
8. Start round, enter dummy result, undo/correct result.
9. Generate next round and verify no rematches/byes issue.
10. Test timer start/pause/reset and push/subscriber count if using notifications.
11. Export/print pairings and standings.
12. Document rollback plan: who can edit results manually and how.

## Suggested CI gates

Short-term:

- `pnpm check` once TypeScript deprecation config is fixed.
- Focused Vitest group for tournament lifecycle and Swiss.
- Server route tests for auth/tournament mutation permissions.

Medium-term:

- Browser smoke tests for create → join → start → result → next round.
- Mobile viewport smoke test for public tournament and director result entry.
- Performance micro-benchmark with threshold for 100-player standings/pairings.
