# ClubProfile.tsx Structure Notes

## File: 5521 lines
## Route: /clubs/:id (public) and /clubs/:id/home (owner workspace)

## Layout Architecture
- Full-height flex with sidebar + main content
- Sidebar: hidden lg:flex, absolutely positioned, icon-only rail that expands on hover
  - Width: 68px → 210px on hover
  - Contains: logo, nav tabs (feed/events/members/leagues), avatar dropdown, contact/settings buttons
  - Dark micro-grid checkered pattern background
- Main content: flex-1, overflow-y-auto, padded with lg:pl-[88px]
- ClubHero component: contained rounded banner (not full-bleed), handles public/owner actions
- ClubTabs component: horizontal pill tabs for mobile (lg:hidden)

## Tab System
- Tabs: feed | events | members | leagues
- Default: "feed"
- Deep-linking via ?tab= query param
- Legacy "tournaments" redirects to "events" with filter

## Public vs Owner Actions (already separated)
- ClubHero: public (Join/Follow/Leave) vs owner (Promo/QR/Banner upload)
- Feed tab: onboarding checklist (owner only), About card Edit button (owner/director only)
- Events tab: New Event CTA (owner/director only), edit/delete controls (owner/director only)
- Leagues tab: Create League CTA (owner/director only)

## Phase 5 Requirements for Public Club Profile
1. Avoid banner/sidebar visual collision ✓ (already solved with contained hero)
2. Hero belongs to content surface ✓ (ClubHero is in-content, not full-bleed)
3. Tabs: Home, Feed, Events, Tournaments, League, Members, About
4. Public/owner actions clearly separated ✓ (already done)
5. Long names + missing imagery must not break layout ✓ (ClubHero handles)
6. Tabs work on mobile without overflow ✓ (ClubTabs has overflow-x-auto scrollbar-none)

## What Needs to Change
- Phase 5 spec wants tabs: Home | Feed | Events | Tournaments | League | Members | About
- Current tabs: feed | events | members | leagues
- Need to add: "home" (overview), "about" (separate from feed), possibly split "tournaments" from "events"
- The spec says "Use tabs or sections such as" — so current 4-tab model is acceptable if content is well-organized
- Main issues to fix:
  1. The sidebar visually collides with content on some viewports (spec concern)
  2. Need a "Home" overview tab with upcoming events + recent activity
  3. About section should be accessible as its own tab/section, not buried in feed
  4. Members/leaders section needs privacy-aware display

## Key Components Used
- ClubHero (components/club/ClubHero.tsx) — contained hero with all identity/actions
- ClubTabs (components/club/ClubTabs.tsx) — horizontal pill tabs
- SurfaceCard (components/club/SurfaceCard.tsx) — reusable rounded container
- ShaderBackground — animated shader for clubs without custom banner
- Various modals: EditClubDetailsModal, ClubShareModal, ClubPromoModal, ClubQRProjectionModal, ContactOwnerModal, TournamentWizard

## Decision
The existing ClubProfile is already well-structured with:
- Contained hero (no full-bleed collision)
- Clear public/owner separation
- Mobile-friendly tabs
- Rich content per tab

The main improvements needed:
1. Add a "home" tab as default (overview: about snippet + upcoming events + recent feed)
2. Move "About" to be accessible from home tab or as its own section
3. Ensure the sidebar doesn't visually collide on medium viewports
4. Add "About" tab for contact info, social links, meeting schedule
5. Keep the existing tab content (feed, events, members, leagues) largely intact
