# ARCHITECTURE.md — ChessOTB.club Repository Architecture

## Overview

ChessOTB.club (`otbchess2.0`) is a TypeScript monorepo for a React single-page application plus an Express API server. It supports local-first OTB tournament management, club/community pages, matchup prep from online chess profiles, openings study, live board/broadcast workflows, game recording/analysis, leagues, billing, and admin tooling.

## Tech stack

### Client

- React 19 with TypeScript.
- Vite 7 as dev server and production client bundler.
- `wouter` for SPA routing.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Radix UI/shadcn-style primitives in `client/src/components/ui/`.
- `sonner` for toasts, `lucide-react` for icons, `framer-motion` for selected animations.
- Chess-specific libraries/assets include `chess.js`, `react-chessboard`, Stockfish files under `client/public/stockfish/`, and Chessnut board utilities.

### Server

- Express 4, TypeScript, bundled with esbuild.
- Drizzle ORM with MySQL dialect, using `mysql2/promise` against `DATABASE_URL` (documented as TiDB Cloud in code comments).
- JWT authentication with bcrypt password hashing.
- Web Push via `web-push` and VAPID keys.
- Stripe billing routes.
- Nodemailer/platform email routes.
- Multer/upload serving for club/media flows.
- Server-Sent Events for tournament/player/timer live updates.
- Python helpers and ONNX runtime dependencies for CV/game recording experiments.

### Shared

- Database schema and shared types live in `shared/schema.ts`.
- Drizzle migrations live in `drizzle/`.
- Shared constants live in `shared/const.ts`.

## Build, dev, and deployment

Key scripts in `package.json`:

- `pnpm dev`: starts Vite on host mode.
- `pnpm build`: runs `vite build`, then bundles `server/index.ts` to `dist/index.js`.
- `pnpm start`: runs `NODE_ENV=production node dist/index.js`.
- `pnpm check`: TypeScript check.
- `pnpm test`: Vitest test suite.
- `pnpm lint`: ESLint over client, server, and shared code.
- `pnpm db:*`: Drizzle database commands.

Development API setup is unusual but intentional: `vite.config.ts` mounts the Express app as middleware for `/api` and `/manus-storage`, so one Vite process serves both SPA and backend routes during development. Production Express serves static files from `dist/public` and falls back to `index.html` for unknown routes.

## Routing

Routes are centralized in `client/src/App.tsx`. Page components are lazy-loaded with React `Suspense`, which keeps the initial bundle smaller.

Major route groups:

- Home and generic pages: `/`, `/404`, `/pricing`, `/pro/success`.
- Tournament/player/director views: `/tournament/:id`, `/tournament/:id/manage`, `/tournament/:id/play`, `/tournament/:id/print`, `/tournament/:id/report`, `/tournament/:id/results`, `/tournament/:id/clock`, `/live/:slug`.
- Registration/access: `/join`, `/join/:code`, `/director-access`.
- Clubs/events: `/clubs`, `/clubs/:id`, `/clubs/:id/home`, `/clubs/:clubId/meetup/:eventId`, `/checkin/:eventId`, `/clubs/:id/messages`, `/clubs/leaderboard`, `/invite/:token`.
- Broadcast/live boards: `/tournament/:id/broadcast-console`, `/tournament/:id/connect-board`, `/tournament/:id/broadcast/:boardNumber`, `/live/board/:slug`, `/live/board/:slug/display`.
- Leagues: `/league/new`, `/league-demo`, `/leagues/:leagueId`, `/leagues/:leagueId/history`.
- Prep/openings/repertoire: `/prep`, `/prep/:username`, `/openings`, `/openings/:slug`, `/openings/:openingSlug/study/:lineSlug`, `/repertoire`, `/repertoire/:id`.
- Games/recording: `/games`, `/record`, `/record/camera`, `/game/join/:token`, `/game/:gameId/analysis`, `/otb/leaderboard`.
- Admin: `/admin/staff`, `/admin/openings`, `/dashboard/tools/chessnut-bluetooth-test-lab`.

## Client structure

- `client/src/main.tsx`: React entry point.
- `client/src/App.tsx`: providers, lazy page imports, route table, global loading fallback.
- `client/src/pages/`: route-level screens. Several pages are large feature workspaces, especially `Director.tsx`, `Tournament.tsx`, `ClubProfile.tsx`, `LeagueDashboard.tsx`, and `MatchupPrep.tsx`.
- `client/src/components/`: reusable product components such as tournament panels, club modals, live board widgets, broadcast panels, charts, nav, and game-analysis cards.
- `client/src/components/ui/`: reusable UI primitives and design-system components.
- `client/src/lib/`: client utilities and local-first data modules, including tournament state, club registry, club events, API wrappers, Swiss pairing utilities, exports, and broadcast helpers.
- `client/src/hooks/`: reusable React hooks for timers, game history, push/PWA behavior, swipe gestures, visibility sync, and chess-specific flows.
- `client/src/context/` and `client/src/contexts/`: providers such as auth and theme.
- `client/src/data/`: demo/openings data used by client features.
- `client/public/`: static assets including service worker, manifest, Stockfish builds, and CV worker.

## Server structure

