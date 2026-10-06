# Chess.com Rating Lookup QA

**Scope:** Tournament Add Player, RSVP spreadsheet import, and QR Join profile lookup

## Resolution contract

All Chess.com registration paths now use `client/src/lib/chessComPlayerPayload.ts` for parsing and rating selection.

| Situation | Resolved pairing rating |
| --- | --- |
| Rapid present | Rapid |
| Rapid unavailable, Blitz present | Blitz |
| Rapid/Blitz unavailable, Bullet present | Bullet |
| Rapid/Blitz/Bullet unavailable, Daily present | Daily |
| No finite positive provider rating | `1200` |
| Blitz tournament with Blitz present | Blitz |
| Blitz tournament without Blitz | Rapid → Bullet → Daily → `1200` |

Only finite, positive numeric provider values are eligible. Missing, zero, negative, string, and non-finite values are treated as unavailable.

## Coverage

- `chessComRatingResolver.test.ts`
  - Four-category extraction
  - Malformed/zero/negative/non-finite normalization
  - Rapid → Blitz → Bullet → Daily → 1200 fallback
  - Blitz-preferred tournament fallback
- `tournamentChessComLookupFlows.test.ts`
  - Shared versioned endpoint in Add Player, RSVP import, and QR Join
  - Daily-only account parity across all three flows
- `chessComProxy.test.ts`
  - Shared extractor usage and Daily/default fallback regression coverage

## Live verification

Performed through the active local ChessOTB proxy at `/api/chess/player/:username?v=player-v2` on 2026-10-06:

| Account | HTTP | Rapid | Blitz | Bullet | Daily |
| --- | ---: | ---: | ---: | ---: | ---: |
| `magnuscarlsen` | 200 | 2941 | 3402 | 3311 | unavailable |
| `hikaru` | 200 | 2838 | 3500 | 3346 | 2239 |
| `nemsko` | 200 | 2114 | 2293 | 2577 | unavailable |

These requests only read public provider data; no tournament records were created or changed.

## Validation

- Focused Vitest: **31 passing** tests across 3 suites
- TypeScript: passed (`pnpm exec tsc --noEmit`)
- Changed-file ESLint: **0 errors**, 4 established Join warnings
- Project ESLint: **0 errors**, 234 established warnings
- Production build: passed
- Local and public tournament route health: HTTP 200
- `git diff --check`: passed
