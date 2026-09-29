# Club Events Gallery QA

## Scope

Replaced the previous schedule-management and filter layout in the Club Dashboard **Events** tab with a single **upcoming-event gallery**. The visual direction follows the ChessOTB `/clubs` surface language: a restrained heading, image-led cards, simple metadata, and compact actions.

## Product behavior preserved

- Only **scheduled upcoming events** render in the Events tab, sorted by start time. No past-event cards, past-event toggles, or visible category filters remain.
- Every scheduled meetup, tournament, or standard club event receives one responsive gallery card.
- Cards use an uploaded event image when available; otherwise they use a branded accent-gradient fallback with a low-contrast chess texture.
- Existing destinations remain intact: event detail pages, tournament play pages, owner RSVP panels, tournament management, and meetup edit/delete controls.
- Owners retain **New tournament** and **Create meetup** actions. The owner-only **Leagues** overview action opens the existing League workspace directly without exposing a general Events filter; selecting Events from desktop or mobile navigation resets the gallery.
- The empty state gives organizers the appropriate next action and gives members a clear read-only message.

## UX and accessibility checks

- Image cards keep a 16:9 cover treatment, clear date/type labels, readable time and venue metadata, hover/focus feedback, and responsive 1/2/3-column layouts.
- Both light and dark appearances use separate card, border, text, and focus-ring colors.
- Buttons retain text labels or explicit accessible names; hover movement is short and disabled by existing reduced-motion conventions.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Vitest: Events gallery, Overview, event registry | **28 passing** |
| TypeScript (`pnpm exec tsc --noEmit`) | **Passed** |
| Changed-file ESLint | **0 errors; 68 existing dashboard warnings** |
| Project lint (`pnpm lint`) | **0 errors; 237 existing warnings** |
| Production build (`pnpm run build`) | **Passed** |
| Diff integrity (`git diff --check`) | **Passed** |
| Local/public `/clubs` HTTP availability | **200 / 200** |

## Browser QA boundary

The sandbox browser has no authenticated private-club membership. A direct private dashboard URL correctly redirected to `/clubs`, so the owner-specific rendered gallery could not be exercised without modifying a real club or user session. No production data was created or changed for QA; the gallery behavior is covered by source contracts, type-checking, linting, and the production build.
