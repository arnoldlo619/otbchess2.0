# Quads Director Command Center Redesign — Section 7 Spec

## Architecture
Full rewrite of `QuadsDirectorPanel.tsx` from vertical stack → command-center layout.
Props interface UNCHANGED (Director.tsx needs no changes).

## Sections A–G

### A. Sticky Event Header (inside panel, not page-level sticky)
- Tournament name (from tournamentConfig.name)
- QUADS badge (green pill)
- "4 sections" count
- "Round 2 of 3" 
- Rating source (tournamentConfig.ratingType)
- Time control (tournamentConfig.timePreset)
- Player count (players.length)
- Games completed (X of Y)

### B. Active-Round Command Center
Operational metrics row:
- Active Round: {currentRound}
- {completedCurrentRound} of {totalCurrentRound} results entered
- {remaining} games remaining
- {needsAttention} Quad(s) need attention (has pending games in current round)
- 0 disputed results

Primary action:
- "Advance to Round {N+1}" — disabled until all current round results in
- When disabled: show exactly what remains ("2 games remaining in Quad 1, 1 in Quad 3")
- "Finalize Tournament" when all rounds done
- Do NOT duplicate advancement controls elsewhere (remove from bottom of panel)

### C. Quad Overview Grid (2×2 on desktop, 1-col on mobile)
Each Quad card shows:
- Quad name (editable inline)
- Rating range (using authoritative rating source)
- Four-player roster (avatars + names)
- Current leader or co-leaders
- "4 of 6 games complete" (verbose label)
- "1 of 2 current-round games complete"
- Warning indicator if has pending games
- "Manage" button → selects this quad as active workspace

Visual states:
- Neutral: default card
- Active: green border + glow (currently selected workspace)
- Needs attention: amber border + pulse dot
- Complete: gold border + trophy
- Disputed: red border (future)

### D. Selected Quad Workspace (replaces old accordion expand)
When a quad card is clicked → show workspace below the grid:
Left panel (60%):
- Active-round boards with result entry (reuse RoundPairings + GameRow)
- Round tabs (R1/R2/R3)

Right panel (40%):
- 4-player standings table
- Score, W/D/L, tiebreak
- Leader/co-leader badge

On mobile: stack vertically (boards first, standings below)

### E. Exception Tray
Sticky panel at bottom of command center (collapsible):
- Missing results: list of games without results in current round
- Players without ratings: flag if any player has rating 0
- Finalization blockers: what prevents completing tournament
- Show count badge on tray toggle button
- Empty state: "No exceptions — tournament running smoothly"

### F. Progress Labels (verbose)
Replace:
- "6/6" → "6 of 6 games complete"
- "1/2" → "1 of 2 Round {N} games complete"

### G. Completion View
When ALL games complete (status.pct === 100 for all sections):
Replace operational dashboard with:
- "All Games Complete" header
- 4 champion cards (one per section) with co-champion support
- Finalization checklist
- "Finalize Tournament" CTA

## Implementation Notes
- Keep all existing sub-components: RoundPairings, GameRow, StandingsView, ProgressRing
- Add new: CommandCenterHeader, RoundMetricsBar, QuadOverviewGrid, QuadCard, QuadWorkspace, ExceptionTray, CompletionView
- selectedQuadId state: which quad is open in workspace
- exceptionTrayOpen state: boolean
- All existing callbacks preserved: onEnterResult, onSwapPlayers, onRenameSection, onAdvanceRound, onCompleteTournament
- Remove the bottom "Advance to Round N" / "Finalize Tournament" buttons (moved to B)
- Keep SectionCompleteCard logic but integrate into CompletionView (G)
- Keep InstagramCarouselModal integration
