# OTB Chess — Project TODO

## Core Platform

- [x] Tournament creation wizard (name, format, rounds, time control, venue, date)
- [x] Tournament registry (localStorage persistence, invite code generation)
- [x] Director Dashboard — result entry per board
- [x] Director Dashboard — Swiss pairing engine (generateNextRound)
- [x] Director Dashboard — live standings with Buchholz tiebreaks
- [x] Director Dashboard — round progress tracker
- [x] Director Dashboard — pause/resume tournament
- [x] Director Dashboard — player search, filter, sort in Players tab
- [x] Director Dashboard — QR modal with real invite code
- [x] Director Dashboard — remove player button
- [x] Director Dashboard — complete tournament CTA (View Results / Print)
- [x] Director Dashboard — real venue/date/time control in sidebar Event Info
- [x] Director Dashboard — End Tournament button wired to completeTournament()
- [x] Director Dashboard — Bell/Announce button copies join link

## Join Flow

- [x] Join page — QR code / invite code entry
- [x] Join page — chess.com username lookup with ELO fetch
- [x] Join page — confirm step with tournament details
- [x] Join page — success step with ELO count-up animation
- [x] Join page — cross-tab registration (storage event → Director Dashboard)
- [x] Join page — "New" badge on recently joined players in Director Dashboard
- [x] Join page — resolveTournament() handles both invite codes and slugs
- [x] Join page — displays real tournament name/venue/format from registry
- [x] addPlayerToTournament initializes state for brand-new tournaments

## Spectator & Print Views

- [x] Tournament spectator view — wired to real localStorage data via useDirectorState
- [x] Tournament spectator view — falls back to DEMO_TOURNAMENT for demo route
- [x] Print view — wired to real tournament data (WallChart, StandingsTable, PairingSlips)
- [x] Print view — falls back to DEMO_TOURNAMENT for demo route

## Archive Page

- [x] Archive page — shows curated historical tournaments
- [x] Archive page — "Your Tournaments" section showing real user tournaments from registry
- [x] Archive page — UserTournamentCard with Manage/View links

## Landing Page

- [x] Landing page — hero, stats bar, how it works, features, showcase, player demo, testimonials, CTA, footer
- [x] Landing page — nav links smooth-scroll to section IDs (Features, How It Works, For Clubs, Pricing)
- [x] Landing page — footer links use real hrefs (no more toast stubs)
- [x] Landing page — Sign In button opens tournament wizard
- [x] Landing page — Start a Tournament button in Showcase section

## Global Polish

- [x] 404 page — redesigned to match OTB Chess design system (green/dark theme)
- [x] 404 page — quick links to Join, Archive, Demo Tournament
- [x] All "Feature coming soon" toast stubs replaced with real actions
- [x] Report Issue link uses mailto: in Tournament spectator view

## Tests & Quality

- [x] Vitest setup (vitest.config.ts, test script in package.json)
- [x] 18 unit tests passing — Tournament Registry, Player Registration, Swiss Engine, loadTournamentState
- [x] TypeScript: 0 errors across entire codebase

## Post-Tournament Performance Reports

- [x] Performance stats computation engine (computePerformanceStats per player)
- [x] PlayerStatsCard component — shareable visual card (social media optimized)
- [x] TournamentReport page — full report with all player cards
- [x] Wire report into Director Dashboard post-tournament CTA
- [x] Wire report into Archive page UserTournamentCard
- [x] Canvas-based PNG export for social media sharing
- [x] Add /tournament/:id/report route to App.tsx
- [x] Unit tests for performance stats computation (18 tests, all passing)

## Avatar Enhancement

- [x] Build useChessAvatar hook (chess.com API fetch, sessionStorage cache, fallback)
- [x] Integrate avatar into PlayerStatsCard (photo ring, shimmer loading, initials fallback)
- [x] Integrate avatar into Director Dashboard player list (registration panel + Players tab)
- [x] Integrate avatar into Join page success step
- [x] PlayerAvatar reusable component (shimmer skeleton, initials fallback, verified badge)

## Wall Chart & Cross-Table

- [x] Cross-table component (N×N player vs. player results grid with scores)
- [x] Round-by-round pairings timeline component
- [x] PNG export for wall chart section
- [x] Integrate into Report page with tab navigation (Cards / Cross-Table / Rounds)

## Lichess API Integration

- [x] Build useLichessProfile hook (API fetch, rating, title, avatar, caching)
- [x] Add platform toggle (chess.com / Lichess) to Join page username step
- [x] Wire useLichessProfile into Join page alongside useChessComProfile
- [x] Update PlayerAvatar to support Lichess flair emoji and platform badges
- [x] platform/avatarUrl/flairEmoji stored on Player object

## Player Profile Hover Card

