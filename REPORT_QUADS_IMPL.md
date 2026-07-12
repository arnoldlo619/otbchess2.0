# Report.tsx Quads Section-Filtering Implementation Notes

## Current State
- Report.tsx uses `computeAllPerformances(players, rounds)` at line 704 — computes global standings
- SummaryBanner at line 1129 shows single champion from performances[0]
- Podium at line 1251-1290 shows global top 3
- PlayerStatsCard shows "1st of 16" from perf.rank / perf.totalPlayers
- No section query param handling exists

## What's Done
- Added `computeQuadSectionPerformances()` to performanceStats.ts (lines 344-403)
- Added `useSearch` import to Report.tsx
- Added `computeQuadSectionPerformances` import to Report.tsx

## What Still Needs to Be Done in Report.tsx

### 1. After line 704 (const performances = ...), add:
```tsx
const search = useSearch();
const sectionParam = new URLSearchParams(search).get("section");
const isQuads = rawState?.format === "quads";
const quadSections = rawState?.quadSections ?? [];

// For Quads: compute per-section performances
const quadSectionPerfs = isQuads
  ? computeQuadSectionPerformances(players, rounds, quadSections)
  : [];

// Active section (from URL or "all")
const [activeSection, setActiveSection] = useState<string>(sectionParam ?? "all");

// Filtered performances for display
const displayPerformances = isQuads && activeSection !== "all"
  ? (quadSectionPerfs.find(s => s.sectionId === activeSection)?.performances ?? performances)
  : performances;
```

### 2. Add QuadsSectionTabs component (before SummaryBanner render):
Shows horizontal tabs: "All Sections" + one per quad section

### 3. Replace SummaryBanner for Quads:
- If isQuads && activeSection !== "all": show section-specific banner with section champion
- If isQuads && activeSection === "all": show multi-champion banner (one per section)

### 4. Replace Podium for Quads:
- If isQuads: show per-section champion cards instead of global podium
- Each section gets a champion card with section name

### 5. Filter `filtered` (search results) from displayPerformances instead of performances

## Key Files
- client/src/pages/Report.tsx (main page)
- client/src/lib/performanceStats.ts (data computation)
- client/src/components/PlayerStatsCard.tsx (card display — needs sectionContext prop)
- client/src/lib/directorState.ts (DirectorState.format, .quadSections)
