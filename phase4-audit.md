# Phase 4 Audit Findings

## Current Tournament Ecosystem State

### Files and Sizes
- Director.tsx: 6562 lines — main director workspace
- TournamentWizard.tsx: 4385 lines — creation wizard + format chooser
- Tournament.tsx: 2168 lines — player/spectator view
- PublicTournament.tsx: 1835 lines — public spectator page
- QuadsDirectorPanel.tsx: 1474 lines — quads-specific director UI
- quads.ts: 1020 lines — quads engine
- FinalStandings.tsx: 955 lines — final standings page
- swiss.ts: 876 lines — swiss pairing engine
- TournamentSettingsPanel.tsx: 726 lines — settings panel
- CheckInPage.tsx: 655 lines — check-in page
- TournamentCompleteScreen.tsx: 358 lines — completion screen
- SwissStandingsPanel.tsx: 206 lines — swiss standings

### Status Vocabulary (CURRENT — needs migration)
In directorState.ts:
- `"registration"` — lobby/pre-start
- `"in_progress"` — tournament running
- `"completed"` — finished
- `"paused"` — paused

In tournamentData.ts (demo data):
- `"completed"` | `"in_progress"` | `"upcoming"`

**Phase 4 REQUIRED canonical vocabulary:**
- Draft
- Registration Open
- Ready to Start
- Live
- Between Rounds
- Awaiting Finalization
- Completed
- Paused
- Cancelled

### Format Chooser (CURRENT STATE)
4 cards in a 2×2 grid:
1. **Quickstart** — "Name & location only. Ready in seconds." — setup method, NOT a format
2. **Schedule** — "Full wizard — format, rounds, time & ratings." — 4 steps
3. **Large Event** — "Swiss + elimination bracket. 30+ players."
4. **Quads** — "4-player sections, round robin."

GAPS vs Phase 4 spec:
- Cards lack: best use case, player range, round structure, setup time, sections/elimination info
- "Quick Start" is correctly labeled as a setup method (not a format) — brief says avoid treating it as a format ✓
- No keyboard focus ring visible (uses onMouseEnter/Leave inline styles only)
- Cards are accessible as buttons ✓
- 2×2 desktop layout ✓ (grid-cols-2)
- Single-column mobile ✓ (grid-cols-1 sm:grid-cols-2)

### Quads Engine (CURRENT STATE)
- DEFAULT_TIEBREAK_ORDER: ["points", "headToHead", "sonnebornBerger", "wins", "seed"]
- computeQuadStandings() exists with full tiebreak logic
- Head-to-head is only applied for exactly 2 tied players ✓
- Sonneborn-Berger calculated ✓
- quads.test.ts exists with fixture tests

### Director Workspace (CURRENT STATE)
- Tabs: Round | Players | Standings | Settings ✓
- Status: uses "registration" | "in_progress" | "completed" | "paused"
- Round navigator: RoundTimeline component exists
- Board cards: exist in Director.tsx
- Result entry: inline result buttons on board cards
- Secondary actions: Share, Print, Broadcast, Connect Board, Reports, Edit pairings exist

### Key Gaps to Address
1. **Status vocabulary** — migrate "in_progress" → "Live", "registration" → "Registration Open", etc.
2. **Format chooser** — add full metadata to each card (use case, player range, round structure, setup time)
3. **Board cards** — audit 44px touch targets, result correction flow, keyboard entry
4. **Standings** — audit tie-break explanation, half-point notation, semantic table
5. **Public tournament page** — audit spectator hierarchy, live status band, mobile board cards
6. **Reports/print** — audit print CSS, no escaped Unicode
7. **Quads fixture test** — validate the specific fixture from the brief

## Phase 4 Brief Fixture (Quads)
Players: magnuscarlsen, hikaru, gothamchess (Levy), humblelowkey (Arnold)

Round 1:
- Magnus 1–0 Arnold (humblelowkey)
- Hikaru ½–½ Levy (gothamchess)

Round 2:
- Levy 0–1 Magnus
- Arnold 1–0 Hikaru

Round 3:
- Magnus 0–1 Hikaru
- Levy 0–1 Arnold

Expected results:
- Magnus: 2 pts (wins vs Arnold, Levy; loss to Hikaru)
- Arnold: 2 pts (loss to Magnus; wins vs Hikaru, Levy)
- Hikaru: 1.5 pts (draw vs Levy; loss to Arnold; win vs Magnus)
- Levy: 0.5 pts (draw vs Hikaru; losses to Magnus, Arnold)
- Magnus ranks ahead of Arnold by head-to-head (Magnus beat Arnold in R1)
- Draw rate: 1 draw / 6 games = 16.7%
- 6 unique pairings, no duplicates

## Implementation Priority Order
1. Status vocabulary migration (affects all surfaces)
2. Format chooser metadata enrichment
3. Board card touch targets + keyboard result entry
4. Standings semantic table + tie-break explanations
5. Public page spectator hierarchy
6. Quads fixture test validation
7. Reports/print CSS
8. Responsive audit
