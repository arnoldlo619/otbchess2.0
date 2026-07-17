# Clubs Discovery Rewrite Notes

## Current Issues (from Phase 5 spec)
1. Two separate search fields (hero search for guests + discover section search)
2. FeaturedClubsCarousel may clip cards horizontally
3. No verified/active filter
4. No mobile filter drawer
5. No virtualization for large directories
6. Sort is separate from the filter area

## Current Architecture
- Server API: `apiListPublicClubs({ search, category, limit, sort, country, city })` → `{ clubs, total }`
- Location tree: `apiListClubLocations()` → `{ locations: [{ code, name, cities[] }] }`
- URL params already synced: q, cat, sort, country, city
- Debounced search (350ms)
- States: allClubs, myClubs, followedClubs, discoverClubs, discoverTotal, discoverLoading

## Club Type Fields Available
- name, slug, tagline, description, location, country, city, region
- category (club|school|university|online|community|professional)
- avatarUrl, bannerUrl, accentColor
- memberCount, tournamentCount, followerCount, eventCount
- isVerified, isClaimed, isPublic
- beginnerFriendly
- joinPolicy (public|approval|invite)

## Redesign Plan
- Single unified search bar at top of page (not in hero)
- Compact sticky filter bar: search + category chips + location + sort
- Mobile: filter drawer triggered by a Filter button
- Featured clubs as a distinct editorial section (not carousel)
- Result count always visible
- Consistent card grid (3-col desktop, 2-col tablet, 1-col mobile)
- Verified badge on cards when isVerified=true
- Empty state with clear messaging
- URL-encoded all params
- Keep: ClubCard component (good aspect ratio), FollowedClubCard, UpcomingEventsTab
