# Mobile Page Patterns — Key Findings

## Common Layout Pattern Across Platform Pages
Most pages (Archive, MyClubs, ClubProfile, etc.) follow this structure:
1. Outer wrapper: `min-h-screen` + bg color
2. Sticky nav: `sticky top-0 z-40 border-b backdrop-blur-md` with `h-14` (56px)
3. Content: `max-w-5xl mx-auto px-4 sm:px-6 py-8`
4. No bottom padding for bottom nav — NEEDS ADDING

## Key Mobile Issues to Fix Across Platform Pages
1. **No bottom padding** for the new MobileBottomNav (64px + safe area)
2. **Inconsistent page gutters**: some use px-4, some px-6, some have no adaptive spacing
3. **No shared compact header component** — each page builds its own nav
4. **Typography**: headings use text-4xl/text-5xl which is fine for desktop but needs mobile scaling
5. **Grid layouts**: most use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — this is OK

## What's Already Good
- Cards have decent mobile padding (px-4 py-3)
- Grids collapse to 1-col on mobile
- Search inputs exist with decent sizing
- Sticky headers are already glassmorphic

## Priority Fixes (highest impact, least code)
1. Add `pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+1rem)]` to all page wrappers on mobile
2. Ensure page headings scale down on mobile (text-3xl instead of text-4xl/5xl)
3. Ensure touch targets on filter pills/tabs are ≥44px

## Pages That Need Bottom Padding Fix
- Archive.tsx (line ~770: `max-w-5xl mx-auto px-4 sm:px-6 py-8`)
- MyClubs.tsx (line ~997: `max-w-5xl mx-auto px-4 py-6`)
- ClubProfile.tsx, ClubDashboard.tsx, ClubManage.tsx
- Training.tsx, Profile.tsx
- LeagueDashboard.tsx, LeagueDemo.tsx
- All tournament pages (Tournament.tsx, Director.tsx, PlayerView.tsx)

## Bottom Nav Spacer Strategy
Add a global CSS rule: pages that use `.mobile-page` class get the padding automatically.
For pages that don't use the class, add `mobile-bottom-spacer` div at the end.
OR: add a global `body` padding-bottom on mobile that accounts for the bottom nav.
