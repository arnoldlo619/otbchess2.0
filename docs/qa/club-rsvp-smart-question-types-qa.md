# Smart Club Meetup RSVP Question Types — QA

**Date:** 2026-10-05  
**Scope:** RSVP builder question-type defaults and owner control

## Behavior

New blank RSVP questions start as **Smart** short-answer fields instead of multiple choice. As an owner writes a question, the local deterministic inference selects a sensible control:

| Question intent | Inferred control | Example |
|---|---|---|
| General response | Short answer | `Chess.com username` |
| Yes/no decision | Multiple choice | `Will you attend?` |
| Multiple interests | Checkboxes | `What would you like to join?` |
| Single preference | Dropdown | `Which start time do you prefer?` |
| Numeric value | Number | `What is your chess.com rating?` |
| Longer context | Paragraph | `Any additional notes?` |

The inference runs entirely in the browser—no question content is sent to an external AI service. Yes/no prompts receive **Yes** and **No** options. Owners can always use the existing type selector to make a manual choice; a **Use smart type** control restores automatic inference. Custom options remain untouched when the inferred type does not change.

## Compatibility

- Existing forms retain their saved types until an owner edits the question label.
- Existing Meetup template cards continue to display their appropriate types.
- Manual changes mark a question as a manual override; duplicating an identity card remains a normal question.

## Validation

| Check | Result |
|---|---:|
| Smart-type, RSVP, and server focused Vitest suites | 30 passed / 4 files |
| TypeScript | Passed |
| Changed-file ESLint | 0 errors; 1 established warning |
| Project lint | 0 errors; 234 established warnings |
| Production build | Passed |
| Local and public preview health | HTTP 200 |

## Browser QA limitation

The RSVP builder requires an authenticated private-club owner session, unavailable in this sandbox. Deterministic behavior and both builder integrations are covered by focused tests without modifying a live club form.
