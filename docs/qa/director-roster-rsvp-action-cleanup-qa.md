# Director Roster RSVP Action Cleanup QA

## Scope

The Players tab previously exposed a standalone **Upload RSVPs** button beside **Add Player**. This duplicated the CSV import workflow already available inside the Add Player modal. The standalone control, its modal state, lazy-loaded modal import, and now-unused spreadsheet icon dependency were removed. Registration intake now has one clear entry point: **Add Player**, whose **Import CSV** mode supports CSV file selection, drag-and-drop, paste, preview, and bulk upsert.

## Direct visual verification

A sandbox registration-state review of `/tournament/otb-demo-2026/manage` confirmed the Players tab renders one top-row registration action, **Add Player**, with no adjacent Upload RSVPs button. Opening Add Player and selecting **Import CSV** rendered the CSV file/paste import panel. The temporary browser state was restored after review without registering or changing any players.

## Validation

| Check | Result |
|---|---|
| Focused Director tests | Passed: 98 tests across Director action, lazy-loading, editing, and scoring suites. |
| TypeScript | Passed: `pnpm exec tsc --noEmit`. |
| Changed-file ESLint | Passed with 0 errors; 6 established warnings remain in `Director.tsx`. |
| Diff integrity | Passed: `git diff --check`. |
| Production build | Passed: `pnpm build`. |
| Full test suite | 6,982 passed, 2 skipped; 22 unrelated established failures across 15 legacy source-contract suites. The focused Director suites passed. |
| Project lint | Passed with 0 errors; 235 existing project warnings remain. |

## Risk

The separate `UploadRSVPModal` remains in the codebase for now but is no longer reachable from the Director page. The consolidated Add Player CSV path remains the supported roster import route.
