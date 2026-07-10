# League Dashboard Redesign — Audit Notes

## Design Read
"Reading this as: redesign-preserve of a premium OTB chess league dashboard for club players and commissioners, with a dark-tech/sports-app language, leaning toward existing OTB design system (oklch forest green + lime accent) with improved hierarchy and density control."

## Dials
- DESIGN_VARIANCE: 6 (preserve existing identity, improve organization)
- MOTION_INTENSITY: 5 (subtle tab transitions already exist via TabTransition)
- VISUAL_DENSITY: 5 (dashboard with data, but needs breathing room)

## Current Architecture (4264 lines)
- Full-page app shell: left icon rail (desktop) + top bar + scrollable content + right sidebar + mobile bottom nav
- 7 tabs: Overview, Matchups, Standings, Schedule, History (completed only), Requests (commissioner+draft), Settings (commissioner)
- Color tokens defined inline: pageBg, cardBg, cardBorder, textMain, textMuted, accent, surfaceHover, tabBg, tabActive
- All using oklch color space, dark/light mode support

## Layout Structure
```
<div min-h-screen>
  <div flex h-[100dvh] overflow-hidden>
    <aside> LEFT ICON RAIL (hidden lg:flex, w-[60px]) </aside>
    <div flex-1 flex-col>
      <div> BRANDED TOP BAR (flex-shrink-0) </div>
      <div> GUEST/INVITE BANNERS </div>
      <div flex-1 overflow-y-auto pb-28 lg:pb-6>
        <div px-4 lg:px-6 py-4>
          <div flex flex-col lg:flex-row gap-4>
            <div flex-1> MAIN CONTENT (TabTransition wraps all tabs) </div>
            <div hidden lg:flex w-72> RIGHT PANEL (Upcoming Matchups) </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div lg:hidden fixed bottom-0> MOBILE BOTTOM NAV </div>
</div>
```

## Key Issues to Fix
1. **No league hero/header section** — jumps straight into tab content without context (league name, format, progress)
2. **Left icon rail is too minimal** — no labels, tiny icons, chess-board-bg is noisy
3. **Top bar is cluttered** — mobile title + status pill + commissioner actions all crammed
4. **No visual hierarchy between sections** — cards all look the same
5. **Right panel (Upcoming Matchups)** — useful but disconnected from main content flow
6. **Mobile bottom nav** — functional but could use better active states
7. **Tab content has no header/context** — each tab just starts with content, no section title

## Redesign Strategy
1. Add a **League Hero Header** below the top bar — league name, format badge, progress ring, season status
2. Improve **top bar** — cleaner status pill, better commissioner action grouping
3. Redesign **left icon rail** — slightly wider, add text labels on hover, cleaner dividers
4. Add **section headers** to each tab content area
5. Improve **card hierarchy** — primary cards (your match, standings) get accent borders, secondary cards are neutral
6. Polish **mobile bottom nav** — active indicator dot/bar, slightly larger touch targets
7. Add **league info card** to right panel above upcoming matchups

## Files to Edit
- `/home/ubuntu/otb-chess/client/src/pages/LeagueDashboard.tsx` (primary)
- Possibly `/home/ubuntu/otb-chess/client/src/index.css` for shared utilities

## Constraints
- Preserve ALL existing functionality (tabs, modals, API calls, state)
- Keep the same color token system (oklch)
- Keep TabTransition wrapper
- Keep mobile bottom nav (it's league-specific, not the removed global one)
