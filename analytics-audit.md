# Analytics Data Source Audit

## Already Available (from existing data)
1. **Attendance**: tournament_state stateJson has players array → total registered, player count
2. **Walk-ins**: check-in state in localStorage (not persisted to DB yet)
3. **Rounds completed**: tournament_state stateJson has rounds array
4. **Final standings**: computed from stateJson (or from snapshot cache)
5. **Tournament format/date/venue**: userTournaments table
6. **Club info**: clubs table via tournament config clubId

## Needs New Tracking (tournament_analytics table)
1. **Public page views**: track on GET /api/public/tournament/:slug
2. **Player searches**: track from client POST to analytics endpoint
3. **Player follows**: track from client POST to analytics endpoint
4. **Email captures**: track from client POST to analytics endpoint
5. **Account creations from event**: need attribution (referrer param)
6. **Club joins from event**: need attribution
7. **QR scans**: same as public page views (QR → /live/:slug)
8. **Performance card claims**: track from client

## Architecture Decision
- Create `tournament_analytics` table with event-type rows
- Each row: id, tournamentId, eventType, metadata (JSON), createdAt
- Event types: page_view, search, follow, email_capture, account_create, club_join, card_claim
- Server-side tracking for page_view (increment on public API hit)
- Client-side tracking for search, follow, email, card_claim (POST to analytics endpoint)
- Aggregate queries for the analytics page

## Metrics Derivable from Director State
- Total registered players: players.length
- Check-in count: from checkedInIds (need to persist)
- Walk-in count: players added after tournament start (need flag)
- No-show count: registered - checked_in (if check-in data persisted)
- Results entry rate: games with result / total games per round
- Round timing: not currently tracked, could add timestamps

## Key Decision: Keep it lean
- Don't build a full event tracking system
- Use simple counter increments where possible
- Aggregate at query time, not in real-time
- Store check-in snapshot in tournament_state when tournament starts