- `server/index.ts`: main Express app factory, global middleware, route registration, tournament APIs, SSE, push routes, proxy routes, static serving, and production listener.
- `server/auth.ts`: auth router and auth middleware (`requireAuth`, `requireFullAuth`).
- `server/db.ts`: Drizzle/MySQL connection singleton.
- Feature routers/modules:
  - `server/clubs.ts`, `server/clubInvites.ts`, `server/clubMessaging.ts`, `server/clubBattles.ts`.
  - `server/leagues.ts`.
  - `server/recordings.ts`, `server/otbGames.ts`, CV queue/worker files.
  - `server/openingsPublic.ts`, `server/openingsAdmin.ts`, `server/repertoireBuilder.ts`.
  - `server/billing.ts`, `server/adminStaff.ts`, `server/email.ts`, `server/platformEmail.ts`.
  - `server/broadcasts.ts`, `server/publicSnapshot.ts`, `server/storageProxy.ts`.
  - `server/prepEngine.ts`, `server/prepAnalysisEngine.ts`, `server/openingDetection.ts`.

## Data flow

### Local-first tournament flow

Tournament creation and mutable director state are local-first:

1. Tournament config is stored in `client/src/lib/tournamentRegistry.ts` under versioned `localStorage` keys.
2. Mutable pairings/results/standings state is stored through `client/src/lib/directorState.ts` under per-tournament versioned keys.
3. `useDirectorState` hydrates from `localStorage`, then attempts to fetch `/api/tournament/:id/state` and only replaces local state if server data is newer.
4. Changes are saved back to `localStorage` and fire-and-forget synced to the server with `PUT /api/tournament/:id/state`.
5. Player registration uses both local helpers and server endpoints (`/api/tournament/:id/players`) where available.
6. Public/player views subscribe to SSE streams for player joins, timer updates, and tournament starts.

### Server-backed persistence

Server persistence uses Drizzle tables from `shared/schema.ts`. Key examples include users, tournament players, tournament state JSON, push subscriptions, tournament analytics, saved prep reports, chess player cache, clubs/events/leagues/messages, recordings, broadcasts, and billing/admin-related rows.

### External chess data

Chess.com and Lichess calls are proxied server-side to avoid browser restrictions and improve caching/retry behavior. Prep reports are built by server engines and cached in database tables where implemented.

### Push and live updates

- Web Push subscriptions are stored per tournament.
- VAPID keys are read from environment variables.
- SSE subscribers are kept in in-memory maps in `server/index.ts`; this means live connection state is per-process and not shared across multiple server instances.
- Timer snapshots are also held in memory for fast reconnect behavior, with database-backed tournament state used separately.

## Auth assumptions

- Full users register/login with email and password; passwords are bcrypt-hashed.
- JWTs are signed with `JWT_SECRET`.
- Tokens are set as httpOnly cookies and can also be sent as bearer tokens by the SPA.
- Guest sessions exist, expire sooner, and are rejected by `requireFullAuth` for actions that need a full account.
- Many older/local-first flows still rely on localStorage identity or director-session markers; do not assume every UI action is fully server-authorized unless the route uses auth middleware and ownership checks.
- Pro/staff/subscription fields live on the user row and billing routes integrate Stripe.

## Styling system

The design system is defined mostly in `client/src/index.css`:

- Tailwind CSS v4 `@theme inline` maps CSS variables to Tailwind tokens.
- Brand tokens include deep forest green, chess-board green, cream, sage, dark-mode surfaces, dropdown tokens, chart tokens, border/input/ring tokens, and radius tokens.
- The stated design philosophy is “The Board Room”: Apple-like minimalism plus Chess.com green, radical whitespace, one primary action per screen, and strong illustration/visual hierarchy.
- UI primitives in `client/src/components/ui/` are the preferred base for new reusable controls.
- Many major pages also define local token maps to support bespoke dark/light hero layouts.

## Component and feature boundaries

The repository currently mixes mature shared utilities with very large route components. Good boundaries to respect:

- Put reusable UI in `client/src/components/` or `client/src/components/ui/`.
- Put pure tournament logic in `client/src/lib/` and cover it with tests instead of embedding it in page JSX.
- Put server feature logic in focused modules/routers rather than expanding `server/index.ts` further where possible.
- Use `shared/schema.ts` for cross-cutting database shape; do not duplicate DB table definitions.

## Deployment/environment setup

Minimum production environment:

- `DATABASE_URL` for MySQL/TiDB via Drizzle.
- `JWT_SECRET` for auth.
- `NODE_ENV=production` for production cookie/security and static serving behavior.

Feature-specific optional environment:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for Web Push.
- Stripe keys/webhook secret for billing.
- SMTP/platform email credentials for email flows.
- Any storage/proxy settings used by upload/media flows.
- CV/ONNX/Python runtime support for game-recorder and video-analysis workflows.

## Important architectural risks

- `server/index.ts` is very large and owns many unrelated concerns; future server changes should prefer feature routers.
- Several client pages are thousands of lines long; extracting logic/components would reduce regression risk.
- The app straddles localStorage and server persistence; conflict resolution and stale data are recurring risks.
- SSE/timer state is in memory and therefore single-process oriented.
- Some guardrails are local-first or UI-level, so security-sensitive flows need server-side ownership checks before becoming production-critical.
- External data dependencies (Chess.com, Lichess, Stockfish, push, Stripe, SMTP, CV, Bluetooth) require graceful degradation and focused tests.
