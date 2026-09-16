# Club-Linked Tournament Events Synchronization QA

## Scope

Repair the missing Club Events dashboard record when a Tournament Wizard creation is linked to a club.

## Verified behavior

- The Tournament Wizard creates an idempotent, canonical server-backed `ClubEvent` for every club-linked tournament and returns its event ID to the originating club surface.
- The Club Event API rejects attempts to link one tournament to a different Club Event and broadcasts `event_created` after creation.
- The Club Dashboard refreshes the canonical event list when it receives that broadcast.
- Existing locally linked tournaments are backfilled once when the club owner opens the Club Dashboard, making the canonical event available to all members thereafter.
- Club Profile and Club Dashboard no longer navigate to a local-only fallback event when the server-backed creation path is unavailable.

## Automated validation

- `clubEventRegistry.test.ts`, `clubLinkedTournamentEventSync.test.ts`, `tournamentClubLinking.test.ts`, and `tournamentWizardSegmentedOnboarding.test.ts`: 43 tests passed.
- TypeScript passed.
- Changed-file lint completed with zero errors; existing warnings remain in legacy Club dashboard surfaces.
- Full suite has no failures in the Club Event synchronization scope; established unrelated source-contract failures remain documented separately.

## Visual validation boundary

The local `stanford-chess-team` dashboard route redirected to public club discovery because the current browser session is not an authorized member. No club or event data was changed during this review. The repaired live owner/member behavior is protected by the server bridge and event-refresh regression coverage above.
