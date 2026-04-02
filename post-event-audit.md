# Post-Event Audit Notes

## Current State
- PublicTournament.tsx: 1153 lines
- PostEventCTAs component (lines 739-861): shows when `isCompleted`
  - Email capture form (localStorage only, not server-side)
  - "Create an Account" link to /profile
  - "Join a Club" link to /clubs
  - "Explore ChessOTB" link to chessotb.club
- FollowedPlayerCard (lines 288-481): shows rank, points, W/D/L, current game, round history
- StandingsSection (lines 631-735): shows all standings with precomputed PublicStandingRow
- PairingsSection (lines 485-627): shows round pairings with round tabs

## What Needs to Change

### 1. Post-Event Mode Transition
- Hero should change when completed: show trophy, "Tournament Complete" celebration
- Round dots should all be green (completed)
- Status badge already shows "Completed" — good

### 2. Player Performance Card (NEW)
- Premium card component showing:
  - Player name, username, avatar, ELO
  - Final placement (#X of Y)
  - Score (points / total possible)
  - W/D/L record
  - Round-by-round: opponent, color, result, board
  - Tournament name, date, venue
  - Club branding (club name + logo if available)
  - ChessOTB branding
- Should feel like a collectible/shareable card

### 3. Personal Recap Flow
- When tournament is completed AND player is followed:
  - FollowedPlayerCard transitions to "Your Tournament Recap"
  - Shows performance card preview
  - CTAs: "Get full performance card", "Save to profile", "Join club"

### 4. Enhanced Post-Event CTAs
- Grouped card with clear hierarchy
- Primary: "View Your Performance Card" (if followed player)
- Secondary: "Get Results by Email"
- Tertiary: "Create Account" / "Join Club"
- Not pushy, premium feel

## Data Available
- PublicStandingRow: playerId, name, username, elo, title, avatarUrl, rank, points, buchholz, wins, draws, losses
- Player: id, name, username, elo, title, avatarUrl, score, wins, draws, losses, opponents, buchholz, colorHistory
- Round[]: number, games[] (whiteId, blackId, result, board, id)
- Tournament meta: tournamentName, venue, date, format, totalRounds, currentRound, status

## Key Types
```ts
interface PublicStandingRow {
  playerId: string; name: string; username: string; elo: number;
  title?: string; avatarUrl?: string;
  rank: number; points: number; buchholz: number;
  wins: number; draws: number; losses: number;
}
```
