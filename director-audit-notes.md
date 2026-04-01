# Director Console Audit Notes

## Current Structure (Director.tsx — 4225 lines)
- **Tabs**: Home, Players, Standings, Settings (swipeable)
- **Home tab**: Registration lobby OR active round (pairings + board cards)
- **Players tab**: Full roster with search, filter, sort, CSV export
- **Standings tab**: Podium hero + full leaderboard table
- **Settings tab**: Tournament state, Quick Actions, Rating type, Public toggle, QR, SMTP, Director code, Spectator code

## What Already Works Well
- BoardCard: player names on result buttons (White name / Draw / Black name)
- Board number prominent in header
- White/Black piece indicators (dot)
- Result progress bar + count (X of Y)
- "Complete" / "In Progress" status badges
- Keyboard shortcuts (1/D/0) for score entry
- Undo last result + clear result
- Board swap/edit mode
- Late registration banner (Round 1)
- Tournament complete celebration with podium
- Generate Next Round CTA auto-scrolls when all results in

## Key Refinements Needed (from user requirements)

### Command Center Header (Phase 2)
- Currently: page title + round timer + tab bar
- Needed: A persistent status summary strip showing:
  - Tournament name + status badge
  - Round X of Y
  - Player count
  - Results progress (14 of 38 entered)
  - Public mode indicator (live dot)
- Should be visible across all tabs, not just Home

### Check-In Roster (Phase 3)
- Currently: Players tab has search, filter, sort, but no check-in concept
- Needed: Check-in status per player (Registered → Checked In → Walk-In → No Show)
- One-click check-in toggle
- Walk-in quick-add form (minimal fields)
- No-show marking
- This is a pre-tournament workflow that happens during registration phase

### Fast Score Entry (Phase 4)
- Currently: BoardCard already has player-name buttons, undo, clear
- Already good! Main refinements:
  - Unreported boards should be more visually prominent (they already have green border + "Live" badge)
  - Consider scrolling to first unreported board
  - Keyboard shortcuts already exist (1/D/0 + arrow keys)
  - Progress tracker already exists

### Round Lifecycle (Phase 5)
- Currently: implicit — "In Progress" badge, "Generate Next Round" CTA appears when all results in
- Needed: More deliberate publish/finalize with confirmation dialogs
- Status system: Draft Pairings → Published → In Progress → Complete
- "Publish Round" should push to public page
- "Finalize Tournament" should be a deliberate action

### QR Projector Display (Phase 6)
- Currently: QR in Settings tab (PublicTournamentCard) + QRModal
- Needed: Clean fullscreen QR display mode for projecting at venue
- Large QR, high contrast, minimal chrome

## Implementation Priority
1. Command Center header strip (highest visibility, all tabs)
2. Check-in roster (registration phase workflow)
3. Score entry refinements (minor — already good)
4. Round lifecycle (publish/finalize flow)
5. QR projector display
6. Mobile/tablet polish
