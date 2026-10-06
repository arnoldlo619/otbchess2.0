# Club Event Type Taxonomy QA

**Scope:** Normalize persisted Club Event `eventType` values to support future social formats without losing existing event data.

## Canonical values

| Stored type | Purpose |
|---|---|
| `tournament` | A linked or standalone chess tournament event |
| `speed_dating` | Future rotating mini-game social event |
| `trivia` | Future chess trivia event |
| `puzzle_relay` | Future team puzzle relay |
| `casual` | Club meetups, open play, and ordinary events |
| `lecture` | Club lesson or speaker session |

## Compatibility and data migration

- `standard` and `meetup` are normalized to `casual`.
- `trivia_night` is normalized to `trivia`.
- Any event linked to a `tournament_id` is normalized to `tournament`.
- The API accepts those legacy input labels only at the compatibility boundary, stores canonical values, rejects unknown values with HTTP 400, and serializes legacy records as canonical values.
- Migration `0021_normalize_club_event_types.sql` changes the database default to `casual` and backfills existing records without deleting data.

## Database verification

The configured database reports `casual` as the new column default. Post-migration event rows are grouped only as:

| Type | Persisted rows at verification |
|---|---:|
| `casual` | 41 |
| `tournament` | 21 |

## Validation

| Check | Result |
|---|---|
| Club Event type/API/registry regressions | 47 passed across 4 files |
| TypeScript | passed with 0 errors |
| Changed-file ESLint | 0 errors; existing Dashboard warnings only |
| Database migration and type grouping | applied and verified |
| Production build | passed |
| Full Vitest baseline | 7,069 passed, 2 skipped; 31 pre-existing failures across 17 unrelated files |

Future speed-dating, trivia, puzzle-relay, and lecture experiences remain intentionally unimplemented; this checkpoint establishes their durable, validated event-type foundation only.
