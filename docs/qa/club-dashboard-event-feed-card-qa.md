# Club Dashboard Event + Feed Card QA

**Scope:** Premium Club Dashboard card refinement for upcoming Events and member Feed posts.

## Delivered

### Events

- Rebuilt scheduled-event cards as larger, cover-led editorial cards.
- Increased the visual footprint with a `16:10` cover, 20–24px title scale, a 184–198px content region, and clear date/type overlays.
- Preserved the whole-card navigation model, keyboard focus treatment, venue/time metadata, and responsive 2-column desktop layout.

### Feed

- Rebuilt the shared live `FeedCard` into a member-first social post format:
  - 44px author avatar and concise type/time metadata.
  - Generous 20–24px content gutters and readable body copy.
  - `16:10` single-image treatment with the existing secure media gallery.
  - Large, accessible Like and Share action rail for announcement posts.
- Like uses the existing persisted Feed reaction model and refreshes the local Feed state.
- Share uses the device share sheet when available, then safely falls back to copying the post context/link.
- Deliberately omitted a Save control because no durable save model exists; no deceptive UI was introduced.
- Kept existing poll, RSVP, tournament result, leaderboard, and permissions behavior intact.
- Updated the public read-only Club demo Feed to mirror the live social-card hierarchy; demo action controls remain explicitly disabled.

## Accessibility and responsive checks

- All visible card controls retain explicit accessible names.
- Like exposes its pressed state; pin/delete controls retain labels and 44px targets.
- Card hover transforms are disabled under reduced-motion preference.
- Mobile-first gutters, 44px action targets, and two-column-to-single-column image behavior are retained.

## Validation

| Check | Result |
|---|---|
| Focused Club Feed / Event / demo Vitest suites | Passed — 36 tests across 7 files |
| TypeScript | Passed — `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with 0 errors; established ClubDashboard unused-state/import warnings remain |
| Local preview routes | `/clubs/demo`, `/clubs/demo?tab=events`, and `/clubs/demo?tab=feed` returned HTTP 200 |
| Desktop visual QA | Passed — public demo Feed renders the updated author hierarchy, content treatment, and aligned action rail |
| Mobile implementation review | Verified — mobile-first spacing, 44px action targets, and the single-column image treatment are encoded in the card styles; public demo shell was confirmed at 390px |

## Intentional limitations

- Feed likes use the existing heart-reaction persistence path; there is no separate saved-post table, so Save was intentionally not displayed.
- The public demo is read-only and correctly does not mutate likes or trigger native sharing.
