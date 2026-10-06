# Club Speed Dating Event — QA Record

**Date:** 2026-10-06  
**Scope:** Club event type, creation settings, shared live session, persisted pairings, and organizer controls.

## Delivered behavior

- Club owners/directors can select **Speed Dating** from the Club Event picker.
- The details form provides bounded controls for **rounds (1–12)** and **minutes per round (1–30)**, defaulting to four five-minute rounds.
- Event settings are persisted on `club_events` and normalized through the existing event cache/API model.
- An organizer starts the session from the current unique RSVP `Going` roster. The server snapshots identities, persists round one, and records a shared deadline.
- Pairings use the deterministic circle method. Players receive a different opponent until the roster completes its unique rotation; odd rosters rotate a bye without saving a fictitious pairing.
- The event page provides an accessible live surface: timer, round/roster status, personal opponent/table, full round board list, waiting state, alert state, and organizer-only next-round/finish action.
- Server routes require an active Club member for reads and `requireFullAuth` plus owner/director authorization for start/advance. Event deletion cleans session, participant, and pairing records.

## Database migration

- Generated and applied `drizzle/0022_club_speed_dating_sessions.sql`.
- Added `club_events.speed_dating_rounds` and `club_events.speed_dating_minutes`.
- Added session, participant, and pairing tables with unique event, participant, and per-round board constraints.
- Verified the new columns and all three tables using `information_schema`; no production test data was inserted.

## Validation

| Check | Result |
| --- | --- |
| Focused Speed Dating + Club Event regressions | Pass — 7 files, 57 tests |
| Pairing engine, including odd-roster/byes | Pass |
| Rendered organizer/member session UI tests | Pass |
| TypeScript (`pnpm exec tsc --noEmit`) | Pass |
| Changed-file ESLint | 0 errors; 3 established warnings outside this feature |
| Project lint | 0 errors; 235 established warnings |
| Production build (`pnpm run build`) | Pass |
| Public preview `/` health | HTTP 200 |
| Unauthenticated Speed Dating route boundary | HTTP 401, confirming the route is mounted behind authentication |
| Full Vitest baseline | 7,078 passed, 2 skipped; 31 established failures across 17 unrelated suites |

## Known validation boundary

The sandbox browser has no authenticated private Club membership, so the full production start/advance lifecycle was not executed against a real Club roster. The server-backed lifecycle is covered by pairing-engine, server-contract, client persistence, and rendered session regressions without modifying user event or RSVP data.
