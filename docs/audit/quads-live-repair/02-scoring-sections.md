# Quads Live Repair Audit — Scoring, Sections, Standings, and Exports

**Audit ID:** `quads-live-repair/02-scoring-sections`  
**Scope:** Quads sections, canonical scores, games, standings, tie-breaks, report/export, and director/public calculations.  
**Method:** Read-only source/test audit and a read-only local preview request. No application code, production data, database state, or historical record was changed.

## Executive finding

The repository has a **working Quads setup and director-side canonical engine**, but there are **four confirmed divergent presentation/calculation paths** plus one live-publication timing defect. The most urgent failure is the public route: the server correctly returns Quads standings inside `quadSections[].standings` and intentionally leaves top-level `standings` empty, while the public client discards the nested standings and renders only the empty top-level list. Consequently, a valid public Quads snapshot yields empty section tables/champions/followed-player standing data.

The other confirmed defects are confined to consumers that substitute Swiss/global logic for Quads: final standings, report ranking/performance ranks, generic PDF export, and one director completion banner/notification path. Repair these readers and projections; **do not regenerate sections, recompute or overwrite saved results, or change the established Quads generation workflow.**

## Actual route, loader, store, cache, and calculation map

| Surface | Route / endpoint | Loader or store | Current Quads calculation / contract |
|---|---|---|---|
| Director | `/tournament/:id/manage` | `useDirectorState()` in `client/src/lib/directorState.ts`; local key `otb-director-state-v3-${id}`; hydrates `GET /api/tournament/:id/state`, then debounced `PUT` | `computeTournamentLiveStandings()` dispatches Quads to `calculateQuadStandings()` section by section. This is the correct in-client live path. |
| Participant tournament | `/tournament/:id` | Director-derived tournament state | Existing integration test verifies it uses `computeTournamentLiveStandings()` and displays SB rather than Buchholz for Quads. |
| Public live page | `/live/:slug` | `PublicTournament.tsx` fetches `GET /api/public/tournament/:slug`, retains ETag, polls every 15 seconds | Server snapshot intentionally sets top-level Quads `standings: []`; authoritative rows are `quadSections[].standings`. Client currently reads the empty top-level array instead. |
| Final results | `/tournament/:id/results` | `FinalStandings.tsx` fetches `GET /api/tournament/:id/live-state` | Unconditionally calls Swiss `computeStandings(players, completedRounds)` except `swiss_elim`; no Quads section contract is returned or consumed. |
| Report | `/tournament/:id/report` | Prefers `GET /api/tournament/:id/state`; falls back to `loadTournamentState()` | It identifies Quads and filters sections, but `computeQuadSectionPerformances()` delegates ranking to Swiss `computeStandings()`, not the configured Quads engine. |
| Public snapshot/cache | `GET /api/public/tournament/:slug` | SQL `tournamentState.stateJson`/revision → in-memory `Map` in `publicSnapshot.ts`; ETag; five-minute TTL | `PUT /api/tournament/:id/state` invalidates cache. Snapshot builds section rows, but ranks them `points → SB → Elo`, not Quads' configured ordering. |
| Generic PDF | Director and Report actions call `generateResultsPdf()` | `generateResultsPdf.ts` | Both callers omit `format`; generator always uses `getStandings(players)` for a single global table and global cross-table. |

The persisted server source of truth is the full serialized `DirectorState` in `tournamentState`, with optimistic `revision` checking in `server/index.ts:814–907`. The browser store is a fallback/working copy, not a reason to mutate the persisted historical record during this repair.

## Canonical behavior that is already verified and must be preserved

`client/src/lib/quads.ts` is the established Quads engine. `generateQuadTournament()` creates fixed three-round sections and pairings; `calculateQuadStandings()` filters each section's completed games and computes score with integer half-points, W/D/L, black games, direct encounter, and Sonneborn-Berger. Its default tie-break order is **score → direct encounter → SB → wins → black games → rating** (`quads.ts:93–108`, `:498–587`, `:663–720`). Persisted `quadSettings.tiebreakOrder` can alter that order.

