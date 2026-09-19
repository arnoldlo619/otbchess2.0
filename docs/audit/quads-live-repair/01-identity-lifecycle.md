# Quads Live Repair — Identity, Lifecycle, Public Route, Report Redirect, and Completion Notifications

**Audit ID:** `quads-live-repair/01-identity-lifecycle`  
**Audited revision:** `9267351bcc98138337f894f068723aa8cb5f8373` (2026-09-19)  
**Scope:** Tournament identity, lifecycle persistence, public route/read model, report/results redirects, exports, and completion-notification data flow.  
**Method:** Read-only source and test audit. No application source, data, database, or historical production record was changed. A safe production check queried only deliberately nonexistent URLs; `/api/public/tournament/nonexistent-quads-audit` returned `404` and the SPA returned its normal HTML shell for client routes.

## Executive finding

**Verified Quads setup is structurally sound, but its completion/read paths collapse independent sections into a single tournament in several places.** The server public snapshot correctly treats `quadSections[].standings` as authoritative and intentionally makes top-level `standings` empty. The `/live/:slug` client then ignores those nested standings and renders from the empty top-level array. Separately, every live/participant completion redirect leads to `/tournament/:id/results`, whose `FinalStandings` page computes one global Swiss-style ranking and has no Quads-section input. Manual completion also emits a stale, global notification payload before authoritative final state is persisted.

Do **not** regenerate existing Quads, repartition sections, recalculate historical records in-place, or migrate live state as part of repair. The needed changes are read-model, finalization ordering, and route/payload semantics around existing persisted `quadSections`, rounds, and results.

## Confirmed route, identity, store, cache, and API map

| Concern | Actual implementation | Evidence |
|---|---|---|
| Canonical persisted identity | `tournamentId` keys `tournamentState`, `userTournaments`, local director state, SSE, and push subscriptions. `userTournaments` additionally stores `customSlug` and `isPublic`. | `shared/schema.ts`; `server/index.ts:792-1055`; `server/userTournamentRoutes.ts:145-162` |
| Local identity/config store | Tournament configuration is held in `localStorage` registry `otb-tournaments`; director state is `otb-director-state-v3-<tournamentId>`. Unknown IDs resolve to demo state in `resolveInitialState`. | `client/src/lib/tournamentRegistry.ts`; `client/src/lib/directorState.ts:20-26, 324-342` |
| Authoritative state store | `GET/PUT /api/tournament/:id/state` reads/writes full serialized `DirectorState` in `tournament_state`, with revisions. `PUT` invalidates the public snapshot cache and emits `standings_updated`. | `server/index.ts:792-907` |
| Fresh-device live loader | `GET /api/tournament/:id/live-state` reads `tournament_state` with `Cache-Control: no-store`, returning roster, rounds, status, format, and a subset of bracket fields. It does **not** return `quadSections`. | `server/index.ts:909-968` |
| True public route | `/live/:slug` mounts `PublicTournament`; it requests `GET /api/public/tournament/:slug`. The endpoint resolves `slug` first as public `tournamentId`, then public `customSlug`. | `client/src/App.tsx:252`; `client/src/pages/PublicTournament.tsx:1503-1548`; `server/index.ts:970-1055` |
| Public snapshot/read cache | In-memory, per-`tournamentId` snapshot cache; five-minute TTL; ETag; normal state `PUT` invalidates it. The Quads contract is top-level `standings: []` plus per-section `quadSections[].standings`. | `server/publicSnapshot.ts:89-92, 307-400, 409-430`; `server/quadsP0Fixes.test.ts:226-277` |
| QR/shared spectator URL actually issued by Director | Director builds `spectatorUrl` as `${origin}/tournament/${tournamentId}`, and QR/copy/open controls use that value. It does **not** use `/live/:slug`, does not use `customSlug`, and bypasses the `isPublic`-gated snapshot route. | `client/src/pages/Director.tsx:2390-2392, 7063-7066, 7335-7352`; `client/src/components/SpectatorQRScreen.tsx:253-268, 390-423` |
| General tournament live page | `/tournament/:id` mounts `TournamentPage`; it loads local director state first, then unauthenticated `/live-state`, and subscribes to `/stream`. It is a different read model from `/live/:slug`. | `client/src/App.tsx:205`; `client/src/pages/Tournament.tsx:1182-1304` |
| Report route | `/tournament/:id/report` mounts `ReportPage`; it prefers full server `/state` over local storage and obtains `rawState.quadSections`. Its visible report implements per-section performance tabs. | `client/src/App.tsx:212`; `client/src/pages/Report.tsx:682-766, 1194-1210` |
| Final-results route | `/tournament/:id/results` mounts `FinalStandings`, which fetches `/live-state` and calls generic `computeStandings(players, completedRounds)` except for `swiss_elim`. | `client/src/App.tsx:214`; `client/src/pages/FinalStandings.tsx:408-461` |
| End event/SSE | `POST /api/tournament/:id/end` only broadcasts `tournament_ended`; it neither writes `tournament_state`, updates `userTournaments`, nor invalidates the public snapshot cache. | `server/index.ts:1787-1810` |
| Push-completion endpoint | `POST /api/push/notify/:tournamentId/tournament-complete` receives one `championName` and global `{username, rank, points}[]`; it sends a single winner narrative and a `/results` URL. | `client/src/pages/Director.tsx:2754-2766`; `server/pushRoutes.ts:265-317` |

