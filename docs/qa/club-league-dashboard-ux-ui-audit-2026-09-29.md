# Club League Dashboard UX/UI Audit

**Date:** 2026-09-29  
**Scope:** Production Club League dashboards and the public League demo. The sidebar was reviewed for parity only and is intentionally excluded from proposed changes.

## Executive assessment

The core League dashboard has a **strong shared shell** after the recent demo-parity work: the production view now has one primary league identity, a centered desktop rail, one share action, and a single notification control. The active League overview has clear status, player, standings, and matchup primitives.

The biggest remaining quality issue is **not the shell**. It is the amount of competing information and the inconsistent density inside individual tabs. The dashboard will feel substantially more premium by establishing a readable data scale, removing duplicate join/share prompts, and making each tab have one obvious primary job.

> **Recommendation:** Treat this as a focused League content-system refinement, not another visual rebuild. Preserve the current shell and green visual language; simplify the page bodies within it.

## What is already working well

| Area | Finding | Assessment |
|---|---|---|
| Production/demo chrome | Current production screenshot shows one league header, centered rail controls, one top-right share action, and no duplicated notification/share controls. | **Resolved / retain** |
| Shared visual language | Dark and light-aware token use, rounded surface family, Chess.com avatars, status chips, and the current accent system are consistent. | **Strong foundation** |
| Core player experience | `Your Match`, standings, match cards, opponent prep, and player cards offer real useful information rather than decorative dashboard content. | **Strong product utility** |
| Responsive containment | The shell protects horizontal overflow and the demo bracket has a dedicated, accessible horizontal-scrolling region with a mobile swipe affordance. | **Good baseline** |
| Icon direction | Most visible interface icons use Lucide or custom SVG instead of generic emoji. | **Mostly compliant** |

## Priority findings

| Priority | Finding | Evidence | Recommended change |
|---|---|---|---|
| **P0** | Guest/draft overview repeats the join conversion path. | The live production draft view shows a top `Interested in joining this league?` sign-in CTA and a second large `Join This League` card with another sign-in CTA. | Keep the **Join This League** card as the single conversion surface. Fold the brief explanatory text into it and remove the redundant top banner. |
| **P0** | The standings table changes to a 10-column desktop layout at the `sm` breakpoint (640px), which is too narrow for readable columns. | `LeagueDashboard.tsx` lines 3003–3023 use `hidden sm:grid`; the grid contains position, player, rating, MP, W/D/L, points, form, and prep. | Keep the rich table at `lg`/desktop widths only. Use the existing mobile standings cards below that breakpoint, or provide an intentional horizontal table scroller with the player column pinned. |
| **P0** | Typography has drifted toward dense dashboard microcopy. | Audit found **22 `text-[10px]` usages**, **1 `text-[8px]` usage**, and **184 `text-xs` usages** in the production dashboard. | Establish a League type scale: page title 28–36px; section title 16–18px; core rows/body 14–16px; secondary metadata 12–13px; reserve 10–11px only for nonessential, noninteractive indicators. |
| **P1** | The Overview tab has too many similarly weighted cards. | It can render previous-week results, current match, standing, next opponent, recent results, standings preview, and player roster in one uninterrupted vertical stack. | Make **My Round** the primary surface; group the rest into `League snapshot` (standing, next opponent, recent result) and `Community` (top standings, roster). Collapse or defer the previous-week card when no action is required. |
| **P1** | Requests repeats sharing affordances and nests multiple card treatments. | The Requests tab contains a header share action, an empty-state share action, and a persistent `Quick share reminder`; the join-request state also nests a card inside a card. | Use a two-panel operations layout: `Invite members` and `Join requests`. Keep **one** contextual `Share invite link` action and make push status a compact inline setting, not a third card. |
| **P1** | Schedule becomes a long undifferentiated list as a season grows. | All weeks render one after another, with equal surface weight. | Start with `Current week`, then a lighter `Upcoming` sequence and a collapsed/compact `Completed weeks` section. Keep the current week visually dominant. |
| **P1** | Legacy pictographs remain in the production dashboard. | Static emoji/glyph usage appears in the completion toast, schedule self-marker, champion avatar badge, format warning, and incomplete-week warning. | Replace all static pictographs with existing Lucide icons: `Trophy`, `Star` or `UserRound`, and `AlertTriangle`. Keep W/D/L as data labels, not icons. |
| **P2** | Settings repeats configuration content below a long form. | A full `Current Configuration` card follows the editable form. | On desktop, make current values a quiet side summary or a compact definition list at the top. On mobile, place it in a collapsed `Current settings` disclosure. |
| **P2** | Desktop right rail is useful but visually repeated on data-heavy tabs. | `Upcoming Matchups` persists beside all dashboard body tabs at desktop widths. | Retain it on Overview only, or reduce it to a single sticky `Next round` card on Matchups. Hide it on Standings, Schedule, Requests, and Settings where it competes with the task. |

## Emoji and glyph cleanup

The audit found five production uses that should be replaced before any broader visual polish:

