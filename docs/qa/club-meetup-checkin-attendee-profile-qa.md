# Club Meetup Check-in Attendee Profile QA

**Scope:** Mobile-friendly attendee profile previews in the Club Meetup check-in flow.

## Delivered

- Removed the duplicate **Back to Event Page** control; the existing **View Event Page** action remains the single post-check-in navigation route.
- Made every checked-in attendee avatar a keyboard-accessible profile trigger.
- Added an accessible, lightweight profile sheet showing:
  - attendee identity and Chess.com username;
  - Rapid and Blitz ELO;
  - a safe external Chess.com profile link when available.
- Moved Chess.com rating retrieval from eager roster loading to the selected attendee profile sheet. A large live check-in roster no longer triggers one request per attendee during the 30-second refresh cycle.
- Registered the new custom modal in the shared overlay accessibility inventory, including focus containment, Escape dismissal, and opener focus restoration.

## Validation

| Check | Result |
|---|---|
| Focused regressions | **12 passed** across attendee-profile, QR reliability, and shared rating-resolver suites |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | passed with **0 errors** |
| Project lint | passed with **0 errors** and 233 established warnings |
| Production build | `pnpm run build` passed |
| Mobile browser QA | Passed at 390×844: avatar opened the profile sheet and live `@magnuscarlsen` data rendered **Rapid 2941 / Blitz 3409** |
| Route health | Local and public `/checkin/qa-checkin-event` returned HTTP 200 |
| Diff integrity | `git diff --check` passed |

## Baseline note

Full Vitest reports **7,191 passed, 2 skipped, 29 legacy failures across 17 suites**. The new attendee-profile tests pass. The focused shared-overlay inventory also confirms the new sheet follows the accessibility contract; its existing overall suite remains blocked by an unrelated stale `TournamentWizard.tsx` expected hook-count assertion (expects 3, source has 2).