## Verified Quads behavior worth preserving

Quads setup and server snapshot behavior should be preserved. Starting a Quads tournament pre-generates all sections and all three rounds, stores `quadSections`, sets Round 1 in progress, and blocks late registrations and withdrawals that could invalidate those fixed sections. The client Quads engine computes each section independently, including Quads-specific standings and Sonneborn–Berger data. [1][2]

The public snapshot builder is also deliberately correct: it computes each section separately, keeps top-level standings empty for Quads, and places correctly ranked rows in `quadSections[].standings`. The focused test fixture verifies two independent champions and confirms that each player’s SB is section-scoped. [3][4]

> **Invariant to retain:** A Quads tournament has no tournament-wide champion or global 1-to-N ranking. It has one or more independently ranked sections, potentially with multiple section champions.

## Confirmed defects and root causes

### 1. The Director’s QR/share URL is not the public route

The registered public route is `/live/:slug`, with server-side visibility control and `tournamentId`/`customSlug` resolution. However, Director’s `spectatorUrl` is `/tournament/:tournamentId`. That alternate page reads a separate `/live-state` API and never consumes the public snapshot or the public custom slug. This is a confirmed identity and public-route split, not a routing guess. [5][6]

**Impact:** QR recipients can land on a different data path from the intended public dashboard. They neither exercise the public visibility gate nor receive the server’s Quads section snapshot contract. Custom public slugs are never used in issued spectator links.

### 2. `/live/:slug` receives correct Quads data but discards it

The server returns `standings: []` for Quads and puts all ranked rows in `quadSections[].standings`. `PublicTournament` defines `quadSections` without a `standings` member, assigns `standings = data.standings`, and filters that empty array for every section. Its “All Sections” summaries, selected-section table, champion cards, and followed-player section ranking therefore become empty or incorrect for every public Quads tournament. [3][7][8]

**Root cause:** The client was not updated to the intentional server snapshot contract. It tries to reconstruct each section by filtering a top-level collection that the server intentionally suppresses to avoid global Quads ranking.

### 3. Completion redirects lead to a global, non-Quads results calculation

`PlayerView` redirects on `tournament_ended` to `/tournament/:id/results`; `PublicTournament` does the same; push notifications link there. `FinalStandings` fetches `/live-state` and globally calls generic `computeStandings`; the only format branch is `swiss_elim`. It has no Quads section selector or Quads calculation. `/live-state` currently omits `quadSections`, so even a client-side fix cannot know the persisted section memberships through that endpoint. [9][10][11]

**Impact:** A completed multi-section Quads tournament displays a fabricated global podium/ranks rather than one winner table per section. This contradicts the correct report route and public snapshot contract.

### 4. Manual finalization emits stale/global completion data before persistence

The manual end handler calls `completeTournament()` (a React state update), immediately derives `winner = liveStandings[0]`, immediately starts `broadcastTournamentComplete(winnerName)`, and only then calls `publishFinalTournamentState()`. `liveStandings` for Quads is a flattened sequence ordered by section order then section rank; therefore index zero means “first configured section’s leader,” not a tournament champion. The push payload assigns synthetic global `idx + 1` ranks across that flattened array. [12][13]

The final publish function posts only `{ players: state.players, tournamentName }` to `/end`. Because React has not synchronously committed `completeTournament()`, it can send the pre-final closure state. More importantly, the server `/end` endpoint does no persistence or cache invalidation. The eventual 1.5-second state autosave is not awaited. Thus final readers and cache invalidation can race completion, and SSE gets a payload that may predate the final state. [12][14][15]

**Impact:** Notifications can name only Quad 1’s leader as universal champion, personalized ranks are global rather than section ranks, and recipients are sent to the globally calculated `/results` page. The final snapshot can remain stale until an unrelated/debounced state write succeeds.

### 5. The Quads completion/achievement/recap engine is disconnected from production finalization

`server/quadsCompletion.ts` exports prize templates, winner assignment, achievement detection, and recap generation. Repository references are its own tests, a client integration test, and a UI component that mirrors types; no production lifecycle route imports or invokes these functions. Schema tables exist for `quadPrizes`, `playerAchievements`, and `tournamentRecaps`, and generic recap/achievement endpoints exist, but finalization does not call them. [16]

