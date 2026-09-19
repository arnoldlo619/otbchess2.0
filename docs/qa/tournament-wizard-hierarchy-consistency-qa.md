# Tournament Wizard Hierarchy Consistency QA

## Scope

The visual-edit target at the shared `Label` primitive was stale. Deleting that primitive would have removed labels across unrelated Wizard paths, so the segmented onboarding flow was audited manually instead.

The Wizard shell now owns each stage's progress, title, and supporting context. The segmented card owns only the control group, required helper copy, and the final review content. This removes duplicate card eyebrows, single-field labels, and repeated question headings from the Name, Date, Location, Settings, Time Control, Ratings, and Preview stages.

Grouped controls remain labelled where those labels distinguish adjacent choices: Format, Rounds, Max Players, Platform, ELO Rating, and custom time inputs. The Name, Date, and Location inputs retain explicit accessible names through `ariaLabel` despite their visible field labels being removed.

## Visual QA

An isolated sandbox Wizard was opened through the non-destructive create route. Desktop review confirmed that the Name and Date stages each display only one contextual stage title in the Wizard shell and a clean input card below it. No tournament was created, and the sandbox-only draft was not submitted. The final browser session returned to the Home page after the temporary review.

## Validation

| Check | Result |
|---|---|
| Segmented Wizard, visual-edit, and format-card tests | Passed: 18 tests |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 9 existing Wizard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Desktop visual QA | Passed for isolated Name and Date stages; no duplicate shell/card hierarchy |
| Project lint | Passed with 0 errors; 236 existing warnings remain |
| Full Vitest suite | 6,972 passing, 2 skipped, and 18 established unrelated source-contract failures in tournament-format-card, accessibility-overlay, native form-label, and retired Wizard payment-toggle coverage |
