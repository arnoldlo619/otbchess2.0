# AGENTS.md — ChessOTB.club Agent Guide

## Product identity

ChessOTB.club is an over-the-board chess operations platform, not just a chess UI. The product centers on club organizers, tournament directors, players, and spectators who need reliable live tournament flow, club/event pages, matchup prep, live board broadcasts, and post-event analysis.

Primary product promises:

- Make OTB tournament management simple on phones and laptops.
- Keep directors in control during registration, pairings, results, timers, and standings.
- Give players clear public views, board assignments, prep tools, and game history.
- Help clubs publish profiles, events, meetups, leagues, messages, and leaderboards.
- Preserve graceful fallback behavior when network, external APIs, push, camera/CV, or Bluetooth boards fail.

## Non-negotiable repo rules

- Do not change production code when the task is documentation-only.
- Do not wrap imports in `try/catch` blocks.
- Prefer narrow, typed, testable changes over broad rewrites.
- Preserve existing local-first behavior: many flows intentionally write to `localStorage` first and sync with server APIs opportunistically.
- Do not remove demo-mode behavior unless explicitly asked; demo mode is used by tests and product previews.
- Avoid changing public route paths casually. Routes in `client/src/App.tsx` are product URLs and likely linked externally.
- Avoid introducing client-only secrets. Server secrets belong in environment variables and server modules only.
- Use `rg` instead of recursive `grep`; do not use `ls -R` in this repository.
- If changing UI in a runnable flow, run relevant tests and, when practical, capture a screenshot of the visible change.

## Engineering workflow

Recommended checks after code changes:

```bash
pnpm check
pnpm test
pnpm lint
pnpm build
```

For focused work, prefer the closest existing Vitest file under `client/src/__tests__`, `client/src/components/__tests__`, `client/src/lib/__tests__`, `server/__tests__`, or `tests/` before running the full suite.

## Architecture guardrails

- Frontend is a Vite + React SPA rooted in `client/`, with routes declared in `client/src/App.tsx` via `wouter`.
- Backend is Express in `server/index.ts`, mounted into Vite during development and bundled separately for production.
- Shared database schema lives in `shared/schema.ts` and Drizzle migrations live in `drizzle/`.
- Database access goes through `server/db.ts` and requires `DATABASE_URL`.
- Auth is JWT-based in `server/auth.ts`, with both httpOnly cookie and bearer-token support. Guest sessions exist and are intentionally more restricted than full accounts.
- Styling is Tailwind CSS v4 with custom tokens in `client/src/index.css`, plus shadcn/Radix-style primitives in `client/src/components/ui/`.
- The product uses several external systems: Chess.com, Lichess, Stripe, web push/VAPID, SMTP/email, file uploads, Stockfish assets, camera/CV processing, and Chessnut board integration.

## Data and state rules

- Treat `localStorage` as an intentional offline/local-first layer for tournament registry, director state, player registrations, club registry, and club events.
- Treat server APIs and TiDB/MySQL as the durable cross-device layer where implemented.
- When adding fields to persisted JSON blobs, maintain backward compatibility and test old data shapes.
- When adding database tables or columns, update `shared/schema.ts`, generate/add Drizzle migrations, and keep server route validation aligned.
- Never store plaintext passwords, tokens, VAPID private keys, Stripe secrets, SMTP secrets, or database URLs in the client.
- Be careful with full director-state JSON blobs; they can be larger and schema-looser than normalized tables.

## Tournament/director rules

- Tournament mode is the highest-reliability surface. Avoid regressions in registration, pairings, standings, timers, public links, print/export, and result reporting.
- Swiss, double-Swiss, and elimination/bracket behavior are covered by existing utilities and tests; use them rather than inventing new pairing logic in page components.
- Director-only actions should stay guarded by director sessions and/or authenticated routes where server-backed.
- Player and spectator views must remain readable on mobile and under poor network conditions.
- SSE and push notification flows should fail soft: no UI should become unusable because live updates are unavailable.

## Club/event rules

- Clubs include public profile pages, owner/admin dashboard flows, members, events/meetups, RSVPs, feed items, linked tournaments, leagues, messages, invites, battles, and leaderboard surfaces.
- Club event data currently bridges localStorage and server APIs; keep merge/sync behavior predictable.
- Owner/admin controls should not leak to normal members or guests.
- Preserve public-facing club pages as marketing/community surfaces, not only admin tools.

## Matchup prep and openings rules

- Matchup prep depends on external Chess.com/Lichess data, caching, and derived analysis. Expect partial data and upstream rate limits.
- Do not block the UI entirely when upstream profile/game APIs are unavailable.
- The openings library and repertoire builder have their own docs (`OPENINGS_ARCHITECTURE.md`, `OPENINGS_CATALOG.md`, `OPENINGS_LINE_PACKS.md`); consult them before modifying openings data or training flows.
- Stockfish and heavy analysis assets should stay lazily loaded or server-side where possible.

## Design rules

- Follow the existing “Board Room” direction: spacious layouts, deep forest green brand, chess.com-inspired board green, cream accents, strong mobile clarity, and one primary action per screen.
- Prefer existing UI primitives from `client/src/components/ui/` and shared product components in `client/src/components/`.
- Preserve dark-mode support. `ThemeProvider` defaults to dark and many pages use custom light/dark token branches.
- Mobile tournament/director views are product-critical; do not design only for desktop.
- Keep accessibility in mind: buttons should be buttons, labels should remain associated with inputs, and contrast must remain adequate in both themes.

## Testing expectations by area

- Tournament/pairing work: run Swiss/elimination/director/tournament lifecycle tests.
- Club/event work: run club registry, club event, club dashboard/profile, RSVP, ownership, invite/message tests as relevant.
- Matchup prep/openings work: run prep engine, matchup prep, openings catalog/schema, explorer fallback, and repertoire tests as relevant.
- Auth/billing/admin work: run auth flow, guest mode, pro upgrade/billing, staff/admin tests as relevant.
- Hardware/CV/live-board work: run Chessnut, broadcast, live notation, CV pipeline, and recording tests as relevant.

## Deployment assumptions

- Production build runs `vite build` into `dist/public` and bundles `server/index.ts` into `dist/index.js` with esbuild.
- Production start command is `NODE_ENV=production node dist/index.js`.
- Express serves static SPA assets from `dist/public` and falls back to `index.html` for SPA routes.
- Required production environment varies by feature but generally includes `DATABASE_URL`, `JWT_SECRET`, and optionally Stripe, VAPID, SMTP/email, storage, and CV-related configuration.
