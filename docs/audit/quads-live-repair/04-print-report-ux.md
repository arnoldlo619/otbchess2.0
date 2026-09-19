# Quads Live Repair Audit — Print, Report, Export, and Section UX

**Audit ID:** `04-print-report-ux`  
**Method:** Read-only source and focused regression-test audit. No application code, configuration, tournament state, caches, or production records were changed.

## Executive finding

The verified Quads setup and director lifecycle are largely intact: Quads are normalized to three rounds; sections and all round-robin pairings are generated before play; the director’s live standings use `calculateQuadStandings`; and public snapshots deliberately model Quads as **independent sections**, not a global standings table. The repair is therefore a **read-model/presentation and export repair**, not a setup or historical-data migration.

The primary defect is that several downstream readers still either discard the section projection or recompute Quads through Swiss-oriented functions. This produces a material failure on the Print route for a fresh/public device, an empty Quads public standings presentation, and global/misranked report exports. The underlying cause is duplication of standings projections rather than a single section-aware Quads presentation model.

## Actual routes, loaders, stores, caches, and calculations

| Surface | Actual route / loader | Storage or cache | Quads calculation actually used |
|---|---|---|---|
| Print | Client route `/tournament/:id/print` in `client/src/App.tsx:208`; `Print.tsx` reads local `loadTournamentState()` and `getTournamentConfig()`, then only if no local state requests `GET /api/public/tournament/:slug` | Local `otb-director-state-v3-<id>` and local registry; public snapshot cache on fallback | **Incorrect in Print:** `computeStandings()` in `Print.tsx:397`, `:572`, `:1129` even for Quads tables/guidance |
| Report | Client route `/tournament/:id/report` in `client/src/App.tsx:212`; local state then `GET /api/tournament/:id/state` | Same local state; server persisted `tournamentState` is preferred after fetch | Quads cards are section-filtered, but `computeQuadSectionPerformances()` internally calls Swiss `computeStandings()` (`performanceStats.ts:381`) |
| Public live presentation | Client route `/live/:slug` in `client/src/App.tsx:252`; `GET /api/public/tournament/:slug`, then 15-second ETag polling | `server/publicSnapshot.ts` in-memory cache: five-minute safety TTL, `Cache-Control: public, max-age=5`, invalidated by `PUT /api/tournament/:id/state` | Server creates `quadSections[].standings` and intentionally sets top-level `standings: []` for Quads (`publicSnapshot.ts:343–346`) |
| Director live standings | Director state helpers and Quads director panel | Persisted local state plus debounced server state save | Correct section-local `calculateQuadStandings()` through `computeTournamentLiveStandings()` (`directorState.ts:123–161`) |
| PDF / email attachment | Report’s PDF action and `ShareResultsModal` dynamically call `generateResultsPdf()` / `generateResultsPdfBuffer()` | Browser-generated PDF; optional SMTP attachment | **Incorrect hierarchy:** `generateResultsPdf.ts` calls global `getStandings(players)`; Report and sharing calls do not pass `format` or Quads section data |

The server state write is revision-protected and invalidates the public snapshot only after a successful save (`server/index.ts:817–902`). The public snapshot endpoint obtains the persisted state, includes `quadSections`, and sends ETags (`server/index.ts:975–1050`). The audit did not probe an unspecified production/public Quads slug; the route contract and cache behavior above are confirmed from the implementation.

## Confirmed defects and root causes

