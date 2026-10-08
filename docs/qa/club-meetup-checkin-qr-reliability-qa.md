# Club Meetup Check-in QR Reliability QA

**Scope:** Full-screen Club Meetup check-in projection and the `/checkin/:eventId` scan flow.

## Root cause confirmed

The QR shown in the incident encoded `/checkin/muvv2g6k-c25lq9`. The client route itself was reachable, but the public lookup endpoint returned `404 {"error":"Event not found"}` both locally and through the public preview. A database read confirmed that no authoritative `club_events` row existed for that ID or the displayed meetup title.

This meant a host could still view a historical local event and project its QR, while a newly scanned device—without that browser's local storage—had no event to load.

## Repair

- Removed the redundant **“Press Escape to close”** and mobile close-copy from the projection header; the accessible close button remains.
- Added `ensurePersistedClubEvent(event)`, which POSTs the current event ID to the existing idempotent Club Event endpoint and refreshes the local cache with the canonical response.
- The host-facing **Check-in QR Code** action now waits for that persistence step before opening the projection. It shows an explicit **Preparing QR…** state and leaves the QR closed if persistence fails.
- The original event ID is preserved, so the newly projected QR always matches the server record and a fresh scanner can resolve `/api/clubs/event/:eventId` before authenticating to check in.

## Validation

| Check | Result |
| --- | --- |
| Incident QR client route `/checkin/muvv2g6k-c25lq9` | HTTP 200 |
| Incident QR event API before host repair | HTTP 404, confirming the missing server record root cause |
| Focused QR and event synchronization regressions | 11 passed across 2 task suites |
| TypeScript | Passed (`pnpm exec tsc --noEmit`) |
| Changed-file ESLint | Passed with no errors |
| Project lint | Passed: 0 errors, 234 existing warnings |
| Production build | Passed |
| Local `/checkin/:eventId`, `/clubs/demo`, `/league-demo` routes | HTTP 200 |
| Diff integrity | Passed (`git diff --check`) |
| Full Vitest baseline | 7,167 passed, 2 skipped, 28 unrelated legacy failures across 17 suites; no Meetup QR reliability failure |

## Operational verification after deployment

Open the affected meetup from the host browser, press **Check-in QR Code** once, and wait for the projection to appear. Scan the newly shown QR from a clean mobile browser; the event page should load, require sign-in if necessary, record the check-in, and redirect the member to that meetup page.
