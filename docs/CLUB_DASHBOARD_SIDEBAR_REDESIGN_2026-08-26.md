# Club Dashboard Sidebar Redesign — 2026-08-26

**Author:** Manus AI

## Design read

Reading this as a redesign of a high-trust club operations dashboard for organizers, with a restrained premium sports-product language leaning toward Linear and mature enterprise SaaS navigation rather than gaming chrome, glass effects, or decorative motion.

| Dial | Level | Rationale |
|---|---:|---|
| Design variance | 5/10 | Distinct ChessOTB identity, but predictable dashboard navigation |
| Motion intensity | 3/10 | State continuity only; no ambient or decorative animation |
| Visual density | 6/10 | Efficient organizer workflow with comfortable 44px targets |

## Existing implementation audit

The current desktop navigation reserves a 64px rail and expands to 240px on pointer hover. It correctly starts collapsed, preserves the active destination, uses the ChessOTB icon family, and keeps mobile navigation separate. The main quality gaps are the absence of a visible pin/collapse control, over-reliance on inline pointer handlers, a vertically centered menu that weakens information hierarchy, generic glow/shadow treatment, unlabeled navigation grouping, and active-state styling that resembles a gaming overlay more than a mature operations product.

## Mobbin reference findings

The [Cloudflare dashboard reference][1] uses a stable, quiet sidebar with search at the top, compact icon-and-label rows, clear functional grouping, low-contrast dividers, and minimal emphasis for the current location. Its strongest transferable principle is hierarchy through spacing and labels rather than neon color, oversized surfaces, or decorative effects. ChessOTB should retain its dark-green brand but adopt this quieter structure and density.

The [GitBook workspace reference][2] combines a compact workspace switcher, clearly labeled content groups, a distinct utility footer, and one restrained upgrade action. Its navigation remains easy to scan because section structure is established with typography and spacing rather than a pill behind every item. ChessOTB can adapt this by separating club operations from community destinations and keeping the club switch/back action visually distinct from tab navigation.

The [Fibery workspace reference][3] demonstrates a dense but orderly information architecture with a quiet selected row, small consistent icons, clear nested levels, and persistent help/support placement at the bottom. The transferable principle is a fixed spatial hierarchy: identity and primary destinations begin at the top, content navigation follows, and utilities remain anchored at the bottom. ChessOTB should avoid Fibery's extreme density, but adopt the same predictable vertical structure.

| Pattern | Adopt for ChessOTB | Avoid |
|---|---|---|
| Workspace identity | Club avatar, full name, and concise owner-workspace label in expanded state | Decorative avatar glow or oversized branding |
| Navigation structure | Top-aligned primary group, labeled management group, bottom utilities | Vertically centering every destination |
| Active state | Low-contrast green surface, semantic `aria-current`, left indicator, stronger label | Neon glow, bright full-row fill, color-only state |
| Collapsed state | 72px rail, persistent 44px targets, accessible tooltips, compact badges | Browser `title` as the only label |
| Motion | Transform/opacity continuity around 180–220ms with reduced-motion fallback | Width animation driven only by pointer hover or ambient animation |

## Selected ChessOTB navigation system

The redesigned desktop sidebar will use a **72px compact rail** and a **264px expanded workspace panel**. Compact mode remains the default. Hover may temporarily reveal the expanded panel for pointer users, while a visible pin control lets users persist the expanded or compact state. Keyboard focus inside the rail also reveals labels, so the interface never depends on hover alone.

The workspace header will use the real club avatar, club name, and a plain **Club workspace** descriptor. The main navigation will be top-aligned and split into **Workspace** destinations (Overview, Feed, Album, Events, Members) and **Manage** destinations (Settings, when authorized). A quiet footer will contain **All clubs** and the explicit expand/collapse control. This establishes a predictable identity → navigation → utility hierarchy based on the reviewed Cloudflare, GitBook, and Fibery patterns.[1] [2] [3]

The current page will use `aria-current="page"`, a restrained low-opacity green surface, stronger white label, green icon, and a narrow left indicator. Inactive items will use readable neutral labels with one subtle hover surface. Every row will have a minimum 44px target; compact rows will use accessible portal tooltips on pointer hover and keyboard focus. Badges will retain text values rather than relying on color-only dots. All iconography will remain in the existing ChessOTB vector family, with Lucide reserved only for panel controls already used by the project. No emoji, ornamental glow, glass-card stacking, or perpetual motion will be introduced.

The temporary hover expansion and persisted pin transition will use the same 200ms transform/opacity rhythm. `prefers-reduced-motion` will disable the transition. The sidebar will remain desktop-only at `lg` and above; the existing mobile bottom navigation and owner-tools sheet will be preserved, with no mixed navigation hierarchy introduced on small screens.

## Implementation and QA record

The new desktop component renders a 72px default rail and a 264px expanded workspace panel. Browser automation verified `72px` at rest, `264px` on pointer hover, and `264px` when the Feed item retained keyboard focus after the pointer left the sidebar. The active Feed destination exposed `aria-current="page"`; compact destinations retained portal-based labels, and the expanded panel displayed the club identity, Workspace grouping, bottom utilities, and persistent pin control.

Visual review confirmed that the active row uses one low-opacity green surface and narrow indicator without glow, inactive rows remain readable but quiet, navigation begins at the top rather than floating at mid-height, and footer utilities remain spatially separate. A 375×812 mobile capture confirmed that the desktop sidebar remains absent below `lg` and the existing mobile club shell continues to render without horizontal overflow.

| Validation | Result |
|---|---|
| Sidebar and adjacent regression suite | **77 passed** across sidebar behavior, mobile shell, lazy loading, image strategy, overlay accessibility, and Album navigation |
| TypeScript | **Passed** with zero errors |
| New sidebar and test lint | **Passed** with zero warnings and zero errors |
| Changed legacy page lint | **Passed** with zero errors |
| Browser interaction QA | **Passed** at 72px compact, 264px hover-expanded, and 264px keyboard-expanded states |
| Mobile visual QA | **Passed** at 375×812 without desktop-sidebar leakage or horizontal overflow |
| Managed dev server restart | **Passed** with no TypeScript or dependency errors |
| Diff integrity | **Passed** |

## References

[1]: https://mobbin.com/screens/26e17ee1-b1cf-4c16-8fdf-d385b5045c2f "Cloudflare Web Dashboard — Mobbin"
[2]: https://mobbin.com/screens/49527874-e5f9-4d86-b582-a2bfb263e17b "GitBook Web Dashboard — Mobbin"
[3]: https://mobbin.com/screens/45a010d5-ee70-43ff-82bc-4ccce42917f2 "Fibery Web Dashboard — Mobbin"