**Impact:** If completion notifications are expected to reflect persisted Quads awards, achievements, or recap data, they cannot: those records are never derived in the actual completion flow. This is a disconnection, not evidence that historical awards are wrong.

### 6. Related exports still create global Quads output

The report’s on-screen section tabs are Quads-aware, but its PDF handler passes no `format` or section inputs to `generateResultsPdf`. The PDF generator globally sorts players with `getStandings(players)` and renders one cross-table. The Print page similarly computes `computeStandings(players, rounds)` globally and never consumes `quadSections`, even though it changes the header from Buchholz to SB when `isQuads` is true. [17][18][19]

**Impact:** Exported/printed Quads final standings can imply one global order. This is outside the immediate redirect repair but is directly related and should be fixed in the same section-aware read-model workstream.

## Lifecycle trace

1. A tournament is identified internally by `tournamentId`; public identity can additionally be `customSlug` in `userTournaments` when `isPublic=1`.
2. Director local state is hydrated from `otb-director-state-v3-<id>` and then conditionally from server `/state`. State changes save locally after 300 ms and server-side after 1.5 seconds using revisions. [14]
3. Quads start generates the fixed sections and all three round schedules. The Director then sends `/start`, which patches server state quickly for initial player catch-up. [2][20]
4. Normal persisted state `PUT` invalidates the public snapshot cache; `/live/:slug` next builds a section-scoped snapshot and uses ETag polling every 15 seconds. [3][6][8]
5. On manual completion, the current code marks local state complete, begins push and club-feed work from the pre-update render, calls non-persisting `/end`, and sends the director to `/overview`. Client/participant recipients receive SSE and redirect to `/results`; visitors on `/tournament/:id` redirect to `/report` after a status update, if their live-state view sees it. [9][12][15]

## Narrow, safe repair sequence

1. **Make one public URL builder authoritative.** Resolve the public slug from the persisted metadata (`customSlug ?? tournamentId`) and make Director QR/share controls issue `/live/<encoded-slug>`. Keep `/tournament/:id` for participant/general live use; do not reinterpret or rewrite existing tournament IDs.

2. **Consume the existing snapshot contract in `PublicTournament`.** Extend the public section type to include `standings`. For Quads, take selected-section rows directly from `section.standings`, use those rows for all-section champions and followed-player recap, and retain `data.standings` only for non-Quads. Do not re-enable a global top-level Quads array.

3. **Make final results section-aware.** Add the persisted `quadSections` to the `live-state` response (or use a dedicated completed read model that returns the identical contract). In `FinalStandings`, branch on `format === "quads"`: show independent section champions/tables and no global podium. The redirect URL can remain `/tournament/:id/results` if that route’s data model is corrected; use the same route for push/SSE only after correction.

4. **Replace fire-and-forget finalization with an authoritative finalization transaction/action.** The action should receive a complete final state and revision, persist `status: completed`, mark rounds/sections completed, atomically update tournament status metadata, invalidate the snapshot, and return canonical final section outcomes. Emit `tournament_ended` only after success. This can be an evolved authenticated `/end` endpoint or a server-owned lifecycle service; it must not mutate/rebuild old tournament history beyond the explicit host finalization action.

5. **Build notification payloads from final section outcomes.** For Quads include `{sectionId, sectionName, sectionRank, points}` per recipient and the section champion(s), rather than `liveStandings[0]` and flattened index ranks. Copy should say “your section” and identify the relevant section champion; generic formats can retain their single-champion payload. Dispatch push only after authoritative finalization succeeds.

6. **Connect optional Quads completion artifacts deliberately.** If prizes, achievements, and recaps are product requirements, invoke `quadsCompletion` after final state is persisted using the returned section outcomes and persist idempotently by tournament/section. Otherwise remove completion claims from UI; do not backfill historical records in this repair.

7. **Follow with section-aware export rendering.** Pass format and section outcomes to report/PDF/Print. Render one standings table/cross-table per section (or a clearly labeled section selector), never a combined medal podium. Preserve existing non-Quads PDF behavior.

## Testable proof plan

