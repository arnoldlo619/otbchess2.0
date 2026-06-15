# PERFORMANCE_AUDIT.md

## Executive performance summary

The biggest performance risk is not raw algorithmic complexity; it is **large route components doing many jobs at once while live tournament state changes frequently**. During a 20–100 player tournament, result entry, SSE events, timer updates, and standings recalculations can trigger broad rerenders on pages that already contain many panels, modals, and derived views.

Performance work should prioritize live-event paths in this order:

1. Director result entry and round generation.
2. Public/player tournament page refresh after pairings/results.
3. Registration/import with Chess.com ELO lookup.
4. Match Prep report fetch and rendering.
5. Club/event pages after images, feeds, and event lists grow.

## Evidence snapshot

Largest relevant files by line count from `wc -l`:

| File | Approx. lines | Performance concern |
|---|---:|---|
| `client/src/pages/ClubDashboard.tsx` | 6,253 | Large route chunk, many dashboard sections likely bundled together. |
| `client/src/pages/Director.tsx` | 5,800 | Live event page; broad state changes risk expensive rerenders. |
| `client/src/pages/LeagueDashboard.tsx` | 3,902 | Large authenticated dashboard with many interactive sections. |
| `client/src/pages/ClubProfile.tsx` | 3,838 | Public-facing page with feeds, events, tournaments, media. |
| `server/index.ts` | 3,118 | Many route handlers in one bundle/module; maintainability and cold-start parsing concern. |
| `client/src/components/TournamentWizard.tsx` | 2,875 | Creation flow likely loads many optional steps/components together. |
| `server/prepEngine.ts` | 2,409 | Heavy data transformation and external fetch logic. |
| `client/src/pages/MatchupPrep.tsx` | 2,406 | Heavy report UI and state in one route chunk. |
| `client/src/pages/Tournament.tsx` | 2,119 | Public live tournament page; repeated standings computation appears in multiple panels. |

## Frontend rendering bottlenecks

### 1. Director page rerender breadth

**Files:** `client/src/pages/Director.tsx`, `client/src/lib/directorState.ts`, `client/src/components/*Tournament*`, bracket/standing components.

**Pattern:** The director page calls `useDirectorState` and passes state into many panels. A result update changes `players`, `rounds`, standings, current round state, possibly timers, and UI flags.

**Risk during live events:** Entering a result may rerender the full director dashboard, modals, bracket sections, settings panels, and hidden tabs. On mobile, this can feel laggy.

**Optimizations:**

- Split visible tab panels into memoized components and only render active mobile tab by default.
- Move derived selectors into memoized hooks: `useCurrentRoundGames`, `useStandingsRows`, `useBoardGames`, `useTournamentCompletion`.
- Memoize board/result cards by `game.id`, `game.result`, and player display fields.
- Keep modal state localized to modal components.
- Use transition/deferred updates for non-critical analytics/celebration UI after result entry.

**Complexity:** Medium. 2–4 safe PRs.

### 2. Repeated standings computation

**Files:** `client/src/pages/Tournament.tsx`, `client/src/pages/Director.tsx`, `client/src/lib/tournamentData.ts`, `client/src/components/SwissStandingsPanel.tsx`, `client/src/components/CrossTable.tsx`.

**Pattern:** `Tournament.tsx` computes standings in multiple components (`MobileStandingsAccordion`, `StandingsPanel`, `PerformanceSection`). `directorState.ts` recomputes standings when entering results to update Buchholz.

**Risk:** For 100 players and many rounds, repeated standings/tiebreak calculations can become noticeable on lower-end phones.

**Optimizations:**

- Introduce one `selectTournamentStandings(state)` memoized selector and pass rows down.
- Compute standings once per `(players, rounds)` in route-level hooks.
- Avoid recalculating for hidden tabs.
- Add a micro-benchmark test for 20, 50, 100, and 200 players.

**Complexity:** Medium.

### 3. Timer-driven rerenders

**Files:** `client/src/pages/Tournament.tsx`, `client/src/pages/Director.tsx`, `client/src/components/RoundTimer.tsx`, `client/src/components/SpectatorTimerBanner.tsx`.

**Pattern:** `setInterval` is used for elapsed/timer updates. Timer state can live in route components and cause broad rerenders.

**Risk:** A 1-second interval should only update timer text, not pairings/standings/cards.

**Optimizations:**

- Isolate timer display into memoized components that own their own ticking state.
- Keep server snapshot updates separate from local display ticks.
- Use `requestAnimationFrame` only if smooth clock animation is needed; otherwise 1-second interval in the leaf component is enough.

**Complexity:** Small/Medium.

### 4. Match Prep route chunk and report rendering

**Files:** `client/src/pages/MatchupPrep.tsx`, `client/src/components/ChessPracticeBoard.tsx`, `MoveTreePanel.tsx`, `ChessLineViewer.tsx`.

**Pattern:** Match Prep owns all tabs and report state in one page. Practice board and line tree can be heavy even when the user only reads the scout report.

**Risk:** Premium feature feels slow on first open, especially mobile.

**Optimizations:**

- Lazy-load the practice board tab and move tree tab content.
- Split report cards into memoized sections.
- Keep raw report JSON and derive display models with `useMemo` keyed by report ID/version.
- Add skeletons that show cached report immediately while refreshing.

**Complexity:** Medium.

### 5. Club pages and media-heavy feeds