The protected setup behavior is also already present: Quads creation normalizes to three rounds and persists the rapid/blitz seeding choice (`quadsConfigurationP1.test.ts`); late registration is blocked because paths are pre-generated (`directorState.ts:463–479`); active withdrawals are blocked for Quads (`:591–617`); and swapping section players is blocked after results exist (`:1124–1141`). These mechanics are **not repair targets**.

## Confirmed defects and root causes

| Priority | Confirmed defect | Code evidence and root cause | Narrow repair boundary |
|---|---|---|---|
| P0 | **Public Quads standings are empty despite the server computing them.** | `buildSnapshot()` intentionally makes top-level `standings = []` for Quads and emits populated `quadSections[].standings` (`server/publicSnapshot.ts:317–346`, `:363–397`). `PublicTournamentData` declares sections with only IDs/names/player IDs, then `PublicTournament.tsx` uses `data.standings` and filters it for all selected-section, all-section, completed-champion, and followed-player views (`:1597–1627`, `:1858–1928`). | Extend the public client type to retain nested section standings. For Quads, every public section/champion/followed-player display must read `quadSections[].standings`, never filter top-level `standings`. Keep top-level Quads standings empty. |
| P0 | **Public server ranks Quads with a reduced, hard-coded tie-break that differs from canonical configuration.** | Snapshot rows are sorted `points → SB → Elo` (`publicSnapshot.ts:241–247`, `:374–380`), while canonical defaults apply direct encounter before SB and permit settings to change all ordering. `BuildSnapshotInput` and the public route do not pass `quadSettings`. | Pass persisted `quadSettings` into the snapshot projection and reuse a shared, read-only canonical Quads row/order adapter (or explicitly mirror it with tests). Preserve only public-safe fields; do not modify saved games, sections, or results. |
| P0 | **Final Standings gives Quads a global Swiss final table, a global podium, and Buchholz labels.** | `/results` calls `GET /live-state`; that response omits `quadSections` (`server/index.ts:925–963`). `FinalStandings.tsx` calls Swiss `computeStandings()` for every non-`swiss_elim` format (`:439–447`), then renders one top-three podium and `Pts → Bch → Bch1 → SB → Rating` (`:511–512`, `:708–744`). | Add a Quads branch that receives/uses the persisted section membership and canonical section rows. Render independent section champions/tables and omit Swiss Buchholz/BC1 copy and columns. Do not alter Swiss or Swiss-elimination behavior. |
| P1 | **Report section filtering does not use Quads tie-breaks.** | The report does correctly load authoritative server state (`Report.tsx:687–711`) and scope games/players by section. However, `computeQuadSectionPerformances()` calls `computeAllPerformances()`, which calls Swiss `computeStandings()` (`performanceStats.ts:197–205`, `:361–381`); it ignores `rawState.quadSettings`. Thus report ranks, champion badges, and rank-dependent performance labels use `Pts → Buchholz → BC1 → SB → Elo`, rather than configured Quads ordering. | Make the Quads performance path consume canonical section rows/ranks and pass persisted settings. Retain its useful section game filtering and existing non-Quads `computeAllPerformances()` behavior. |
| P1 | **Director completion presentation can falsely label score ties as co-champions and can announce one global Quads winner.** | The completion banner starts from generic `getStandings(state.players)` (`Director.tsx:4700–4713`), whose order is `points → buchholz → Elo` (`tournamentData.ts:213–219`), and treats every same-score section player as a co-champion. Separately, the general manual completion flow takes `liveStandings[0]` for broadcast/club winner data (`Director.tsx:7212–7222`). Quads live standings are concatenated section rows, so item zero is not an event-wide champion. | Use `calculateQuadStandings()`/`getSectionWinners()` with persisted settings for each section and publish a section-champion payload/list. Do not introduce a global Quads winner except where a product rule explicitly defines one. |
| P1 | **Results PDF is a global generic export, not a Quads section export.** | Both Report and Director call `generateResultsPdf()` without `format` or sections (`Report.tsx:913–927`, `Director.tsx:6816–6829`). The generator calls `getStandings(players)` for one standings table and one all-player cross-table (`generateResultsPdf.ts:592–598`, `:657–712`). The missing `format` incidentally suppresses Buchholz in the header, but does not repair global ranks/order. | Extend PDF options with format and canonical section projection. For Quads, export separate ordered section standings/cross-tables (or an explicit selected-section export); retain the existing PDF path for all non-Quads formats. |
| P1 | **Immediate post-result public update is rejected for existing tournaments.** | `Director.pushStandingsNow()` sends `PUT /state` without `baseRevision` (`Director.tsx:2303–2314`). The server intentionally returns 409 when an existing row has no `baseRevision` (`server/index.ts:839–849`). Therefore its claimed immediate cache invalidation/SSE update fails silently; the store's separate 1.5-second revision-aware save is the eventual publisher (`directorState.ts:395–426`). | Expose/use a revision-aware immediate flush from `useDirectorState`, or remove the competing direct write. Preserve server optimistic concurrency; do not weaken revision checks or bypass historical conflict protection. |