| Proof | Setup and assertion |
|---|---|
| Public identity | Create one public Quads tournament with `tournamentId` different from `customSlug`. Assert QR/copy/open use `/live/<customSlug>`; `/api/public/tournament/<customSlug>` and `<id>` resolve the same immutable ID; a private tournament’s `/live` endpoint is `404`. |
| Public snapshot rendering | Fixture: two four-player Quads with distinct champions. Assert server top-level `standings` is `[]`, each `quadSections[i].standings` has four rows, and `/live/:slug` renders both champions, selected section standings, scores, SB, and followed-player rank. |
| Result redirect | Feed `tournament_ended` SSE to PlayerView and PublicTournament. Assert navigation to corrected `/results`; assert it renders two section champion cards/tables and **no** tournament-wide first/second/third podium. |
| Finalization order | Intercept requests and assert final persistence completes, returns a new revision, and invalidates/rebuilds the public ETag before `/end` SSE/push dispatch. Reconnect a fresh device immediately after completion and assert `live-state.status === completed`, all final rounds/results are present, and public snapshot is completed. |
| Notification semantics | Subscribe one player in each section. On a two-section Quads tie/co-champion fixture, assert both recipients get their section rank and section winner/co-winner wording; assert no message calls only Quad 1’s leader “the tournament champion.” Assert action URL renders the section-aware final view. |
| Report and exports | Assert `/report?section=<id>` retains current correct section ranks. Add PDF/Print fixture tests that verify each Quads section is separate, SB is shown from Quads results, and no global Quads podium/rank is emitted. |
| Non-regression | Run existing Quads generation/setup, section-isolation, public snapshot, report accuracy, and lifecycle tests. Then add route/SSE/finalization integration tests listed above. Verify no historical records are changed as part of deployment. |

## Existing automated evidence

The following focused, non-mutating test invocation passed on the audited revision:

```text
./node_modules/.bin/vitest run \
  client/src/lib/quads.test.ts \
  client/src/__tests__/quadsLiveStandingsIntegration.test.ts \
  client/src/__tests__/quadsSectionAwarenessP0.test.ts \
  client/src/__tests__/publicSnapshotHardening.test.ts \
  server/quadsP0Fixes.test.ts \
  server/quadsP0SecondPass.test.ts \
  server/quadsCompletion.test.ts \
  client/src/__tests__/finalStandings.test.ts \
  client/src/__tests__/reportAccuracy.test.ts --reporter=dot

Test Files  9 passed (9)
Tests       182 passed (182)
```

The passing suite establishes Quads generation, SB/section snapshot behavior, helper behavior, and portions of report/PDF formatting. It does **not** exercise a real Quads completion event across Director finalization → state persistence/cache invalidation → SSE → `/results` → push payload. In particular, `finalStandings.test.ts` is generic Swiss tiebreak coverage, and no test was found for Quads `/results`, Director QR routing to `/live`, Quads completion payload semantics, or section-aware PDF/Print output.

## Key source files

- `client/src/App.tsx`
- `client/src/lib/tournamentRegistry.ts`
- `client/src/lib/directorState.ts`
- `client/src/lib/quads.ts`
- `client/src/pages/Director.tsx`
- `client/src/pages/Tournament.tsx`
- `client/src/pages/PublicTournament.tsx`
- `client/src/pages/PlayerView.tsx`
- `client/src/pages/FinalStandings.tsx`
- `client/src/pages/Report.tsx`
- `client/src/pages/Print.tsx`
- `client/src/lib/generateResultsPdf.ts`
- `client/src/components/SpectatorQRScreen.tsx`
- `server/index.ts`
- `server/publicSnapshot.ts`
- `server/pushRoutes.ts`
- `server/quadsCompletion.ts`
- `shared/schema.ts`

## References

[1]: `client/src/lib/directorState.ts:644-694, 981-998`  
[2]: `client/src/lib/directorState.ts:463-479, 591-618`  
[3]: `server/publicSnapshot.ts:307-400`  
[4]: `server/quadsP0Fixes.test.ts:168-277`  
[5]: `client/src/App.tsx:203-215, 252-253`  
[6]: `server/index.ts:970-1055`; `client/src/pages/PublicTournament.tsx:1503-1569`  
[7]: `client/src/pages/PublicTournament.tsx:54-68, 1597-1627, 1856-1928`  
[8]: `server/publicSnapshot.ts:58-80, 343-387`  
[9]: `client/src/pages/PlayerView.tsx:1676-1684`; `client/src/pages/PublicTournament.tsx:1550-1569`; `server/pushRoutes.ts:305-310`  
[10]: `client/src/pages/FinalStandings.tsx:408-461`  
[11]: `server/index.ts:909-968`  
[12]: `client/src/pages/Director.tsx:7210-7251, 2754-2766`  
[13]: `client/src/lib/directorState.ts:123-161`  
[14]: `client/src/lib/directorState.ts:345-426`  
[15]: `server/index.ts:1787-1810`  
[16]: `server/quadsCompletion.ts`; `shared/schema.ts:2575-2667`; `server/index.ts:2205-2368`  
[17]: `client/src/pages/Report.tsx:913-930`; `client/src/lib/generateResultsPdf.ts:529-724`  
[18]: `client/src/pages/Print.tsx:571-650, 654-717`  
[19]: `client/src/__tests__/reportAccuracy.test.ts:43-65`  
[20]: `server/index.ts:1655-1729`
