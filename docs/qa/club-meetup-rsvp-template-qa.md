# Club Meetup RSVP Template QA

**Date:** 2026-10-05  
**Scope:** Default questions for newly created Club Meetup RSVP forms

## Delivered template

New RSVP forms now start with four concise, editable questions:

1. **Name** — required short answer
2. **Chess.com username** — optional short answer
3. **What would you like to join?** — required multi-select: *Casual open play* and/or *Casual tournament*
4. **Email address** — required short answer

The Name and email template cards remain part of the saved response data and map to the public form's existing identity fields. This preserves clean owner analytics and avoids rendering duplicate inputs to attendees.

## Creation coverage

- Full-page RSVP builder creates the template after an absent-form `GET` response.
- Inline RSVP builder presents the template before first save.
- The server applies the same template when a direct first-time RSVP form creation omits `questions`.
- Existing RSVP forms are not changed.
- Owners can still edit labels, requirements, options, order, remove cards, duplicate cards, or add any supported question type. Changing the type of a template identity card turns it into a normal question; duplicates are normal questions as well.

## Validation

| Check | Result |
|---|---:|
| RSVP and direct-server Vitest suites | 39 passed / 4 files |
| TypeScript | Passed |
| Changed-file ESLint | 0 errors; 2 established warnings |
| Project lint | 0 errors; 234 established warnings |
| Production build | Passed |
| Local and public preview health | HTTP 200 |

## Browser QA limitation

The form builder is owner-only and this sandbox does not have an authenticated private-club owner session. The template path is covered by pure-template, server/default creation, and source-contract tests without modifying production data.
