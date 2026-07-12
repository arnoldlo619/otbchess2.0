# P0 Quads Fixes — Progress

## COMPLETED

### 1. Report.tsx — Section-filtered routing ✅
- Added `computeQuadSectionPerformances()` to `performanceStats.ts` (new function)
- Added `useSearch` import, section tabs, `displayPerformances` state
- Section tabs: "All Sections" + one per quad section (with champion name badge)
- SummaryBanner: shows section-specific champion when section selected
- Podium: "Section Champions" grid (all sections view) or standard podium (single section)
- CrossTable & RoundTimeline: section-filtered players/rounds

### 2. PublicTournament.tsx — Section tabs + per-Quad podium ✅
- Added `quadSections` to `PublicTournamentData` interface
- Added section tab bar above StandingsSection (All + per-section buttons)
- `displayStandings` computed from section-filtered standings
- CompletedHero: shows "Section Champions" (per-quad winners) instead of global top-3 podium

### 3. Server-side — quadSections in public API ✅
- Added `PublicQuadSection` interface to `publicSnapshot.ts`
- Added `quadSections?` to `PublicSnapshot`, `BuildSnapshotInput`
- `buildSnapshot()` now includes quadSections when format is quads
- `server/index.ts` passes `s.quadSections` from state JSON to buildSnapshot

## REMAINING (Phase 4)

### 4. Director.tsx — Per-Quad finalization
- Line 4009: `const finalStandings = getStandings(state.players)` — this computes GLOBAL standings
- Line 4030: Shows one "Tournament Complete" section with global champion
- Need to: show per-section champions in the Tournament Complete card
- Lines 2619-2714: auto-finalization logic — broadcasts single winnerName
- Need: detect quads format → compute per-section winners → show multiple champions

### Key locations in Director.tsx:
- Line 984: `const standings = getStandings(players)` — global standings used in sidebar
- Line 4009-4030: Tournament Complete rendering
- Lines 2458-2714: broadcastTournamentComplete and auto-finalization
- Line 5533: manual finalize button handler

### What to fix:
1. Tournament Complete card at line 4009 — show per-section champions for quads
2. Auto-finalization at 2619 — compute per-section winners for quads
3. broadcastTournamentComplete — send all section champions, not just one name