**Files:** `client/src/pages/ClubProfile.tsx`, `client/src/pages/ClubDashboard.tsx`, `client/src/lib/clubFeedRegistry.ts`, `client/src/lib/clubEventRegistry.ts`.

**Pattern:** Large pages combine profile hero, feed, members, events, tournaments, leagues, admin controls, and media upload/edit flows.

**Risk:** Public club pages are premium marketing pages; slow first render or layout jank hurts conversion.

**Optimizations:**

- Route-level split public profile vs admin dashboard sections.
- Virtualize or paginate long feeds/member lists when counts grow.
- Use responsive image constraints, fixed aspect-ratio placeholders, and lazy image loading.
- Memoize feed item rendering and filter/sort selectors.

**Complexity:** Medium/Large depending on extraction scope.

## Data fetching and network performance

### Chess.com/Lichess upstream calls

**Files:** `server/index.ts`, `server/prepEngine.ts`, `server/auth.ts`, `server/leagues.ts`.

**Current pattern:** Several modules call Chess.com/Lichess directly. Some have retries/timeouts; others make sequential or per-user calls.

**Risks:**

- Registration and profile pages can feel slow if ELO lookups block UI.
- Match Prep can hit upstream rate limits or month-by-month archive delays.
- League start can call Chess.com stats for multiple players.

**Optimizations:**

- Create `server/services/chesscom.ts` and `server/services/lichess.ts` with shared timeout, retry, cache, error classes, and user-agent.
- Return structured errors: `not_found`, `private_or_no_games`, `rate_limited`, `upstream_timeout`, `partial_data`.
- Warm cache in background after registration/import but never block the director from adding a player manually.
- Cache by username + data type + filters + engine version where relevant.

**Complexity:** Medium.

### Tournament server writes

**Files:** `client/src/lib/directorState.ts`, `server/index.ts`, `shared/schema.ts`.

**Current pattern:** Whole-state JSON updates after debounce.

**Performance risk:** Full JSON blob writes are acceptable for small tournaments but can become heavier with many rounds, bracket data, player metadata, and analytics. More important, whole-blob writes can clobber concurrent updates.

**Optimizations:**

- Short term: add `revision` and conflict response.
- Medium term: add action endpoints for critical mutations (`enterResult`, `generateRound`, `startTournament`) and keep whole-state sync as fallback/snapshot.
- Long term: event log or normalized game/result tables.

**Complexity:** Medium/Large.

## Bundle/dependency considerations

### Positive findings

- `client/src/App.tsx` lazy-loads pages.
- `vite.config.ts` defines manual chunks for Radix, charts, motion, PDF export, React vendor, and router.
- Heavy PDF libraries are manually chunked.

### Remaining risks

- Large page chunks can still be heavy because feature internals are not lazily split.
- `TournamentWizard.tsx`, `ClubDashboard.tsx`, `Director.tsx`, and `MatchupPrep.tsx` likely load many optional panels/modal flows with the route.
- Stockfish, CV, PDF, image export, and chessboard components should stay out of initial route chunks unless needed.

### Recommendations

- Run `pnpm build -- --debug` or use Vite/Rollup visualizer in a separate diagnostics PR if allowed later; do not add a dependency in this audit.
- Convert rarely used heavy modals to `lazy()` imports.
- Lazy-load Match Prep practice board and game recorder/video components.
- Keep `react-chessboard` and Stockfish consumers isolated to routes/components that truly need them.

## Backend/runtime performance

### SSE and timers

**Files:** `server/index.ts`.

Current SSE subscriber maps and timer maps are in memory. This is fast for one process but not horizontally scalable. Keepalive intervals are per connection. This is acceptable for early-stage deployment but should be isolated into a service module and instrumented.

Recommendations:

- Track connection counts per tournament and expose admin diagnostics.
- Add explicit cleanup tests for SSE disconnects.
- Move timer scheduling into a service and persist enough state for server restarts.
- Keep the in-memory implementation until there is a clear multi-instance deployment need; do not introduce Redis prematurely.

### Database indexes and constraints

**Files:** `shared/schema.ts`.

Recommendations:

- Add unique `(tournament_id, username)` for `tournament_players` after duplicate cleanup.
- Review `push_subscriptions`: comments say endpoint is unique, but schema uses surrogate id and only tournament index. Add safe uniqueness if supported by text prefix/hash column.
- Review league indexes named `unique*` but implemented as non-unique `index(...)`; either rename or convert to `uniqueIndex` where intended.

## Prioritized performance work

| Priority | Improvement | Expected impact | Complexity |
|---|---|---|---|
| P0 | Prevent timer and live-sync state from rerendering entire tournament pages. | Smoother live event UI. | Medium |
| P0 | Add single computed standings selector per route. | Faster result entry and public page updates. | Medium |
| P1 | Split Director active tab panels and memoize board cards. | Major mobile improvement. | Medium |
| P1 | Centralize Chess.com/Lichess cache/retry service. | Faster, more reliable registration/profile/prep. | Medium |
| P1 | Lazy-load Match Prep practice board and heavy tab content. | Faster premium feature startup. | Medium |
| P2 | Extract ClubProfile/ClubDashboard public/admin sections. | Faster public pages and maintainability. | Large |
| P2 | Add lightweight performance benchmarks for Swiss/standings. | Prevent regressions. | Small |
| P3 | Consider virtualization for large member/player/feed lists. | Future scalability. | Medium |