| Priority | Confirmed behavior | Evidence and root cause | Narrow repair boundary |
|---|---|---|---|
| **P0** | **A public/fresh-device Print route loses Quads section awareness.** It falls back to generic/global Print standings and Swiss copy even though the API response contains Quads sections. | `Print.tsx:675–689` narrows the fetched response to players/rounds/basic metadata and drops `quadSections` and `quadSettings`. Every Quads branch then requires **both** `realConfig` and `realState` (`:1070`, `:1076`), which only exist on a device holding director localStorage. The server snapshot does include nested `quadSections` and section standings (`publicSnapshot.ts:363–397`). | Extend the Print fallback response type/state to retain `quadSections` (and needed Quads settings), derive `isQuads` from the effective state’s `format`, and render section data from the snapshot when local director state is absent. Do not alter saved state or generated pairings. |
| **P0** | **Print’s local Quads section tables use Swiss ranking, while labeling the last column “SB.”** In ties, the displayed order can differ from the director’s Quads order. | `StandingsTable` always calls `computeStandings()` (`Print.tsx:571–572`). The Quads branch only filters games/players and sets `isQuads`, which changes a header and displayed last column (`:586`, `:644`); it does not change sorting. Swiss sorting is points → Buchholz → Buchholz Cut-1 → SB → rating (`swiss.ts:247–255`). The Quads engine is points → configured direct encounter → SB → wins → black games → rating (`quads.ts:674–720`). | Give the Print section table precomputed Quads standing rows, or make it explicitly select `calculateQuadStandings(section, games, players, tiebreakOrder)`. Preserve `computeStandings()` unchanged for non-Quads formats. |
| **P0** | **The public live Quads view receives no usable standings despite the server preparing them.** “All Sections,” selected section standings, completed champions, and followed-player rank all read the empty top-level array. | Server contract intentionally sets `snapshot.standings = []` for Quads and emits `quadSections[].standings` (`publicSnapshot.ts:343–346`, `:363–387`). `PublicTournamentData` omits nested `standings` from its `quadSections` type (`PublicTournament.tsx:54–68`), then `standings = data?.standings ?? []` (`:1597–1600`). Subsequent section filtering consistently filters that empty array (`:1604–1627`, `:1858–1918`); completed champions also filter the empty array (`:851–864`). | Update the public client contract to retain and consume `quadSections[].standings` directly. Do not restore a global Quads standings array: the server’s empty-global contract is correct and tested. |
| **P0** | **Report cards and report-derived exports can rank Quads with Swiss tiebreak order.** The report is section-filtered visually, but tie ordering is not the Quads engine’s order. | `computeQuadSectionPerformances()` filters each section, then calls `computeAllPerformances()` (`performanceStats.ts:361–381`), which calls Swiss `computeStandings()` (`:197–205`). Thus direct encounter and configured Quads tiebreak order are absent. This can change champion/podium/card rank in tied sections. | Keep the performance-statistics enrichment, but inject section-local ranks/scores/WDL/SB from the Quads engine before badges, champion cards, and exports are built. Thread `quadSettings.tiebreakOrder` from `DirectorState`; do not change existing tournament results. |
| **P0** | **PDF and email exports flatten Quads into a single global final standings/cross-table.** They also omit the `format` argument, so the exporter cannot make an informed format-specific decision. | Report passes only `players` and `rounds` at `Report.tsx:918–927`; sharing does the same at `ShareResultsModal.tsx:643–650`. The PDF defaults `format = ""` and sorts all players with legacy global `getStandings(players)` (`generateResultsPdf.ts:537–548`, `:592–593`; legacy sort is points → Buchholz → ELO in `tournamentData.ts:213–218`). Passing `format` alone is insufficient: the current PDF accepts no sections and emits one “Final Standings” table and one global cross-table. | Add a Quads-specific PDF input/projection with ordered sections and section standings. Render one clearly headed standings/cross-table block per Quad (and Bottom Swiss) with section-local ranks; retain the present PDF implementation byte-for-byte in behavior for non-Quads. Pass format and section projection through both Report and SMTP attachment paths. |
| **P1** | **Server snapshot tiebreak order is not equivalent to the Quads engine for tied scores.** It skips direct encounter/configured ordering and uses SB then ELO. | Public snapshot section sorting is points → SB → ELO (`publicSnapshot.ts:374–380`); `computeStandingsServer()` uses the same sequence (`:241–247`). The canonical Quads engine contains direct encounter, wins, black games, and configurable order (`quads.ts:93–108`, `:674–720`). Existing server tests use mostly unique-point fixtures, so this divergence is not exercised. | Extract/share one deterministic Quads standings projection usable by director, public snapshot, Print, Report, and export. Persisted `quadSettings.tiebreakOrder` must be an input; retain default behavior for historical states missing settings. |
| **P1** | **Report “Download all” and Share Results do not share the active Quads section scope.** A section view renders section-scoped cards but bulk export/share starts from global Swiss-derived `performances`. | Display uses `displayPerformances` (`Report.tsx:762–766`), but bulk download closes over `performances` (`:937–953`) and `ShareResultsModal` receives `performances` (`:1535–1549`). When a section is selected, only that section’s card refs are mounted, so the action’s “all” wording/count and its actual exported set can diverge; sharing ranks remain global. | Define an explicit export scope: **all sections** exports all section cards/sections; a selected section exports only that section and labels it as such. Feed the same canonical section projection to email bodies, QR/report links, and PDF attachment. |
| **P1** | **The Print route is not responsive/semantically accessible enough for its section controls and tables.** It also prints only the currently selected section. | Print tabs are generic buttons inside a `w-fit` flex container with no `role="tablist"`, `role="tab"`, selected state, controls, keyboard behavior, or horizontal overflow (`Print.tsx:902–922`). The 8-column standings table has no screen overflow wrapper (`:580–650`), unlike the wall chart. Conditional rendering means `window.print()` prints only `activeSection` (`:924–1143`); this is especially problematic because Quads have no Print-specific section navigator/grouping. | Use an accessible tablist or ordinary section navigation with an explicit “Print this section / Print all sections” control. Make screen tables horizontally scrollable with a visible cue or use a mobile card presentation; preserve semantic table captions/headers. Print all Quads sections in stable `orderIndex` order when “all” is chosen. |
| **P1** | **Print’s Quads tiebreak guide is Swiss-derived.** | The guide branch unconditionally calls `computeStandings()` (`Print.tsx:1127–1137`). It therefore supplies Buchholz-oriented rows/treatment while Quads copy elsewhere says direct encounter then SB. | Hide the Swiss guide in Quads or replace it with a concise Quads section-tiebreak guide based on the same configured order. |

