# Tournament Wizard Name Label Cleanup QA

## Scope

The visual-edit target at the former line 645 resolved to the shared `Label` primitive rather than the intended first step of the segmented Tournament Wizard. Removing that primitive would have broken labels throughout every Wizard path, so the correction was applied manually at the segmented Name step only.

The first step retains its contextual eyebrow, **Tournament name**, and its question heading, **What should players call this event?** The repeated visible **Tournament Name** field label below that hierarchy has been removed. The input now provides the explicit accessible name **Tournament name** through the shared `TextInput` component's `ariaLabel` override, so the visual simplification does not remove the field's programmatic identity.

## Validation

| Check | Result |
|---|---|
| Segmented Wizard, visual edit, and format-card tests | Passed: 17 tests |
| TypeScript | Passed: `npx tsc --noEmit` |
| Changed-file lint | Passed with 0 errors; 9 existing Wizard warnings remain |
| Diff integrity | Passed: `git diff --check` |
| Interactive preview boundary | The Wizard opened with a pre-existing saved draft at the final preview step. The draft was not changed or submitted. Source and focused regression checks verify the first-step hierarchy and accessible input name. |
| Project lint | Passed with 0 errors; 236 existing warnings remain |
| Full Vitest suite | 6,971 passing, 2 skipped, and 18 established unrelated source-contract failures in tournament-format-card, accessibility-overlay, native form-label, and retired Wizard payment-toggle coverage |
