# League Dashboard UX/UI Enhancement Plan

## Approved scope

Refine the production Club League dashboard while preserving the current sidebar, data contracts, Commissioner workflows, and League demo route. The work follows the 2026-09-29 UX/UI audit.

## Design system decisions

- **Visual language:** retain the existing ChessOTB dark-green palette, rounded-surface family, and `Clash Display` hierarchy.
- **Density:** readable dashboard density: information-rich, not compressed.
- **Interaction:** only meaningful, short transform/opacity transitions; respect reduced motion; no decorative loops.
- **Icons:** retain the project’s existing icon family and replace all remaining UI emoji/pictographs with semantic components.
- **Responsive behavior:** rich standings table at `lg` and above; compact cards below. Every action retains a 44px mobile target.

## Implementation phases

1. **Foundation and duplicates**
   - Remove the redundant guest sign-in/join banner while retaining the authoritative Join This League surface.
   - Remove duplicate Requests sharing prompts and preserve one contextual share action.
   - Replace legacy trophy, warning, star, and check glyphs with existing semantic icon components.

2. **Readability system**
   - Apply a shared League type hierarchy to primary rows, supporting metadata, labels, form controls, and warnings.
   - Raise text below the minimum readable scale where it is interactive or core information.
   - Move the standings desktop projection from `sm` to `lg`; preserve compact mobile cards.

3. **Information architecture**
   - Recompose Overview around the next player task plus concise league/community sections.
   - Rebuild Requests as two clear operational panels.
   - Group Schedule as current, upcoming, and completed weeks.
   - Use compact/collapsible results history and a quieter settings configuration summary.
   - Make the desktop right rail contextual to Overview and Matchups only.

4. **Validation and release**
   - Add/update regression contracts for duplicate CTA removal, emoji removal, responsive standings, section structure, and contextual rail behavior.
   - Run focused tests, TypeScript, ESLint, production build, project lint, visual QA at 375px/768px/1024px/1440px, and restart the WebDev server.
   - Save one verified checkpoint.

## Completion status

All four phases were completed on 2026-09-29. The implementation and evidence are recorded in [League Dashboard UX/UI Enhancement QA](./league-dashboard-ux-ui-enhancement-qa.md).
