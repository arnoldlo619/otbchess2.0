# Club Feed Composer — Interaction QA

**Scope:** Regression coverage and visual verification for the extracted production `ClubFeedComposer` used by the Club Dashboard Feed tab.

## Implementation boundary

- Moved the existing member Feed composer out of `ClubDashboard.tsx` into `client/src/components/club/ClubFeedComposer.tsx` without changing the authenticated Feed API, payload, attachment validation, or Feed refresh behavior.
- The Dashboard’s **Post update** workspace action now increments a focused-open request consumed by the composer. It preserves the prior focus behavior while allowing direct rendered tests.
- Attachment controls now explicitly support `Enter` and `Space` key activation in addition to pointer activation. The labelled hidden file input remains associated with both triggers via `aria-controls` and `aria-describedby`.

## Rendered interaction coverage

`tests/club-feed-composer-interactions.test.tsx` verifies:

1. Compact-field expansion, discard/reset, and Escape dismissal.
2. Focused opening through the parent workspace action request.
3. Authenticated post persistence, post-success reset, parent timeline refresh, and success notice.
4. Recoverable publish failure with the draft retained and an alert surfaced.
5. Keyboard-triggered attachment picker activation, labelled file-input relationship, text-file preview, and removal.
6. File-read failure messaging.

Focused API and source-contract suites continue to cover member posting, original-author-or-owner deletion, attachment request payloads, and formatting controls.

## Visual QA

The production composer was rendered in a temporary local-only QA route against the running Vite preview, with a real text-file attachment injected through the component's file-input path. The temporary route and its source file were removed immediately after capture.

| Surface | Result |
| --- | --- |
| Desktop, 1280×720 | Expanded composer presents a clean hierarchy, horizontal format rail, text-file attachment card, named removal control, and aligned action row. |
| Mobile, 375×812 | The editor, attachment card, and controls remain readable with no clipping; the format rail stays horizontally scrollable and the action row remains touch-safe. |

Both captures were completed by `webdev_take_screenshot` against the active preview before removing the local QA route.

## Validation

- `pnpm vitest run tests/club-feed-composer-interactions.test.tsx client/src/__tests__/clubAnnouncementComposer.test.ts tests/club-feed-client-contract.test.ts tests/club-feed-api-behavior.test.ts` — **4 files, 24 tests passed**
- `pnpm exec tsc --noEmit` — **passed**
- Changed-file ESLint — **0 errors**; established unrelated ClubDashboard warnings remain.
- `git diff --check` — **passed**
- `pnpm lint` and `pnpm run build` — **passed**.
- Full `pnpm vitest run` baseline — **7,059 passed, 33 failed, 2 skipped** across 428 files. The new `tests/club-feed-composer-interactions.test.tsx` suite passed. The 33 failures span 18 pre-existing, unrelated source-contract/UI suites (including sidebar, browser-tab metadata, legacy workspace headers, accessibility baselines, and tournament wizard contracts); none names the Club Feed composer or its Feed API contracts.

## Known environment note

The sandbox browser does not have an authenticated private Club session, so the production Feed page cannot be opened through the private Club route without altering user data. The exact production component was rendered against the active preview for QA, using the same component and styles the Dashboard mounts.
