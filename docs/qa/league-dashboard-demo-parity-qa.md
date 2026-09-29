# League Dashboard Demo-Parity QA

## Scope

Aligned real club League Dashboard chrome with the established `/league-demo` visual system, without changing league records, match flow, roster management, invitations, commissioner permissions, or mobile bottom navigation.

## Completed refinements

- Rebuilt the desktop rail around the demo's 60px chess-board-backed shell, with the navigation group vertically centered and the logo/back controls anchored at the ends.
- Removed the desktop duplicate league name and format from the top bar. League identity now appears only in the hero surface.
- Matched the production hero's 120px hierarchy to the demo: prominent league title, club and format metadata, and Players / Matches / Week statistics.
- Consolidated global chrome actions: Share and draft notification controls no longer appear in both the rail and header. The authoritative controls live in the header.
- Preserved the generic mobile chrome title, keeping each league name in the mobile hero rather than repeating it above.

## Automated checks

| Check | Result |
| --- | --- |
| Focused League regression suite | Passed — 28 tests across 2 files |
| TypeScript | Passed — 0 errors |
| Changed-file ESLint | Passed — 0 errors; 7 existing League Dashboard warnings |
| Production build | Passed |
| Project lint | Passed — 0 errors; 237 pre-existing warnings |
| Full Vitest suite | 6,998 passed, 2 skipped; 36 established unrelated legacy source-contract failures in 19 suites |
| Diff integrity | Passed — no whitespace errors |

## Visual review

Reviewed the real draft league `Demo League` at desktop (1440×900) and mobile (375×812), alongside `/league-demo`.

- Desktop: one hero title, a centrally balanced navigation group, and one header action cluster rendered correctly.
- Mobile: the compact generic top bar, single hero identity, safe content containment, and bottom navigation rendered without horizontal overflow.
- The source guard verifies one `Share League` title and one header notification control, preventing the reported chrome duplication from returning.

## Full-suite baseline note

The full suite's 36 failures are unrelated pre-existing source-contract/UI tests outside the League Dashboard scope. The League-focused suite introduced and exercised for this refinement passes cleanly.
