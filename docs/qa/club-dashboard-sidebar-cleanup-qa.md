# Club Dashboard Sidebar Cleanup QA

## Live compact inspection

On the live Club Dashboard route for The OTB Club, the desktop compact rail presents the unframed OTB!! back control and the centered destination icons only. The former expanded club-name header and manual collapse control are absent. The rail does not expose a redundant footer action below its available navigation set; the remaining right-side control belongs to the page header, not the rail.

The focused rendered suite covers both compact and expanded 72px/264px states, verifies the Settings footer placement when supplied, and confirms pointer and keyboard temporary expansion.

## Mobile fallback

At 375px, the desktop rail is intentionally replaced by the compact mobile title bar and menu trigger. The Club Home content remains visible below it with no duplicate sidebar controls, horizontal overflow, or blocked primary content.

## Interaction contract

The focused sidebar suite verifies active semantics, transient non-touch hover feedback, keyboard-triggered temporary expansion, visible focus treatment, reduced-motion transition guards, compact default sizing, and the 375px/mobile fallback. The compact rail uses no persistent manual expansion control.
