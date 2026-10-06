# Club Event Mode Removal QA

**Scope:** Permanent removal of the unused **Speed Dating** and **Trivia Night** Club Event modes at the user's request.

## What was removed

- Event-type options, setup controls, live-session interfaces, and event-detail rendering.
- Client session APIs, server routes, pairing logic, and mode-specific contracts/tests.
- Durable Speed Dating session, participant, and pairing tables.
- Durable Trivia Night session, team, member, question, and response tables.
- Mode-specific configuration columns from `club_events`.
- Mode-specific fixture copy and tournament examples.

## Database cleanup

Migration `0024_retire_unused_event_modes.sql`:

1. Converts any `speed_dating`, `trivia`, and legacy `trivia_night` events to `casual`.
2. Drops the eight unused session tables.
3. Drops `speed_dating_rounds`, `speed_dating_minutes`, `trivia_question_count`, and `trivia_categories` from `club_events`.

The user explicitly approved the irreversible deletion. Direct database verification returned:

| Check | Result |
| --- | --- |
| Retired tables remaining | `0` |
| Retired `club_events` columns remaining | `NULL` |
| Retired event-type records remaining | `0` rows |

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Pass — `pnpm exec tsc --noEmit` |
| Focused Club Event regressions | Pass — 5 files / 54 tests |
| Source removal scan | Pass — no removed runtime identifiers in `client/src`, `server`, `shared`, or `tests` |
| Migration integrity | Reviewed before execution; applied after explicit confirmation |

## Note

`pnpm db:migrate` remains unable to establish the pre-existing migration ledger because it attempts to replay already-created legacy tables. The reviewed retirement migration was therefore applied once through the configured database connection, then verified directly. No migration history was deleted or rewritten.
