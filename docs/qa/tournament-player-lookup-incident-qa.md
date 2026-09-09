# Tournament Player Lookup Incident QA

## Live reproduction setup

The public QR-style join route at `/join?code=OTB2026` loads successfully into the mobile-first tournament-code entry step. It exposes the tournament-code field, **Try the demo → OTB2026** action, QR scanner action, and disabled-until-valid Continue control. No Chess.com profile lookup runs at this stage; the next reproduction step is the username entry after code resolution.

## Production-component Add Player check

The temporary development-only harness mounted the same production Add Player modal used by the Director. A live `Hikaru` lookup returned the real profile card, including **GM Hikaru Nakamura**, `@hikaru`, and Rapid/Blitz ratings, without a runtime error. The modal’s normal **Add to Tournament** action completed and added one in-memory player in the isolated session. This proves the current preview’s mounted component and live proxy path do not reproduce the historical `undefined.name` failure.

## Root cause and release-safety repair

Tournament registration had previously expected a legacy nested Chess.com payload while the active proxy returned a flattened profile plus sibling `stats`. The shared normalizer repaired that contract, but profile lookups were still eligible for the service worker’s generic API cache and an older browser tab could retain an earlier lazy-loaded modal bundle. That combination could replay a stale response or old consumer against the current proxy during a rolling deployment.

The release candidate makes the player endpoint versioned (`v=player-v2`), returns it with `Cache-Control: no-store`, and upgrades the service-worker cache namespace to `v6`. The service worker now always uses the network with `cache: "no-store"` for `/api/chess/player/*`. Director Add Player, RSVP import, and the shared QR Join profile hook all use the same versioned endpoint and response normalizer.

## Final evidence

- Live `GET /api/chess/player/hikaru?v=player-v2` returned `200`, `Cache-Control: no-store`, `Hikaru Nakamura`, Rapid `2838`, and Blitz `3400`.
- The real production Add Player component looked up Hikaru, rendered the profile and ratings, and completed its normal in-memory roster callback without a runtime exception.
- The real production RSVP importer accepted a controlled one-row spreadsheet, resolved Hikaru as **Ready** with the same ratings, and completed its import callback without a runtime exception.
- QR Join uses the identical versioned `fetchFromChessCom` helper; its direct regression covers the normalized profile and route contract without creating a real participant registration.
- Focused player-proxy, payload-normalization, director, RSVP, and QR lookup regressions passed: **53 tests**. The full suite reports five unrelated pre-existing test files (Opening Forecast source contracts and a Club Dashboard form-label audit); the tournament lookup and service-worker contracts pass.