## Verified behavior to preserve

1. **Quads configuration invariants:** `normalizeTournamentConfig()` fixes Quads to three rounds and defaults seeding to the selected rapid/blitz source (`tournamentRegistry.ts:88–103`).
2. **Generation and integrity:** the director generates all Quads sections and all three rounds at tournament start (`directorState.ts:651–669`); the pairing engine validates four-player round robins and section assignment (`quads.ts:729–779`, `:786–895`).
3. **Section-local live standings:** director live standings already call `calculateQuadStandings()` and zero Swiss Buchholz fields (`directorState.ts:123–161`).
4. **Public server hierarchy intent:** public snapshots correctly avoid a global Quads rank and provide per-section standings. This must be consumed, not replaced (`publicSnapshot.ts:343–397`).
5. **Historical integrity protections:** Quads disallow late registration and active withdrawal after the prebuilt paths are generated (`directorState.ts:475–478`, `:591–617`). The repair must not regenerate sections, rewrite results, or backfill historical records.

## Targeted implementation sequence

1. **Introduce a canonical read-only Quads presentation projection.** It should accept `players`, `rounds`, `quadSections`, and optional persisted `quadSettings`, sort sections by `orderIndex`, calculate the configured Quads tiebreak order, and return section rows plus grouped rounds/games. Place it in shared code usable by the server and client, or make the server snapshot the sole canonical projection and have client readers consume it. Do not change `generateQuadTournament`, section membership, or result history.

2. **Repair public and Print data contracts first.** Expand public nested-section types to include standings. In Print, retain the snapshot’s sections and derive format/Quads behavior from the effective (local-or-server) state rather than only the local registry. Use explicit loading/error states already present; do not silently fall back to a global Quads table.

