# Quads Live Repair Audit — Join Resolution and Server Registration Lifecycle

**Audit ID:** `03-registration`  
**Method:** Read-only source audit and focused regression tests. No application code, configuration, database rows, browser storage, caches, public endpoints, or historical tournament records were changed.

## Executive finding

The Join page now has a sound **server-first tournament identity** path: `/join/:code` resolves through a no-store server endpoint before the client writes a convenience copy to its local registry, and the player roster POST is awaited before the QR path updates local state. The Director also has an SSE-plus-no-store-polling roster reconciliation path. Those verified behaviors should be retained.

The high-priority repair is **not Quads generation, pairing, or standings**. It is server authority at the registration boundary. The server can currently reject a registration only from `tournament_state.stateJson.status`; it does not enforce configured capacity, does not have the configured capacity in its authoritative tournament row, and does not require or verify a director for state/start/end lifecycle writes. The separate `user_tournaments.status` lifecycle mirror can therefore diverge from the state JSON used by the registration guard. In particular, a finalization that updates only the user-tournament mirror, or any stale/missing state row, leaves the POST registration route open.

## Actual routes, loaders, stores, caches, and calculations

| Surface | Actual route / loader | Authoritative storage / cache behavior | Enforcement or calculation actually used |
|---|---|---|---|
| Join route | Client route `/join/:code` (`client/src/App.tsx`); `Join.tsx` requests `GET /api/auth/join/resolve/:codeOrSlug` before QR joining | `user_tournaments` lookup by invite code, case-insensitive custom slug, or tournament ID; response sets `Cache-Control: no-store, max-age=0` | Resolver returns ID, name, venue, date, format, rounds, invite code, custom slug, and **status**. It does **not** return capacity or time/rating configuration. |
| Client registry | `client/src/lib/tournamentRegistry.ts` | Local `otb-tournament-registry-v1`; client-only cache. `registerTournament()` overwrites same ID and normalizes Quads to 3 rounds. | `resolveTournament()` tries invite code, custom slug, then ID. It is not an authority for a fresh device or a registration decision. |
| QR metadata | Director builds `/join/<invite>?t=<base64 JSON>` in `Director.tsx:2440–2465`; wizard also embeds it | URL payload; Join decodes it, but QR resolution deliberately starts server-first | Includes `maxPlayers`, but after server resolution `serverJoinConfig` wins over embedded metadata. |
| Join status / count display | `Join.tsx` fetches `GET /api/tournament/:id/live-state` once after resolving config | `tournament_state.state_json`; no-store response. Local director state is preferred if it exists. | Closed if local or returned state status is `in_progress`, `paused`, or `completed`; count is state players. |
| Join capacity UI | `Join.tsx:813–826` | Only local `otb-director-state-v2-<id>` plus client registry capacity | Client disables Confirm when local roster count reaches `resolvedConfig.maxPlayers`. On fresh devices without local director state, it returns false; server-resolved configs hard-code `maxPlayers: 64`. |
| Registration write | `POST /api/tournament/:id/players` | `tournament_players`, with unique `(tournament_id, username)`; atomic `onDuplicateKeyUpdate` | Reads only `tournament_state.state_json.status`; rejects `completed`, `in_progress`, `paused` with `409 registration_closed`; otherwise upserts. There is **no server capacity check**. |
| Director roster reconciliation | `GET /api/tournament/:id/players`; `GET /api/tournament/:id/players/stream` | Player rows; GET sets `Cache-Control: no-store`. Director performs initial/visibility/SSE-open refresh plus 5-second poll. | `addPlayer()` merges incoming rows locally; an SSE miss does not permanently strand a registration. |
| Director lifecycle writes | `PUT /api/tournament/:id/state`; `POST /api/tournament/:id/start`; `POST /api/tournament/:id/end` | `tournament_state` has revision CAS; `user_tournaments.status` is a separate mirror | State PUT validates only presence/revision, not authorization or transition validity. Start patches state to `in_progress` and sets user row `in_progress`/`startedAt`. End broadcasts SSE only; Director separately posts a user-tournament status `completed`. |
| Auto-expiry | server startup task every 30 minutes | `user_tournaments` | Changes only rows where `user_tournaments.status = in_progress` and `started_at < 24h` to `completed`; it does not update the state JSON consumed by registration guard. |

