# Club Events Workspace QA

## Scope

Refined the Club Dashboard **Events** tab into a schedule-first management workspace. The work preserves event, RSVP, tournament, meetup, and league data flows while making type selection and organizer actions clearer.

## UX changes verified

- The tab begins with a concise **Club schedule** header, exact upcoming-date count, and clear owner creation paths.
- **New tournament** remains the primary organizer action; **Create meetup** is the secondary action. When Leagues is selected, the focused **New league** action replaces the unrelated event actions.
- The four event-type controls use a labelled `tablist`, visible selected state, 44px minimum touch targets, and per-type counts.
- The old Leagues filter regression is fixed: it now opens the real Club Leagues management surface instead of incorrectly showing meetup and tournament content.
- Upcoming meetups and tournaments use the same date-led hierarchy: readable date tile, category label, title, optional description, venue, and one unambiguous member destination.
- Organizer controls are persistently available rather than hidden on desktop hover. Controls retain descriptive labels or accessible names for Edit/Delete.
- New cards and the workspace shell have intentional light/dark color pairs, visible focus states, press feedback, and responsive action wrapping.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Vitest: Events workspace, Overview, event registry | **28 passing** |
| TypeScript (`pnpm exec tsc --noEmit`) | **Passed** |
| Changed-file ESLint | **0 errors; 68 pre-existing dashboard warnings** |
| Production build (`pnpm run build`) | **Passed** |
| Diff integrity (`git diff --check`) | **Passed** |
| Local/public `/clubs` HTTP availability | **200 / 200** |

## Browser QA boundary

The sandbox browser has no authenticated club membership, so a direct private Club Dashboard URL correctly redirects to `/clubs`. Authenticated owner-only interaction could not be exercised without modifying a real club or user session. The affected behavior is protected with source contracts and the production build; no production data was created or changed for QA.

## Remaining risk

Past-event cards and the legacy generic `EventCard` remain intentionally outside this focused redesign. They retain their existing behavior and should be evaluated separately if the product later unifies all historical event presentation.
