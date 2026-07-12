# Quads System Audit — Key Findings

## Architecture Overview

### Files Involved
- `client/src/lib/quads.ts` — Core Quads engine (1007 lines): section generation, pairing, standings, validation, swap
- `client/src/lib/directorState.ts` — Mutable tournament state hook (all formats)
- `client/src/components/tournament/QuadsDirectorPanel.tsx` — Director UI (recently redesigned)
- `client/src/pages/Director.tsx` — Director page (wires QuadsDirectorPanel)
- `client/src/pages/Report.tsx` — Performance report page (BROKEN for Quads: single global champion)
- `client/src/pages/PublicTournament.tsx` — Public live/results page (BROKEN: one global standings)
- `client/src/pages/Tournament.tsx` — Main tournament page (redirects completed to /report)
- `client/src/lib/tournamentRegistry.ts` — Config persistence (has quadRatingSource, quadTiebreakOrder)
- `client/src/components/TournamentWizard.tsx` — Creation wizard
- `server/quadsCompletion.ts` — Prize templates, achievements, recap generation (579 lines)
- `server/quadsCompletion.test.ts` — Tests for above
- `shared/schema.ts` — DB schema (tournament_state = JSON blob, quad_prizes, player_achievements tables)

## Current Quads Engine (quads.ts) — ALREADY CORRECT
- ✅ QuadRatingSource type: "otb" | "rapid" | "blitz" | "manual" | "best_available"
- ✅ resolveQuadRating() — correctly resolves per source
- ✅ sortPlayersForQuads() — sorts by resolved rating
- ✅ generateQuadSections() — creates sections of 4, handles remainder
- ✅ generateQuadPairings() — deterministic 3-round RR pairing table
- ✅ calculateQuadStandings() — per-section standings with SB, direct encounter
- ✅ calculateSonnebornBerger() — correct implementation
- ✅ calculateDirectEncounter() — correct for tied players
- ✅ rankStandings() — uses configurable tiebreak order
- ✅ validateQuadIntegrity() — validates 4 players, 6 games, no duplicates
- ✅ getSectionWinners() — returns rank 1 players (supports co-champions)

## DEFECTS IDENTIFIED

### D1: directorState.ts — Result entry uses Swiss logic for Quads
- Lines 501-540: `applyResultToPlayers` + `computeStandings` from Swiss module
- This means the global standings table is computed from ALL players, not per-section
- The Quads-specific `calculateQuadStandings` is only used in the QuadsDirectorPanel UI, not in the authoritative state

### D2: directorState.ts — No finalization state machine
- Lines 762-765: completion is just `status: "completed"` — no `finalizedAt`, no validation
- No READY_TO_FINALIZE vs FINALIZED distinction
- No result locking after finalization

### D3: directorState.ts — No result history/audit
- No `resultHistory[]` on games
- No dispute state
- No correction workflow

### D4: Report.tsx — Global champion, no section filtering
- Lines 641-705: loads full state, computes one report from ALL players
- Lines 154-229: single champion via performances[0]
- No `?section=` query param handling

### D5: PublicTournament.tsx — Global standings, one podium
- Lines 502-815: single tournament-wide standings
- Lines 817-920: one "Tournament Complete" hero with global podium
- No section tabs or filtering

### D6: Tournament.tsx — Redirects to global /report on completion
- Lines 1190-1208: auto-redirect to `/report` after 2.5s

### D7: TournamentWizard — Rounds selector still shown for Quads
- Quads should auto-lock to 3 rounds with explanation

### D8: Rating source not enforced end-to-end
- `quadRatingSource` exists in config but directorState uses Swiss's `resolvePairingRating`
- The selected rating source may not control actual seeding

### D9: No co-champion detection in finalization
- getSectionWinners returns rank 1 players but the global "Tournament Complete" shows only 1 winner

### D10: Unicode/date bugs in creation (from spec)
- btoa() crash with em dashes
- Date conversion shifts July 11 → July 10

## IMPLEMENTATION PLAN (Phased)

### Phase 1: Core Engine Fixes (P0)
1. Add `resultHistory[]` to Game type in tournamentData.ts
2. Add `finalizedAt`, `tournamentStatus` state machine to DirectorState
3. Fix directorState result entry to use per-section `calculateQuadStandings` for Quads
4. Add result correction flow (edit/clear/undo with audit trail)
5. Add finalization validation (all games complete, no disputes)

### Phase 2: Tie Policy & Co-Champions
1. Add configurable tie policy to QuadSettings
2. Implement head-to-head → Sonneborn-Berger → co-champions flow
3. Show tiebreak explanations in standings
4. Detect and label co-champions

### Phase 3: Creation Wizard
1. Lock rounds to 3 for Quads with explanation
2. Add structure preview (N players → N/4 Quads → 3 rounds → 6 games each)
3. Fix Unicode btoa crash
4. Fix date timezone issue
5. Add rating source selector with immediate re-preview

### Phase 4: Director Dashboard
1. Already redesigned (QuadsDirectorPanel v2)
2. Add command center metrics (games remaining, Quads needing attention)
3. Add exception tray
4. Improve progress labels

### Phase 5: Public Results & Reports
1. Add section-filtered routing to Report.tsx (?section=)
2. Add section tabs to PublicTournament.tsx
3. Per-Quad champion cards (not global podium)
4. Per-Quad player cards ("Quad 1 Champion" not "1st of 16")
5. Section-filtered print/export

### Phase 6: Mobile & Accessibility
1. Responsive QA across breakpoints
2. Touch targets ≥ 44px
3. Keyboard-accessible result entry
4. ARIA labels, focus indicators
5. Screen-reader announcements

### Phase 7: Automated Tests
1. Unit tests for quads.ts (seeding, scheduling, standings, tiebreaks)
2. Integration tests (full tournament lifecycle)
3. Regression tests (Swiss/RR/Elimination still work)