| Location | Current presentation | Replacement |
|---|---|---|
| Season-complete toast | `🏆 Season complete` | `Trophy` icon in the toast renderer plus plain text |
| Schedule self-marker | `★` beside the signed-in player | A subtle accent row treatment or `UserRound` icon with an accessible label |
| Champion avatar badge | `🏆` overlay | Existing `Trophy` component in the same circular overlay |
| Settings format warning | `⚠ Changing format…` | `AlertTriangle` + 12–14px warning copy |
| Advance-week warning | `⚠ Not all Week…` | `AlertTriangle` + semantic warning alert |

No generic emoji icon system should be added. Match outcome values (`W`, `D`, `L`, scores, ranks) remain valid structured data labels.

## Typography and readability standard

Apply this consistently across Overview, Matchups, Standings, Schedule, Requests, History, and Settings:

| Role | Desktop | Mobile | Notes |
|---|---:|---:|---|
| League / page title | 32–36px | 26–30px | Current hero direction is appropriate; preserve it. |
| Section title | 18px | 16–18px | `Recent Results`, `Players`, `Final Standings`, `Invite Members`. |
| Player name / primary row | 15–16px | 15–16px | Never smaller than 14px in interactive rows. |
| Core metadata | 13–14px | 13–14px | Ratings, dates, records, deadlines, usernames. |
| Micro labels | 12px | 12px | Uppercase labels and concise status chips only. |
| Numerical compact indicators | 10–11px | 10–11px | Only if noninteractive and paired with an accessible label. |

Additional rules:

- Use `text-xs` selectively; do not use it as the default for all secondary content.
- Keep muted text at a verified 4.5:1 contrast ratio in light mode, particularly for ELO, dates, empty-state copy, and configuration labels.
- Ensure actions have at least a 44px effective touch target on mobile even when the visible label is compact.
- Give form warnings, deadlines, and action state enough line-height to avoid the compressed appearance visible in several 10–11px fragments.

## Page-by-page structural direction

### Overview

**Goal:** answer “What do I need to do next?” in one scan.

1. Keep the current hero and league status.
2. Use one primary `My Round` / `Join This League` card based on membership state.
3. Place `My standing` and `Next opponent` together in a compact two-up snapshot.
4. Keep either `Recent results` **or** `Week results`, not both at equal prominence.
5. Move standings preview and full roster into a lower `League community` section.

### Matchups

**Goal:** make the selected week immediately actionable.

- Keep the current matchup hero; it is the strongest League body component.
- Use a clearer selected-week control with 44px-high targets and a visible current-week state.
- Raise deadline, pending, and commissioner controls to 12–13px minimum.
- Make all non-current weeks secondary after the selected week, rather than presenting equal-weight cards.

### Standings

**Goal:** compare players without forcing a desktop table onto small screens.

- Switch the wide table at `lg`, not `sm`.
- Preserve player identity, rank, points, record, and prep on mobile cards; expose form and less-essential stats through a compact secondary row.
- Keep preparation actions visually tertiary so they do not create a noisy action column.

### Schedule

**Goal:** scan the season timeline.

- Split into `Current`, `Upcoming`, and `Completed` groups.
- Add a single compact season progress line above the groups.
- Replace the self `★` marker with row emphasis plus a semantic icon if required.

### Requests

**Goal:** handle membership operations without repeated prompts.

- Create two semantic panels: `Invite club members` and `Requests to review`.
- Put push-notification controls inside the Requests panel header or a concise utility row.
- Keep one Share invite link action only.
- Replace the nested empty card with a direct empty state inside its parent panel.

### History

**Goal:** celebrate a finished season, then provide auditability.

- Retain the champion card but replace the trophy emoji overlay with `Trophy`.
- Use a compact final standings list, then provide the full history link.
- Render `All results by week` as collapsible week groups to stop the page becoming a repetitive wall of rows.

### Settings

**Goal:** make commissioner changes deliberate and safe.

- Keep the current single form but improve helper text and warning size.
- Replace the emoji warning with `AlertTriangle`.
- Move current configuration to a desktop side summary / mobile disclosure.
- Maintain the explicit `Save changes` and `Reset` controls; their intent is clear.

## Recommended implementation sequence

1. **Consolidate duplicate actions and remove legacy emojis** — overview guest CTA, Requests share prompts, warning/champion/schedule glyphs.
2. **Apply the League type scale and responsive standings breakpoint** — this delivers the largest readability lift without changing data or workflow.
3. **Recompose Overview and Requests around a single primary task** — reduce vertical noise and duplicate card surfaces.
4. **Organize Schedule and History into current/upcoming/completed or collapsible groups.**
5. **Make the desktop right rail contextual by tab**, preserving it on Overview and Matchups only.

## Quality gates for the refinement pass

- No new emojis used as UI icons; static legacy glyphs removed from production League pages.
- All primary player names, table rows, and form actions render at **14px or larger**.
- No 10-column standings layout below the `lg` breakpoint.
- One share-invite action per screen state; one join conversion surface for guests.
- Dark and light mode visual review at 375px, 768px, 1024px, and 1440px.
- Keyboard focus, 44px mobile targets, reduced motion, and all existing league workflows remain intact.

## Audit validation

- Reviewed production `LeagueDashboard.tsx`, public `LeagueDemo.tsx`, existing League source-contract coverage, responsive containment coverage, and mobile dashboard shell protections.
- Captured the active production League dashboard and public demo at **1440×900** and **375×812**.
- No implementation changes were made during this audit.
