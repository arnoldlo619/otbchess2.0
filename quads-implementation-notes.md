# Quads Implementation Notes

## Architecture Summary

- Tournaments use a **client-side state machine** pattern
- Director's full state (players, rounds, games, standings) stored as JSON blob in `tournament_state` table
- Swiss pairing engine runs entirely client-side in `client/src/lib/swiss.ts`
- Format type stored in `TournamentConfig` (localStorage) and `user_tournaments` (DB)
- State is synced to server via `PUT /api/tournament/:id/state` with revision-based conflict detection

## Existing Format Values
`"swiss" | "doubleswiss" | "roundrobin" | "elimination" | "swiss_elim"`

## Key Files
- `client/src/lib/tournamentRegistry.ts` — TournamentConfig interface, localStorage CRUD
- `client/src/lib/tournamentData.ts` — Player, Game, Round, Tournament interfaces
- `client/src/lib/swiss.ts` — Swiss pairing engine (resolvePairingRating, StandingRow, etc.)
- `client/src/components/TournamentWizard.tsx` — Format selection UI (line ~1030)
- `client/src/pages/Tournament.tsx` — Director dashboard (2155 lines)
- `client/src/pages/PublicTournament.tsx` — Player-facing public page
- `server/index.ts` — API endpoints for state, players, SSE, timer
- `shared/schema.ts` — DB schema (tournamentState, tournamentPlayers, userTournaments)

## Data Model for Quads (Planned)

### Extend TournamentConfig.format
Add `"quads"` to the union type in:
- `client/src/lib/tournamentRegistry.ts` (line 17)
- `client/src/components/TournamentWizard.tsx` (line 78)

### New Config Fields (on TournamentConfig)
```ts
quadRatingSource?: "otb" | "rapid" | "blitz" | "manual" | "best_available";
quadRemainderHandling?: "bottom_swiss" | "expand_last_quad";
quadColorAssignment?: "deterministic" | "random" | "balanced";
quadTiebreakOrder?: string[]; // default: ["score", "direct", "sbr", "wins", "black", "rating"]
```

### New State Shape (inside the JSON blob)
```ts
interface QuadSection {
  id: string;
  name: string; // "Quad 1", "Quad 2", "Bottom Swiss"
  type: "quad" | "bottom_swiss";
  orderIndex: number;
  ratingMin: number;
  ratingMax: number;
  playerIds: string[];
  localSeeds: Record<string, number>; // playerId → 1-4
  status: "pending" | "in_progress" | "completed";
}

interface QuadStanding {
  playerId: string;
  sectionId: string;
  score: number;
  wins: number;
  draws: number;
  losses: number;
  blackGames: number;
  sonnebornBerger: number;
  directEncounterScore: number;
  finalRank: number;
}
```

### Game Interface (existing, reused)
The existing `Game` interface works for quads — just need to add `sectionId` field:
```ts
sectionId?: string; // which quad/section this game belongs to
```

## Pairing Table (Fixed for 4-player Quad)
Round 1: Board A: Seed 1 vs Seed 4, Board B: Seed 2 vs Seed 3
Round 2: Board A: Seed 3 vs Seed 1, Board B: Seed 4 vs Seed 2
Round 3: Board A: Seed 1 vs Seed 2, Board B: Seed 3 vs Seed 4

Colors: First listed player = White (deterministic default)
- Seeds 1 & 3 get 2 White games
- Seeds 2 & 4 get 2 Black games

## Remainder Handling Rules
- 0 remainder: all full quads
- 1 remainder: borrow 3 from last quad → 5-player bottom swiss
- 2 remainder: borrow 2 from last quad → 6-player bottom swiss  
- 3 remainder: borrow 1 from last quad → 7-player bottom swiss
- <4 total: special handling (2=head-to-head, 3=mini-RR)
- 5-7 total: single 3-round mini-Swiss

## Implementation Order
1. ✅ Audit complete
2. Data model updates (types, config extension)
3. Quad engine module (`client/src/lib/quads.ts`)
4. Unit tests
5. Server API (minimal — format already stored in state blob)
6. Host setup UI (TournamentWizard format option)
7. Host management UI (section review, manual adjust, publish)
8. Player-facing UI (public tournament page with sections)
9. Bottom Swiss fallback
10. Integration/regression tests
