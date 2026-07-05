# Mobile Responsiveness Audit Findings

## ClubProfile.tsx (Public Club Page)
### Critical Issues:
1. **Banner content has hardcoded left padding** (line 1601):
   - `paddingLeft: "calc(210px + 1.25rem)"` — this is for the sidebar avatar area on desktop
   - On mobile (below `lg`), the sidebar is hidden but this padding remains, pushing content off-screen
   - **Fix**: Make this responsive — `paddingLeft: "1.25rem"` on mobile, use the calc only on `lg:`

2. **Content below banner has responsive padding** (line 1847):
   - `className="px-4 lg:pl-[224px] lg:pr-10 xl:pl-[236px] xl:pr-14 py-5"` — this is correct, uses `px-4` on mobile

3. **No mobile top bar/header** — ClubProfile doesn't have a branded top bar with back button like ClubDashboard/LeagueDashboard
   - The AvatarNavDropdown is in the banner's top-right corner (absolute positioned)
   - No easy way to navigate back on mobile

4. **Bottom nav is present** (line 4456) — `lg:hidden fixed bottom-0` with 5 tabs
   - Has `env(safe-area-inset-bottom)` for iPhone notch ✓
   - Content has `pb-28 lg:pb-6` for bottom padding ✓

5. **h-screen vs 100dvh** (line 1405):
   - Uses `h-screen` which on mobile Safari doesn't account for the URL bar
   - Should use `h-[100dvh]` or `min-h-[100dvh]`

## ClubDashboard.tsx (Admin Club Dashboard)
### Issues:
1. **h-screen** (line 3173): Same issue — should be `h-[100dvh]`
2. **Mobile bottom nav** (line 7677): Present but no `env(safe-area-inset-bottom)` — content could be hidden behind iPhone home indicator
3. **Content padding** (line 3426): `pb-20 lg:pb-6` — may not be enough for bottom nav + safe area
4. **Mobile header** (line 3277): Has back button + title ✓
5. **Banner** uses `clamp(120px, 20vw, 200px)` for height — responsive ✓

## LeagueDashboard.tsx
### Issues:
1. **h-screen** (line 1285): Same issue — should be `h-[100dvh]`
2. **Mobile bottom nav** (line 4072): Present but no `env(safe-area-inset-bottom)` — same iPhone issue
3. **Content padding** (line 1592): `pb-20 lg:pb-6` — may not be enough
4. **Mobile header** (line 1405): Has back button + title ✓
5. **Desktop-only right panel** (line 3961): `hidden lg:flex` — correct, hidden on mobile ✓
6. **Matchup hero card** — uses fixed widths that may overflow on small screens

## Common Fixes Needed:
1. Replace `h-screen` with `h-[100dvh]` on all 3 pages (with fallback)
2. Add `env(safe-area-inset-bottom)` to ClubDashboard and LeagueDashboard bottom navs
3. Fix ClubProfile banner paddingLeft to be responsive
4. Increase `pb-20` to `pb-24` or `pb-28` on ClubDashboard and LeagueDashboard to account for safe area
5. Add `overflow-x-hidden` to prevent horizontal scroll on mobile
