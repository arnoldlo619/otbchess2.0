# RSVP Builder Mobile Sticky Header QA

**Scope:** Club Event RSVP form builder at `/clubs/:clubId/meetup/:eventId/rsvp-form/builder`.

## Change

- Converted the 64px RSVP builder header from an always-fixed element to an in-flow `sticky top-0` header below the desktop breakpoint.
- Converted the mobile Form Builder tab strip to an adjacent `sticky top-16` layer.
- The header retains the existing Theme, Preview, Share, and Publish actions, keeping Share and Publish continuously available while the owner scrolls a long builder form.
- Removed the mobile-only 112px compensating top offset because sticky layers now retain document flow. The desktop fixed-header offset remains unchanged.
- Preserved the header z-index hierarchy, borders, blur treatment, 44px minimum mobile tab targets, action focus rings, and desktop fixed behavior.

## Regression coverage

`tests/rsvp-builder-header-navigation.test.ts`

- Guards the sticky mobile header and tab strip stack.
- Guards the `top-16` second layer and in-flow mobile content offset.
- Preserves existing Share, Publish, accessibility, and responsive header contracts.

## Validation

| Check | Result |
| --- | --- |
| Focused RSVP suites | **18 passed** across header navigation, Meetup template, and smart-type contracts |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 1 existing RSVP builder accessibility warning outside the header navigation |
| Project lint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Route health | Builder and public RSVP routes returned HTTP 200 |
| Diff integrity | `git diff --check` passed |

### Full regression baseline

`pnpm vitest run` completed with **7,209 passed, 2 skipped, and 27 known unrelated legacy failures across 18 suites**. The sticky RSVP header coverage passes; known failures remain outside the RSVP builder, including legacy Tournament Wizard source-contract expectations.

## Visual QA note

The builder is owner-gated and this sandbox has no persisted authenticated Club Event fixture. The source-level responsive contract verifies the two-layer sticky geometry without assuming an unauthenticated error route represents the builder UI. Validate on an authenticated owner form at 390px and 768px before a release that needs device-specific screenshot evidence.