## Confirmed defects and root causes

| Priority | Confirmed defect | Source evidence | Root cause / impact |
|---|---|---|---|
| **P0** | **Configured capacity is not server-enforced.** Concurrent/fresh-device registrations can exceed the configured cap. | `tournament_players` has username uniqueness but no count constraint (`shared/schema.ts:135–165`). The POST handler only reads state status and then upserts (`server/index.ts:618–664`); it never reads a cap or counts registrations. `user_tournaments` has no `maxPlayers` column (`shared/schema.ts:195–230`). | Capacity exists in client `TournamentConfig`, local registry, and QR metadata, not in the authoritative server tournament record. Client cap UI is advisory and bypassable. This affects Quads operationally: a roster can grow past the director-selected cap immediately before Quads are locked/started. |
| **P0** | **Fresh-device Join resolution replaces the configured cap with 64.** | Server resolver projection omits `maxPlayers` (`server/userTournamentRoutes.ts:121–138`). `configFromServerResolution()` sets `maxPlayers: 64` (`Join.tsx:536–554`); `serverJoinConfig` is preferred over URL metadata (`Join.tsx:771–773`). | The resolver contract cannot faithfully reconstruct registration configuration. Thus the visual cap and the client cache can be wrong even before considering the missing server check. |
| **P0** | **Lifecycle closure has two independent sources, but the registration route trusts only one.** | Registration POST reads `tournament_state.stateJson.status` only (`server/index.ts:630–647`). `syncStatusToServer()` posts to `/api/auth/user/tournaments` (`Director.tsx:2318–2330`) and the route updates `user_tournaments.status` separately (`userTournamentRoutes.ts:41–68`). Auto-expiry changes only the latter (`server/index.ts:2391–2429`). | `user_tournaments.status` can say completed while a state row is absent, malformed, or still registration; the registration POST permits the join in all those cases. Conversely, the Join resolver sees a mirror status but the UI does not use resolver status in `configFromServerResolution`, so early closure is delayed until live-state fetch (or not shown on failure). |
| **P0** | **The registration lifecycle control plane is not server-authorized.** State PUT, start, and end routes do not apply `requireAuth` or ownership verification. | Endpoint declarations are `app.put(...state, validate(...))` (`server/index.ts:817`), `app.post(...start)` (`:1660`), and `app.post(...end)` (`:1792`), unlike the owner-protected delete/broadcast routes. `saveStateSchema` accepts opaque `state` (`server/validation.ts:35–39`). | Any caller that can reach these routes can write a lifecycle status, start state, or end event. This can close/open registration, corrupt the lifecycle signal, and is incompatible with server-side lifecycle enforcement. |
| **P1** | **The end route does not persist terminal state.** | `POST /end` only broadcasts `tournament_ended` and responds (`server/index.ts:1787–1810`). `publishFinalTournamentState()` calls that endpoint then fires the separate user-tournament status mirror update (`Director.tsx:2332–2351`). | Terminal state depends on the independent debounced full-state save performed elsewhere. If that write fails or is stale while the mirror succeeds, the registration guard may see old/absent state. This is a lifecycle integrity gap, not a reason to rewrite completed Quads. |
| **P1** | **Malformed state JSON fails open for registration.** | The registration guard catches JSON parsing errors and explicitly continues to the upsert (`server/index.ts:637–647`). | The system has no safe fallback to a server lifecycle record. A corrupt state row does not mean registration is safely open. |
| **P1** | **Client capacity/closed checks are intentionally non-authoritative and may be stale.** | `isTournamentFull` only reads local director state (`Join.tsx:813–826`); `isTournamentClosed` prefers local state then a one-time live-state response (`:830–848`). Normal confirm does a local mutation before its authoritative POST then rolls back on rejection (`:1178–1190`); QR correctly POSTs first (`:1105–1112`). | Existing UI guards improve feedback but cannot resolve concurrent joins or lifecycle races. The normal-path ordering causes a temporary local mutation, but rollback is present; it is not the primary defect. |

