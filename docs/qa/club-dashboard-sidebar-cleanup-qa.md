# Club Dashboard Sidebar Cleanup QA

## Live compact inspection

On the live Club Dashboard route for The OTB Club, the desktop compact rail presents the unframed OTB!! back control and the centered destination icons only. The former expanded club-name header and manual collapse control are absent. The rail does not expose a redundant footer action below its available navigation set; the remaining right-side control belongs to the page header, not the rail.

The focused rendered suite covers both compact and expanded 72px/264px states, verifies the Settings footer placement when supplied, and confirms pointer and keyboard temporary expansion.

## Mobile fallback

At 375px, the desktop rail is intentionally replaced by the compact mobile title bar and menu trigger. The Club Home content remains visible below it with no duplicate sidebar controls, horizontal overflow, or blocked primary content.

## Interaction contract

The focused sidebar suite verifies active semantics, transient non-touch hover feedback, keyboard-triggered temporary expansion, visible focus treatment, reduced-motion transition guards, compact default sizing, and the 375px/mobile fallback. The compact rail uses no persistent manual expansion control.

The expanded-state regression additionally proves that Settings is the sole footer destination within the separated footer container, while the former Workspace and Manage labels, club-name heading, and manual expansion control remain absent.

## Explicit expanded desktop capture

On the live desktop Club Dashboard route, advancing keyboard focus from the skip link to the OTB!! back control expanded the rail to its 264px state. The resulting navigation showed destination labels only, with no Club workspace heading, Workspace/Manage dividers, redundant compact-footer action, or manual collapse control. The available Settings destination remains isolated in the footer when present.

The expanded configuration is also rendered in the focused sidebar suite with a visible Settings item. The item is contained in the semantic **Club dashboard settings** footer landmark, separate from the primary destination list, and the twelve sidebar interaction tests pass.

The dedicated expanded-state visual capture confirmed the 264px sidebar layout with Overview and Feed in the centered primary list, no section labels or manual expand control, and Settings visibly isolated below the footer divider. The temporary local capture route was removed after review and is not part of the product surface.
