# Mobbin references — League dashboard refinement

**Purpose:** Translate proven web-dashboard patterns into ChessOTB League player and commissioner experiences while retaining the existing sidebar navigation and forest-green visual system.

## Reviewed patterns

| Reference | Observed pattern | League application |
|---|---|---|
| [Front workload analytics](https://mobbin.com/screens/670d6934-49be-49ea-a091-eae2aacd8323) | A clear page title, a compact filter/context row, a high-signal metric area, then a readable tabular detail region. | Give each League tab a concise title/context band; surface current week and completion context before matchup lists. |
| [Google Analytics home](https://mobbin.com/screens/f4f2cebe-5496-4959-9fbb-fe37fe2a5dd6) | High-level metrics are grouped before deeper modules, with deliberate whitespace between functional regions. | Put league-at-a-glance metrics ahead of standings detail and preserve breathing room between major League surfaces. |
| [Airtable project tracker](https://mobbin.com/screens/db82c4b6-cf63-4fa8-9a8f-1c5152a579c5) | Dense information remains scannable through a stable header, aligned rows, clear status labels, and restrained separators. | Use durable headings and aligned result/standings rows rather than decorative card repetition. |
| [Trello calendar planner](https://mobbin.com/screens/ae8872ad-0288-432c-a370-186bf4f0676f) | Calendar is the primary task surface; contextual schedule information appears immediately around it. | Make Schedule read as a named planning surface with selected-week context before match details. |
| [Kraken futures leaderboard](https://mobbin.com/screens/596e24c3-cff1-466a-a9e8-9cd5a2e5d94b) | A compact leaderboard summary precedes a dense ranked table, with ranking and value visually prioritized. | Put season metrics and a concise standings heading above the existing accessible desktop table/mobile ranking cards. |
| [Databricks review workflow](https://mobbin.com/flows/bc1f6feb-fb31-4818-b9cf-4eb14a2b796e) | The workflow makes review state, context, and the one next action visible together. | Keep reporting progress and the completion-gated next action visibly grouped in Commissioner operations. |

## Applied design rules

1. **Context before density:** Each major League page has a visible title and a small status/context treatment before dense content.
2. **Metrics precede records:** Ranking/schedule/operations summaries appear before tables and reporting rows.
3. **Readable operational density:** Minimum content type scale is raised to 14px metadata and 16px body, increasing on desktop; controls retain at least 44px interactive height where relevant.
4. **One clear action per surface:** Commissioner reporting and next-week advancement remain primary; secondary controls stay visually quiet.
5. **No emoji treatment:** Existing Lucide and OTB iconography remains the only visible icon system.
6. **Responsive containment:** Desktop tables retain rows; narrow screens retain the existing card/table alternatives without forced horizontal page scrolling.

## Deliberately not changed

- League sidebar navigation, buttons, order, or desktop/mobile behavior.
- League business logic, reporting rules, and advancement eligibility.
- Brand palette or existing theme support.
