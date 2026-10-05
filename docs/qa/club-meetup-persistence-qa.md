# Club Meetup Persistence QA

**Date:** 2026-10-05  
**Scope:** Club Meetup creation with an uploaded cover image

## Incident assessment

The reported flow created a browser-local Club Event before the API request completed. The Meetup cover-image path produced a base64 data URL up to roughly 800 KB, but the default Express JSON parser capped ordinary requests at 512 KB. `POST /api/clubs/:clubId/events` was not exempted from that global cap, so image-bearing Meetup requests could be rejected before the Club Event route ran.

The UI then retained and navigated to the local-only event while the asynchronous write emitted an error. That produced the contradictory combination shown in the report: a visible event plus a failed-sync notice. A global API notifier could also appear alongside the local sync notifier.

## Resolution

- Routed Club Event POST bodies through a dedicated, bounded **7 MB** parser instead of the 512 KB default.
- Validated event metadata and cover payloads on the server.
- Accept only JPEG, PNG, or WebP cover data URLs up to **5 MB** decoded size.
- Move accepted cover bytes to managed object storage and persist only the resulting `/manus-storage/...` URL in `club_events`.
- Made all live Club Event creation surfaces await a canonical server response before closing, navigating, refreshing, or posting activity:
  - Club Meetup wizard
  - Club Dashboard event modal
  - Club Profile event form
- Made Club Event creation idempotent by event ID, so a completed request retried after a lost response returns the existing canonical event rather than failing or duplicating it.
- Kept local registry factories for legacy/test/offline draft usage only; production creation uses the explicit persisted APIs.
- Prevented duplicate notices: the local form shows validation/access feedback, while the existing global notifier remains the only notice for transport and server failures.

## Validation

| Check | Result |
|---|---:|
| Focused Event/API/Meetup Vitest suites | 44 passed / 4 files |
| TypeScript | Passed |
| Changed-file ESLint | 0 errors; existing warnings only |
| Project lint | 0 errors; 234 established warnings |
| Production build | Passed |
| Runtime 650,115-byte Event JSON request | Passed parser and reached auth (401, not 413) |
| Cover storage API regression | Passed |
| Idempotent repeat-create API regression | Passed |

## Remaining limitation

Authenticated browser QA cannot be executed in this sandbox because it does not hold a real private-club owner session. The success path is covered by direct server-route tests, live parser verification, and the production client contract. No production club records were created or changed during verification.