## Verified behavior to preserve

1. **Quads setup invariants.** Client normalization fixes Quads at three rounds and chooses the selected rapid/blitz rating as the default section-seeding source (`client/src/lib/tournamentRegistry.ts:88–103`). The Quads engine groups by rating, generates the three-round round robin, and handles remainders with Bottom Swiss (`client/src/lib/quads.ts:179–323`). Do not alter this setup path.

2. **Server-first identity resolution.** QR links resolve with `GET /api/auth/join/resolve/:codeOrSlug` before local registry caching (`Join.tsx:612–637`), and the resolver is no-store (`userTournamentRoutes.ts:116–138`). Do not regress to a localStorage-only Join route or require public spectator visibility.

3. **Authoritative roster acknowledgement.** `postPlayerToServer()` maps `409 registration_closed`, invalid IDs, rate limits, and network failures; the QR flow waits for success before its optional local mutation (`Join.tsx:244–270`, `:1105–1123`). Retain the error vocabulary and rollback behavior in the normal confirmation route.

4. **Duplicate-registration integrity.** Database uniqueness and atomic upsert protect `(tournament_id, username)` (`shared/schema.ts:140–165`; `drizzle/0007_unique_tournament_players.sql`). Preserve the original `joinedAt` on a duplicate refresh; do not run any cleanup/backfill against historical rows.

5. **Director roster delivery.** Registration roster GET is no-store and Director has initial/visibility/SSE-open refresh plus a 5-second fallback poll (`Director.tsx:2859–2913`). Keep this reconciliation; it is independent of lifecycle enforcement.

6. **State revision conflict protection.** State persistence has monotonic revisions and compare-and-set behavior (`server/index.ts:814–902`). Any lifecycle repair must retain this conflict behavior rather than making last-writer-wins state saves.

## Narrow targeted repair sequence

1. **Make one server record the registration policy.** Add immutable-at-start registration fields needed for enforcement—at minimum `maxPlayers`; ideally include the Join projection fields currently reconstructed with defaults. Persist them when the wizard creates `user_tournaments`. Expose them from `/api/auth/join/resolve/:codeOrSlug`. For legacy rows where the new field is null, use an explicit documented fallback only for presentation and do not mass-update historical data.

2. **Enforce lifecycle and capacity transactionally in `POST /api/tournament/:id/players`.** Load the canonical tournament record and current state under a transaction/locking strategy appropriate to the deployed MySQL configuration; reject when the canonical effective lifecycle is not `registration`; count active rows and reject a new username when count is at capacity. Preserve the existing atomic username upsert semantics: an existing username may refresh profile data without consuming a new slot. Return a distinct stable `409 registration_full` error (and retain `registration_closed`). Do not use a client count as the decision source.

3. **Define a single canonical effective lifecycle and fail closed.** Either move lifecycle status wholly to `user_tournaments` or update both it and `tournament_state` together inside server lifecycle operations. The smallest compatible option is to treat `user_tournaments.status` as registration policy, use state JSON for game state only, and reject if the row is missing/terminal/invalid. A malformed or missing state must not silently reopen a non-registration tournament.

4. **Add authenticated, owner-checked lifecycle commands.** Protect state/start/end routes with the existing authentication middleware and verify `user_tournaments.userId` ownership. Replace arbitrary full-state lifecycle transitions with narrow server commands or validate allowed transitions (`registration → in_progress → completed`, with explicitly defined pause behavior). `POST /start` should atomically set canonical policy status and `startedAt` while patching state; `POST /end` should atomically persist completed state and policy status before broadcasting SSE. Keep state revision checks for general state content.