3. **Replace Swiss-derived Quads tables and report ranks.** Feed canonical Quads rows to Print, report card ranking/badges, public completed champions, followed-player rank, and all section views. Keep existing Swiss calculations untouched behind the non-Quads branch.

4. **Make exports section-aware.** Add a Quads PDF layout containing a tournament summary followed by one independent section per standings/cross-table block. Pass `format`, section projection, and selected/all scope from both Report export actions and `ShareResultsModal`. Update email text to say section/rank/SB (where applicable), not Buchholz.

5. **Complete presentation/accessibility behavior.** Group Print slips by Quad, label each section’s standings and cross-table, add explicit per-section/all print scope, and make screen navigation keyboard-operable and small-screen scroll-safe. Keep print rendering black-on-white and current non-Quads tabs/layout intact.

## Testable proof plan

| Test layer | Proof required |
|---|---|
| Unit — canonical projection | Use an 8-player/two-section fixture with a tied-score case where direct encounter differs from Buchholz/SB. Assert the projection matches `calculateQuadStandings()` for every section, preserves `orderIndex`, carries SB/WDL, and never gives a global Quads rank. Test configured non-default tiebreak order and legacy missing settings fallback. |
| Server snapshot | Assert `quadSections[].standings` uses the canonical order, top-level Quads `standings` remains empty, and cache invalidation after a state save returns updated section rows. Preserve current tests for section isolation and ninth-player exclusion. |
| Print integration | Mock an empty-localStorage device plus `GET /api/public/tournament/:slug` response containing Quads sections. Assert section headings/standings render, Swiss/Buchholz copy does not render, and output ranks match the canonical fixture. Repeat for local director state. |
| Report/export | Assert active-section cards, bulk card download target set, Share Results recipients/ranks, PDF options, and email attachment use the same selected/all section scope. Add PDF data tests that require separate section headings and prohibit a single global Quads standings table/cross-table. |
| Public UI | Render the server snapshot contract directly. Assert all-sections summaries, selected section rows, completed champions, and followed-player rank read `quadSections[].standings`, including a tied fixture. |
| Accessibility/responsive | At 320px and 375px, assert Print section navigation remains reachable (scrollable or wrapped), uses valid tab semantics if tabs are retained, and the standings table/card view has no clipped columns. Keyboard-test arrow/Home/End behavior for tablists and verify an explicit Print All Sections path prints all Quads in order. |
| Regression | Run the focused existing suite below plus the new tests; run `tsc --noEmit`, project lint, and the full relevant Vitest suite before release. |

## Existing automated evidence

The focused suite was executed without edits and passed: **8 files, 103 tests, 0 failures**.

```text
client/src/__tests__/quadsLiveStandingsIntegration.test.ts
client/src/__tests__/quadsSectionAwarenessP0.test.ts
client/src/__tests__/quadsMobileAccessibilityP2.test.ts
client/src/__tests__/quadsConfigurationP1.test.ts
client/src/__tests__/bracketPrintSection.test.ts
server/quadsP0Fixes.test.ts
server/quadsP0SecondPass.test.ts
server/quadsCompletion.test.ts
```

These tests verify generation, setup invariants, section isolation in the **server** snapshot, Quads live standings in director code, and selected mobile semantics. They do **not** mount the public client against the intentional `standings: []` Quads snapshot contract, exercise Print’s no-local-state fallback, compare Print/Report ranks against direct encounter, or test Quads PDF/email export hierarchy. Those are the high-value regression tests needed for this repair.

## Scope and non-mutation note

This report deliberately recommends **read-path-only** changes. It does not recommend re-seeding, re-pairing, recalculating persisted player totals, changing completed tournament status, editing result history, invalidating historical records, or writing to a public endpoint. Existing completed Quads should be presented from their preserved players, rounds, section membership, settings (when available), and results.
