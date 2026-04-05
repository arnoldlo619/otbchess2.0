# Club Event/Tournament Creation Fix TODO

## P0 — ClubDashboard Unblocking
- [ ] Add server API fallback to ClubDashboard loader (fetch /api/clubs/:id when localStorage misses)
- [ ] Add server API fallback for membership check (fetch /api/clubs/:id/members when localStorage misses)
- [ ] Hydrate localStorage from server response so subsequent loads are fast

## P1 — Server-side Club Events
- [ ] Add club_events table to DB schema
- [ ] Add POST /api/clubs/:id/events route
- [ ] Add GET /api/clubs/:id/events route
- [ ] Migrate createClubEvent to write to server (with localStorage cache)
- [ ] Migrate ClubDashboard event loader to read from server

## P1 — Server-side Club Feed
- [ ] Add club_feed table to DB schema
- [ ] Add POST /api/clubs/:id/feed route
- [ ] Add GET /api/clubs/:id/feed route
- [ ] Migrate clubFeedRegistry to write to server (with localStorage cache)
- [ ] Migrate ClubDashboard feed loader to read from server

## P2 — Tournament Club Link Persistence
- [ ] On tournament creation in TournamentWizard, PATCH /api/clubs/:id to increment tournamentCount
- [ ] Store tournament-club link server-side

## Final
- [ ] Run DB migration (pnpm db:push)
- [ ] TypeScript check (0 errors)
- [ ] Save checkpoint
