# RSVP Builder Header Share QA

**Scope:** Club Event RSVP form builder header at `/clubs/:clubId/meetup/:eventId/rsvp-form/builder`.

## Change

- Added a visible **Share** action directly before **Publish** in the RSVP builder header.
- The action is intentionally present in both draft and published states. It is disabled until the form is published, with an accessible label and tooltip that explain the required next step.
- Published forms open the device/browser native share sheet when supported.
- If native sharing is unavailable or fails, the public RSVP URL is copied to the clipboard and a success toast confirms the fallback.
- The button uses the established Lucide icon family, 40px header-action sizing, keyboard focus treatment, pressed feedback, and no new visual language or layout container.

## Regression coverage

`tests/rsvp-builder-header-navigation.test.ts`

- Guards the Share icon, share handler, native `navigator.share` invocation, clipboard fallback, disabled unpublished state, accessible label, and placement before Publish.

## Validation

| Check | Result |
| --- | --- |
| Focused RSVP suites | **18 passed** across header navigation, Meetup template, and smart-type contracts |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 1 existing RSVP builder accessibility warning outside the header action |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | Builder and public RSVP routes returned HTTP 200 |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,209 passed, 2 skipped, and 27 existing unrelated failures across 18 suites**. The additional passing test is the new Share header contract. The known failures remain outside RSVP builder changes, including legacy Tournament Wizard source-contract expectations.

## Visual QA limitation

The builder requires an authenticated Club owner and a persisted Club Event. This sandbox has no suitable authenticated owner/event fixture, so a rendered header interaction cannot be truthfully exercised in-browser here. The route itself is healthy; responsive action sizing and header placement were checked through source contracts. Validate native share-sheet presentation on a published owner form in a signed-in browser before a release that requires device-level share coverage.
