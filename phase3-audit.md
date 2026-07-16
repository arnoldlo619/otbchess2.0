# Phase 3 Audit — ChessOTB.club

## Files and line counts
- Home.tsx: 2136 lines
- Pricing.tsx: 417 lines
- Blog.tsx: 510 lines
- BlogPost.tsx: 1218 lines
- Join.tsx: 1932 lines
- NotFound.tsx: 124 lines

## Current Home.tsx structure
- Nav: AnimeNavBar with logo, Clubs/Tournaments/League/Tools items, ThemeToggle + AvatarNavDropdown
- Hero: "Chess Tournaments, / Over The Board." (2-part, NOT 3-part) — NEEDS FIX to "Chess Clubs, / Chess Tournaments, / Over The Board."
- Hero CTAs: "Host Tournament" (SpinBorderButton solid), "Join a Tournament" (SpinBorderButton outline), "View live demo →" (link)
- Hero product visual: HeroDashboardMockup with dark/light screenshots from /manus-storage/
  - DARK: /manus-storage/Screenshot2026-07-09at5.47.32PM_dcaca0c6.png
  - LIGHT: /manus-storage/Screenshot2026-07-09at6.00.48PM_cf9817c3.png
- StatsBar: live API counts with floor fallbacks (tournaments: 300+, players: 550+, clubs: 80+)
- HowItWorks: 3 ParallaxStep blocks (hidden on mobile with `hidden sm:block`)
- Features: 6 DynamicSquare cards in 3-col grid
  - Swiss Pairings, QR Code Registration, Elimination Brackets, Matchup Prep, Chess Club League, Live Standings, Automated Shareable Content
- PlayerDemo: chess.com username lookup with profile card (YouTube video bg)
- Showcase: 2×2 image-dominant grid (Run a Tournament, Host a League, Club OTB Rating, Build OTB Repertoire)
- Testimonials: 3 quote cards
- CTASection: "Growing your chess club starts here." with chess-board bg
- Footer: Product/Community/Company links, ASCII art trophy backdrop

## Key Phase 3 changes needed for Home.tsx
1. Hero headline: "Chess Tournaments," → "Chess Clubs,\nChess Tournaments,\nOver The Board." (3-part)
   - Use Anton font for the primary display statement (needs to be added to index.html)
   - Geist for supporting copy (Inter is current, acceptable substitute)
2. Capabilities bento: Replace uniform 3-col Features grid with asymmetric bento
   - Groups: Tournament Operations, Clubs & Community, League, Matchup Prep, Openings & Training, Live Results & Shareable Content
   - Each card: user outcome, real interface evidence, specific CTA, accessible name
3. Ecosystem pathways: The Showcase 2×2 grid is close but needs to expand to cover all 6 groups
4. StatsBar: already has skeletons and floor values — GOOD
5. Footer: Discord/Twitter hrefs are placeholder (https://discord.gg, https://twitter.com) — need to fix or remove

## Pricing.tsx issues
- "Get Pro" button opens ProUpgradeModal even though payment isn't live
- Need to replace with "Join Waitlist" or "Get Notified" CTA
- Beta footnote exists but is buried at bottom of comparison table
- No FAQ section
- Reassurance strip is good (Free during beta, Founding member rate, No credit card)

## Blog.tsx issues
- Category filter: uses useState, no URL param, not keyboard accessible
- Featured story: first post in list, no hero treatment
- Article cards: consistent but no image loading skeleton

## BlogPost.tsx issues
- Reading width: uses max-w-4xl (too wide) — needs max-w-prose or ~65ch
- Author/date/read-time: exists but needs better visual hierarchy
- Related articles: exists but needs design polish
- Social sharing: exists (copy link, WhatsApp, Twitter)
- Product CTA: exists at end

## Join.tsx issues
- 4 steps: code → username → confirm → success
- Has QR scanning (requests camera on QR button click — GOOD)
- Step "username": has both "Look up" button AND auto-lookup on Enter — acceptable
- Tournament context: shown in header but may not persist visually through all steps
- Back navigation: exists but need to verify state preservation
- Touch targets: need audit

## NotFound.tsx
- Already clean with quick links
- Need to add error variants for: invalid tournament code, closed registration, tournament already started, player already registered, username not found, rating unavailable, network failure, rate limiting

## SEO (index.html)
- Static OG/Twitter tags exist — good baseline
- Need dynamic per-page titles/descriptions for Blog, BlogPost, Pricing, Join
- Need canonical URLs
- Need JSON-LD for BlogPost

## Font strategy
- Clash Display: loaded from Fontshare CDN (api.fontshare.com)
- Inter: loaded from Google Fonts
- Anton: NOT loaded — needs to be added to index.html if used
- Decision: Use Clash Display for the hero display statement (already loaded, consistent with design system)
  The brief says "Anton treatment" but Anton is not in the design system. Use Clash Display at max weight (700) instead.
  This preserves design system consistency without adding a new font dependency.

## Key assets (screenshots for bento cards)
- Tournament Director: https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/tournament-director_3b1b3c41.png
- League: https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/league-tight_ca26e3fd.png
- OTB Rated Game: /manus-storage/otb-rated-game-carousel_ed800e01.webp
- Matchup Prep: https://files.manuscdn.com/user_upload_by_module/session_file/117675823/ldjNZgAdszCUXLEl.webp
- QR Screen: /manus-storage/qr-screen_b1e19e90.webp
- Join Form: /manus-storage/otb-join-form_28254c54.webp
- Player Signup Confirm: /manus-storage/player-signup-confirm_b5b69600.webp
- Board assignment: /manus-storage/IMG_63952_5020b27c.jpg
- Live pairings: /manus-storage/Screenshot2026-06-25at2.25.15AM_1efe6544.png
- Hero dark: /manus-storage/Screenshot2026-07-09at5.47.32PM_dcaca0c6.png
- Hero light: /manus-storage/Screenshot2026-07-09at6.00.48PM_cf9817c3.png
- Chicago chess club photo: /manus-storage/5FE28E81-FABF-4AA3-8EC4-6C0D5A8788A5_0ff2749c.JPG
- OTB!! logo: https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png
- OG banner: https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/og-banner_131156e0.png