5. **Remove the asynchronous mirror race.** After server commands own start/end, do not rely on `syncStatusToServer()` as an independent fire-and-forget lifecycle authority. The client should consume command responses and continue to render its current local state optimistically. Maintain the current `user_tournaments` status endpoint only for creation/listing or turn it into an owner-checked metadata endpoint that cannot arbitrarily alter lifecycle.

6. **Use the server policy in Join display.** Extend `ServerJoinResolution` and `configFromServerResolution()` to retain `status` and `maxPlayers`. The live-state fetch may still give a real-time roster count, but must not be the sole closure gate. Treat `registration_full` and `registration_closed` from POST as decisive, preserving the current friendly recovery UI.

## Testable proof plan

| Test layer | Proof required |
|---|---|
| Server registration integration | Create a Quads event with `maxPlayers: 8`, submit eight distinct usernames, then concurrently submit two more. Assert exactly eight unique rows, one/both excess requests return `409 registration_full`, and duplicate refresh of an existing username remains idempotent without changing `joinedAt`. |
| Server lifecycle integration | For a server-created tournament, verify an unauthenticated/non-owner caller receives 401/403 for state/start/end; owner start atomically makes subsequent registration POST return `409 registration_closed`; owner end persists both terminal policy and state before SSE; no client-side local storage is involved. |
| Divergence / failure safety | Seed or mock: (a) canonical status completed plus state registration, (b) canonical registration plus state completed, (c) malformed state JSON, (d) missing state row. Assert the chosen effective-lifecycle rule is deterministic and fail-closed for every non-registration policy state. Test auto-expiry updates the same effective lifecycle seen by POST registration. |
| Join contract | Mock resolver values `status`, `maxPlayers`, and a server player count. On a fresh-device/no-localStorage render, assert the configured capacity—not 64—appears in client config and closed status disables both QR and confirm actions. Assert server `registration_full` maps to the existing full toast, and `registration_closed` maps to closed. |
| Quads regression | Use 4/8/9-player Quads fixtures. Assert a closed/full request cannot alter `quadSections`, pairing IDs, round results, standings, section membership, or stored `joinedAt` for historical players. Preserve valid 9-player Bottom Swiss setup behavior. |
| Authorization / concurrency regression | Assert the user-tournament metadata route cannot change another owner’s lifecycle status; test two simultaneous start/end attempts and stale state revisions, expecting a clear conflict rather than silent overwrite. |
| Existing suite | Re-run the focused tests below, then `tsc --noEmit`, project lint, and the complete relevant Vitest suite before release. |

## Existing automated evidence

Executed read-only from the repository root; all passed:

```text
9 files passed, 95 tests passed, 0 failures

client/src/__tests__/joinReliabilityInvariant.test.ts
client/src/__tests__/quadsConfigurationP1.test.ts
client/src/__tests__/quadsLiveStandingsIntegration.test.ts
client/src/lib/__tests__/registrationStore.test.ts
client/src/lib/__tests__/tournamentLifecycleSafety.test.ts
server/__tests__/tournamentPlayerRegistrationUniqueness.test.ts
server/__tests__/tournamentStateRevisionSafety.test.ts
server/quadsP0Fixes.test.ts
server/quadsP0SecondPass.test.ts
```

Existing coverage verifies server-first Join resolution, no-store roster recovery, client closed/full guards, duplicate uniqueness/upsert, revision conflict safety, and core Quads configuration/standings behavior. It does **not** execute a real server registration transaction against configured capacity, test lifecycle ownership/authorization, prove state-versus-user-tournament divergence behavior, or assert that end persists a terminal registration policy. Those are the highest-value additions for this repair.

## Scope and non-mutation note

The recommended repair is forward-looking and server-boundary focused. It must **not** re-seed Quads, regenerate pairings, recompute saved results, alter section membership, rewrite player timestamps, mutate `tournament_players`, or bulk-update historical `user_tournaments` / `tournament_state` records. Historical events should retain their preserved setup and results; nullable/new policy fields and explicit legacy fallbacks avoid data migration as a prerequisite for closing the live registration boundary.
