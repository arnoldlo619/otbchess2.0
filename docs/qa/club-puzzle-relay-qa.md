# Club Puzzle Relay QA

**Scope:** Club event type `puzzle_relay`, its organizer setup flow, member-safe live relay session, durable storage, and event-detail integration.

## Delivered behavior

- Club owners/directors can create a **Puzzle Relay** event, choosing 2–8 teams and beginner, intermediate, or advanced difficulty.
- A manager starts the session only when at least two checked-in or RSVP-going members are available. The server assigns stable, balanced teams.
- Teams receive a progression of server-owned chess puzzles. Only the currently assigned teammate can submit the active move; a correct solution advances both puzzle progress and the player handoff.
- The session completes only after every team finishes its configured puzzle count. Live standings rank teams by solved positions.
- Session reads require full authenticated Club membership; starts require a Club owner/director; every event, team, and session query remains scoped to its Club.
- Event deletion cleans related relay rows. No fabricated scores, emoji glyphs, or client-trusted puzzle answers are used.

## Validation

| Check | Result |
| --- | --- |
| `pnpm vitest run tests/club-puzzle-relay-rules.test.ts tests/club-puzzle-relay-session.test.tsx tests/club-puzzle-relay-contract.test.ts tests/club-album-api-behavior.test.ts` | Passed: 4 files, 26 tests |
| `pnpm exec tsc --noEmit` | Passed |
| Changed-file ESLint | Passed with 0 errors; existing project warnings remain in `ClubDashboard.tsx` and `server/clubs.ts` |
| `pnpm lint` | Passed with 0 errors and 235 established warnings |
| `pnpm run build` | Passed; client and server bundles built |
| Database verification | Confirmed `club_puzzle_relay_sessions`, `club_puzzle_relay_teams`, and `club_puzzle_relay_team_members` plus indexes |
| Browser QA | Verified a fixture-backed active relay at 1440×1000 and 375×812: readable team/status hierarchy, usable chessboard scale, stacked mobile standings, and no horizontal clipping |
| Preview health | Local and public dev-preview roots both returned HTTP 200 |

## Full-suite baseline

`pnpm vitest run` completed with **419 passed, 16 failed, 2 skipped test files** / **7,094 passed, 30 failed, 2 skipped tests**. The failures are established unrelated source-contract and visual baseline suites (including legacy Tournament Wizard, sidebar, landing, semantic, and Matchup Prep expectations). The new Puzzle Relay rule, API/create validation, rendered session, and source-contract suites pass in the focused run.

## Migration

`drizzle/0026_club_puzzle_relay_sessions.sql` was generated from the schema and applied to the configured database. It creates the durable session, team, and member tables and their scoped indexes; no existing Club event records were modified.