## Test evidence and coverage gaps

The following focused tests were run read-only and passed: **9 files, 164 tests, 0 failures**.

```text
client/src/lib/quads.test.ts
client/src/lib/quads-integration.test.ts
client/src/__tests__/quadsLiveStandingsIntegration.test.ts
client/src/__tests__/quadsSectionAwarenessP0.test.ts
client/src/__tests__/quadsConfigurationP1.test.ts
client/src/__tests__/reportAccuracy.test.ts
server/quadsP0Fixes.test.ts
server/quadsP0SecondPass.test.ts
server/quadsCompletion.test.ts
```

Existing tests prove setup normalization, canonical director live rows, per-section server construction/isolation, SB examples, removal of Buchholz from a PDF *when a Quads format is supplied*, and some report/public source wiring. They do **not** cover the end-to-end contract mismatch where a real Quads public snapshot has `standings: []` and populated `quadSections[].standings`; the public client code path therefore remains untested. `finalStandings.test.ts` tests only Swiss `computeStandings()`, and `publicSnapshotHardening.test.ts` exercises Swiss snapshots only.

A read-only local probe of `GET http://127.0.0.1:3000/api/public/tournament/otb-demo-2026` returned `404 {"error":"not_found"}` because the demo is not a public persisted event. No public production event was queried and no preview state was changed.

## Targeted verification plan

1. **Canonical projection unit tests.** Use an eight-player/two-section fixture with a score tie resolved by direct encounter before SB. Assert every consumer projection equals `calculateQuadStandings(section, games, players, persistedSettings)`, preserves `orderIndex`, and has no global Quads rank. Repeat with a non-default tie-break order and a legacy missing-settings fallback.
2. **Public snapshot contract tests.** Assert Quads snapshots retain top-level `standings: []`, contain complete ordered `quadSections[].standings`, and invalidate/rebuild after a revision-valid state save. Render `PublicTournament` from this exact contract and assert All Sections, selected section, completed champion, and followed-player rank are non-empty and use nested rows.
3. **Final/results and director tests.** Mock `/live-state` (or a Quads-specific response contract) with two sections. Assert no global podium, no Buchholz/BC1 labels, one canonical champion set per section, and that a score tie resolved by configured tie-break is not shown as co-champions. Assert final notifications/club payloads carry section champions rather than `liveStandings[0]` as a global winner.
4. **Report and export tests.** Assert report ranks, badges, cards, selected section, and All Sections use canonical Quads rows. Add PDF data/layout tests requiring section headings and independent section tables/cross-tables; prohibit a global Quads ranks table. Verify both Report and Director pass format and projection inputs.
5. **Publication test.** With an existing revisioned state, enter a result and assert the immediate path sends the current `baseRevision`, receives a new revision, invalidates the snapshot cache, and emits the live update. Retain a 409 conflict test.
6. **Regression gate.** Run the focused suite above plus `client/src/__tests__/finalStandings.test.ts`, `client/src/__tests__/publicSnapshotHardening.test.ts`, new contract tests, `pnpm test`, `pnpm check`, and the project lint command before release.

## Safety boundary

The recommended changes are **read/projection/export changes only**. They must consume persisted sections, games, result history, and `quadSettings` as-is. Do not rerun `generateQuadTournament()`, reshuffle membership, rewrite `stateJson`, backfill historical records, or modify completed results as part of the live repair.
