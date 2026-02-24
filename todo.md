# OTB Chess — Project TODO

## Core Platform Features
- [x] Landing page with hero section, features, ELO demo, testimonials
- [x] Tournament View with boards/standings/players tabs and mobile responsiveness
- [x] Director Dashboard with result entry, live standings, Swiss pairing engine
- [x] Player Join flow with chess.com profile lookup and QR code registration
- [x] Tournament Archive page
- [x] Print View with pairing slips, wall chart, and PDF export capability
- [x] Tournament creation wizard (4-step flow: Details → Format → Time → Share)
- [x] Real chess.com API integration for live ELO lookup
- [x] Full Swiss pairing engine with score grouping, color balancing, Buchholz tiebreaks
- [x] localStorage persistence for tournament state (survives page refreshes)
- [x] Cross-tab player registration (Join page writes directly to localStorage, Director Dashboard listens for storage events)
- [x] "New" badge on recently joined players (within last 5 minutes) in Director Dashboard Players tab

## Mobile & UX Polish
- [x] Mobile responsiveness with safe area insets on all navs
- [x] Touch-target class on all interactive elements
- [x] active:scale-95 press states
- [x] Pill-style tab switchers
- [x] Compact breadcrumbs
- [x] Mobile-optimized Director dashboard header

## Future Enhancements (Suggested)
- [ ] ELO count-up animation on Join page success screen
- [ ] Tournament Archive page wired to list all created tournaments from registry
- [ ] Player-facing tournament view (spectator mode)
- [ ] Result confirmation from player devices
- [ ] Post-tournament performance reports
