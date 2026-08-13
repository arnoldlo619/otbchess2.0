# Lichess Population Archive Operations

The public web process never downloads or parses a Lichess archive. The local dataset begins in `pending` status and remains unpublished in the managed application runtime. The approved batch environment must set all three controls below before it may stage one preselected archive.

| Control | Required value | Purpose |
|---|---|---|
| `POPULATION_INGESTION_APPROVED` | `1` | Explicit operator approval per run |
| `POPULATION_INGESTION_ENV` | `batch` | Prevents execution from the autoscaling web process |
| `POPULATION_INGESTION_MAX_ARCHIVE_BYTES` | Exact bounded byte budget | Refuses archives beyond the declared budget |

The worker must discover `list.txt` and `sha256sums.txt` only from the official HTTPS `database.lichess.org/standard/` endpoints, accept their strict filename/checksum intersection, stream to a staging area, verify SHA-256 before decompression, parse line-by-line, filter standard rated games only, retain only aggregates for active tracked positions, validate counters, and publish atomically only after the entire selected month succeeds. Failed staging output must remain unavailable to user queries; rollback selects the prior published dataset version. No raw PGN, player identity, game identifier, clock data, or archive path may be stored in aggregate or response tables.
