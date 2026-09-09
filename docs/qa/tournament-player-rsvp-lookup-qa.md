# Tournament Participant and RSVP Lookup QA

## Root cause

The Chess.com proxy intentionally returns a flattened provider profile with a sibling `stats` object. Tournament participant addition and RSVP spreadsheet import still expected the older nested `{ profile, stats }` response, allowing `profile.name` access to throw when a valid Chess.com lookup completed.

## Repair

The shared `normalizeChessComPlayerPayload` helper accepts the current flattened payload and the prior nested payload for rolling-deployment safety. It validates a usable username before returning any profile data, producing an actionable provider-response error rather than an undefined-property exception. The director add-player modal, RSVP importer, reusable Chess.com profile hook, and player profile sheet now use this same contract.

## Verification

- Live `GET /api/chess/player/hikaru` returned the expected flattened profile, including `name`, `username`, and `stats`.
- Participant addition and RSVP import helper regressions each resolve the flattened response into a named, rated Chess.com player.
- The focused suite passed 59 tests across director roster behavior, RSVP rate limiting, payload normalization, and both lookup flows.
- TypeScript, changed-file lint, diff integrity, and clean development-server restart passed.
