# Club Dashboard workspace headers — QA

## Scope

- Feed, Events, and Members use the compact, avatar-first social profile header already established by Albums.
- The owner/director **Overview** is the only Club workspace surface that retains the full photographic cover banner and its banner-upload workflow.
- Settings and Album keep their own focused surfaces rather than inheriting a redundant cover banner.

## Delivered behavior

| Surface | Header treatment | Primary action |
| --- | --- | --- |
| Owner Overview | Full-cover club banner with a uniform readability scrim | Existing banner upload / drag-and-drop |
| Feed | Compact club avatar, name, `Feed` label, live update/member counts, context | `Post update` expands and focuses the existing composer for active members |
| Events | Compact social header with scheduled-event/member counts | `Create event` opens the established event choice flow for owners/directors |
| Members | Compact social header with member/event counts | `Invite members` opens and scrolls to the existing invite panel for owners/directors |
| Album | Existing album-specific header | Existing album actions |

## UX and accessibility checks

- Header actions retain 44px controls and clear text labels; mobile actions move below the identity row as a full-width control.
- Feed, Events, and Members preserve the club avatar, name, count hierarchy, and concise contextual copy without reintroducing a photographic cover.
- The duplicate Events heading and two competing creation buttons were removed after the single contextual `Create event` action was added.
- The public demo uses the same compact header on Feed, Events, and Members; its full photographic cover is Overview-only.
- New header implementation uses semantic Lucide SVG icons only. No new emoji glyphs were introduced.

## Validation

| Check | Result |
| --- | --- |
| Focused header regression suite | Pass — 11 tests across 3 files |
| TypeScript | Pass — `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Pass — 0 errors; established warnings only |
| Project ESLint | Pass — 0 errors; 234 pre-existing warnings |
| Production build | Pass — `pnpm run build` |
| Diff integrity | Pass — `git diff --check` |
| Preview health | Pass — local and public `/clubs/demo` returned HTTP 200 |
| Desktop visual QA | Pass — clicked Feed, Events, and Members in the public demo and verified each compact header hierarchy |
| Mobile visual QA | Pass — checked the demo shell at 375×812; existing Overview cover remains responsive and compact header actions have an explicit mobile layout contract |

## Known QA boundary

The sandbox browser is not authenticated into a private production Club, so owner-only live action execution is protected by source-contract coverage. The shared `CreateEventModal`, existing member invite panel, and existing Feed composer were reused rather than duplicated or replaced.