- [x] PlayerProfileCard component (avatar, rating, title, country, W/D/L, color history, recent form)
- [x] Wire into Director Dashboard Players tab list rows
- [x] Wire into Director Dashboard Boards tab (white/black player names in BoardCard)
- [x] Smooth enter/exit animation, smart positioning (flip when near viewport edge)
- [x] useRatingHistory hook — chess.com archive walk + Lichess NDJSON games API, sessionStorage cache
- [x] SVG sparkline with smooth cardinal spline, area fill, result-coloured dots, endpoint label
- [x] Trend badge (+N / -N / ±0) in sparkline section header
- [x] Shimmer skeleton while rating history is loading
- [x] 17 unit tests for sparkline data helpers (ratingToY, computeTrend, formatTrend, countResults)

## Share Results Feature

- [x] Add optional phone/email fields to Player type
- [x] ShareResultsModal component — WhatsApp and email broadcast flows
- [x] Pre-filled WhatsApp deep-links (wa.me) with player stats message
- [x] Pre-filled mailto deep-links with player stats email
- [x] Broadcast All mode — list all players with individual Send buttons
- [x] Single-player mode — triggered from per-card hover overlay
- [x] Copy message to clipboard per player and Copy All button
- [x] Channel toggle (WhatsApp / Email) with distinct colour themes
- [x] Share Results button in Report page header (cards tab)
- [x] "Send via WhatsApp / Email" button in per-card hover overlay
- [x] Report URL auto-populated from window.location.href
- [x] 26 unit tests for message generators and URL builders

## Sparkline Tooltip

- [x] formatDate helper (Unix-ms \u2192 "Mon DD" string)
- [x] useState activeIdx to track hovered dot index
- [x] Invisible enlarged hit-target circles (r=10) over each dot for easy hover
- [x] Dot grows on hover (r 2\u21924) with CSS transition
- [x] Vertical dashed crosshair line on active dot
- [x] Floating tooltip via SVG foreignObject (rating, date, result label)
- [x] Tooltip flips left when near right edge of sparkline
- [x] Tooltip y clamped to never go above SVG top
- [x] Endpoint rating label hidden while a dot is active
- [x] 19 unit tests for formatDate, tooltipX, tooltipY, resultLabel

## Sparkline Time-Control Filter

- [x] TimeControl type exported from useRatingHistory ("all" | "bullet" | "blitz" | "rapid" | "classical")
- [x] RatingPoint extended with timeControl field
- [x] classifyChessComTC helper (time_class field + time_control string fallback)
- [x] classifyLichessPerf helper (perf field, case-insensitive, ultraBullet support)
- [x] Hook fetches count*4 games to fill all TC buckets; client-side filter + slice(-count)
- [x] Cache key bumped to v2 to avoid stale entries without timeControl field
- [x] TCPill component (All / Rapid / Blitz / Bullet) with active/inactive styles
- [x] SparklineSection holds tc state; passes timeControl to useRatingHistory
- [x] Empty-state message is TC-aware ("No blitz games in the last 10 games")
- [x] 35 unit tests for classifyChessComTC, classifyLichessPerf, filterPoints

## Full-Screen Tournament Creation Wizard Redesign

- [x] Full-screen overlay (fixed inset-0) replacing the cramped modal
- [x] Thin top progress bar (4 segments, animated fill)
- [x] Two-column layout: left hero panel (step context) + right input panel
- [x] Step 1 — Details: large name input hero, venue/date/description below
- [x] Step 2 — Format: large format cards with icons, rounds/players as big tap targets
- [x] Step 3 — Time Control: time preset as large visual cards, custom stepper
- [x] Step 4 — Share: full-width QR + invite link, confetti
- [x] Smooth horizontal slide-in/out transitions between steps
- [x] Keyboard navigation (Enter to advance, Escape to exit)
- [x] Mobile: single-column stacked layout, bottom nav bar
- [x] Consistent with platform design system (green/white, Clash Display, OKLCH tokens)

## Phone & Email on Join Page

- [x] Add optional `phone` and `email` fields to the Player interface
- [x] Add phone and email inputs to the Join page registration form
- [x] Persist phone/email in tournament registry when player joins
- [x] Wire phone/email into ShareResultsModal for pre-filled WhatsApp/mailto links
- [x] Unit tests for phone/email field validation helpers (19 tests)

## Manual Player Entry & Start Tournament

- [x] AddPlayerModal — name, platform (chess.com/lichess/manual), username, ELO lookup button
- [x] "Add Player" button in Players tab header
- [x] Persist manually-added players to tournament registry
- [x] Remove player from Players tab (with confirmation)
- [x] Start Tournament button in Director Dashboard Players tab
- [x] Confirmation dialog before starting (shows player count, rounds, format)
- [x] Tournament status transitions: lobby → active → complete
- [x] Disable Start if fewer than 2 players registered
- [x] Lock player registration once tournament is started
- [x] AddPlayerModal render call wired in Director.tsx return statement
- [x] Start Tournament confirmation dialog render wired in Director.tsx return statement
- [x] Fixed esbuild false-positive in Join.tsx (Unicode box-drawing chars replaced with ASCII)
