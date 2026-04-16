# Openings Catalog — Content Architecture & UI Rendering Guide

**Version:** 2.0.0  
**Last updated:** April 2026  
**Author:** Manus AI

This document describes the launch catalog for ChessOTB.club's Pro openings explorer. It covers the content taxonomy, data model extensions, UI rendering specifications, and product logic for the opening browse experience.

---

## 1. Catalog Overview

The launch catalog contains **16 openings** organized into three browsing categories. Each opening carries rich metadata designed for card rendering, detail pages, search/filter, featured sections, and future "recommended for you" personalization.

| Category | Count | Openings |
|---|---|---|
| White Repertoire | 7 | Jobava London, London System, Vienna Game, Vienna Gambit, Scotch Game, Italian Game, Queen's Gambit |
| Black vs 1.e4 | 4 | Caro-Kann Defense, Scandinavian Defense, French Defense, Sicilian Defense |
| Black vs 1.d4 | 5 | King's Indian Defense, Queen's Gambit Declined, Slav Defense, Anti-London System |

The Sicilian Defense and Italian Game were present in the v1 seed and have been updated with the extended catalog fields. All 16 openings are published and visible.

---

## 2. Data Model Extensions

Five new columns were added to the `openings` table to support catalog-level product features:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `is_featured` | tinyint | 0 | Surfaces the opening in "Featured" hero sections and promotional placements |
| `starter_friendly` | tinyint | 0 | Flags openings suitable for first-time learners; powers "Start Here" recommendations |
| `estimated_line_count` | int | 0 | Displays expected line depth before lines are loaded; sets user expectations |
| `trap_potential` | int (0–100) | 50 | Quantifies how many traps and punishing lines exist; powers "Trap Alert" badges |
| `strategic_complexity` | int (0–100) | 50 | Quantifies positional depth; helps filter openings by strategic demand |

These fields complement the existing `difficulty`, `popularity`, and `play_character` columns to create a multi-dimensional opening profile.

---

## 3. Tag Taxonomy

The catalog uses a **6-category tag system** with 45 tags total. Tags are stored in the `opening_tags` table and linked via `opening_tag_map` (many-to-many).

### 3.1 Category Breakdown

| Category | Count | Purpose | Examples |
|---|---|---|---|
| `theme` | 12 | Strategic themes and motifs | Kingside Attack, Gambit Play, Counterattacking |
| `structure` | 8 | Pawn structure types | Sicilian Structure, French Pawn Chain, Slav Structure |
| `style` | 8 | Playing style classification | Aggressive, Solid, Low Theory, System Opening |
| `level` | 4 | Skill-level suitability | Beginner Friendly, Club Essential, Tournament Ready |
| `bestFor` | 6 | Player archetype recommendations | Best for Attackers, Best for Rapid/Blitz |
| `family` | 7 | Opening family groupings | 1.e4 Openings, Indian Defenses, Open Games |

### 3.2 Tag Usage in UI

Tags serve multiple UI roles simultaneously. The `style` and `level` tags render as colored pills on opening cards. The `bestFor` tags power the "Best For" filter and future personalized recommendations. The `family` tags enable hierarchical browsing (e.g., "Show all Indian Defenses"). The `theme` and `structure` tags are primarily for search and the opening detail page's "Key Themes" section.

---

## 4. Browse Filters

The catalog defines 6 filter dimensions, each with a specified UI control type:

| Filter | Type | Options |
|---|---|---|
| Side | Toggle (single-select) | All, White, Black |
| Difficulty | Multi-select | Beginner (green), Intermediate (yellow), Advanced (orange), Expert (red) |
| Style | Multi-select | Aggressive, Solid, Dynamic, Classical, Surprise Weapon |
| Character | Toggle (single-select) | All, Tactical, Positional, Universal |
| Best For | Multi-select | Beginners, Improvers, Attackers, Positional Players, Rapid/Blitz, Classical |
| Theory Load | Toggle (single-select) | All, Low Theory, High Theory |

Filters are defined in the seed JSON under `browseFilters` and should be rendered as a sticky filter bar above the opening grid. Toggle filters use segmented controls; multi-select filters use pill-style checkboxes.

---

## 5. UI Rendering Specifications

### 5.1 Opening Card

Each opening renders as a card in the browse grid. The card layout should include:

**Top section:** A mini chessboard rendered from `startingFen` (the thumbnail position). This is the visual anchor — it should be prominent and immediately recognizable.

**Middle section:** The opening name in bold, the ECO code as a subtle badge, and the one-line `summary` text. Below the summary, render the `difficulty` as a colored badge (green/yellow/orange/red) and the `playCharacter` as a secondary badge (tactical/positional/universal).

**Bottom section:** A row of metric indicators showing `popularity` (bar or percentage), `trapPotential` (flame icon + score), and `strategicComplexity` (brain icon + score). If `isFeatured` is true, add a "Featured" ribbon or star badge. If `starterFriendly` is true, add a "Start Here" badge.

**Tag pills:** Render 2–3 of the most relevant `style` tags as small colored pills below the metrics.

### 5.2 Opening Detail Page

The detail page expands the card into a full content view:

**Hero section:** Large chessboard from `startingFen`, opening name, ECO code, side badge (White/Black), difficulty badge, and the `summary` as a subtitle.

**Description section:** Render the full `description` text (Markdown-safe). This is the primary content block — it should feel like a premium article excerpt.

**Metadata sidebar:** A structured panel showing Popularity (progress bar), Trap Potential (progress bar with flame icon), Strategic Complexity (progress bar with brain icon), Estimated Lines (number), Character (badge), and Difficulty (badge).

**Tags section:** All tags grouped by category, rendered as interactive pills that link to filtered browse views.

**Lines section:** (Future) A list of `opening_lines` belonging to this opening, each showing title, difficulty, must-know flag, and a mini move preview.

### 5.3 Category Sections

The browse page should be organized into three collapsible sections matching the `categoryGroupings` in the seed JSON:

1. **White Repertoire** — "Your weapons with the white pieces"
2. **Black vs 1.e4** — "Answer the King's Pawn"
3. **Black vs 1.d4** — "Answer the Queen's Pawn"

Each section has a title, subtitle, and a horizontal scrollable row or grid of opening cards. The "Featured" openings should appear first within each section.

### 5.4 Featured Section

A dedicated hero section at the top of the browse page showcasing `isFeatured` openings (currently 8 of 16). This should use a larger card format with the chessboard thumbnail, name, summary, and a "Start Learning" CTA button. Consider a carousel or 2×4 grid layout.

### 5.5 Starter-Friendly Section

A "Start Here" section targeting new users, showing only openings where `starterFriendly` is true (currently 6 of 16). This section should use a warm, inviting design with a heading like "New to openings? Start here." and emphasize the low-theory, beginner-friendly nature of these openings.

---

## 6. Scoring System Interpretation

The `trapPotential` and `strategicComplexity` scores are editorial ratings on a 0–100 scale. They are designed to help users make informed choices about which openings to study.

| Score Range | Trap Potential Meaning | Strategic Complexity Meaning |
|---|---|---|
| 0–30 | Few traps; clean, principled play | Straightforward plans; easy to understand |
| 31–50 | Some traps exist but not the main feature | Moderate strategic depth |
| 51–70 | Significant trap potential; preparation pays off | Rich positional ideas; requires study |
| 71–100 | Trap-heavy; opponents frequently fall into lines | Deep strategic complexity; expert-level nuance |

### Notable Scores

| Opening | Trap Potential | Strategic Complexity | Interpretation |
|---|---|---|---|
| Vienna Gambit | 85 | 50 | Extremely trap-heavy but strategically manageable |
| Jobava London | 75 | 55 | High surprise value with moderate strategic depth |
| King's Indian Defense | 60 | 85 | Some traps but primarily a deep strategic system |
| Queen's Gambit Declined | 25 | 70 | Almost no traps; pure strategic understanding |
| Scandinavian Defense | 45 | 35 | Moderate traps; low strategic overhead |

---

## 7. Content Quality Standards

All opening descriptions follow these editorial guidelines:

**Tone:** Premium, practical, modern. No cheesy filler language ("This amazing opening will blow your mind!"). Descriptions read like expert analysis from a knowledgeable coach.

**Structure:** Each description has two paragraphs. The first introduces the opening's core idea and historical significance. The second explains the strategic character, typical plans, and who it's best suited for.

**Length:** Short descriptions (`summary`) are 8–15 words, optimized for card rendering. Long descriptions (`description`) are 100–180 words, suitable for detail pages.

**Accuracy:** All ECO codes, starting moves, and FENs are verified. Difficulty and scoring ratings reflect consensus from chess pedagogy and tournament practice.

---

## 8. Seed Files Reference

| File | Purpose |
|---|---|
| `data/openings-catalog-seed.json` | Complete catalog data (openings, tags, filters, groupings) |
| `data/openings-seed.json` | Original v1 seed with lines and nodes (Sicilian + Italian) |
| `scripts/seed-catalog.mjs` | Idempotent script to upsert catalog data into the database |
| `scripts/seed-openings.mjs` | Original v1 seed script for lines and nodes |

To seed the full catalog, run:

```bash
node scripts/seed-catalog.mjs
```

The script is idempotent — safe to run multiple times. It uses `INSERT IGNORE` for tags and `ON DUPLICATE KEY UPDATE` for openings.

---

## 9. Future Extensions

The catalog is designed to support several planned features without schema changes:

**Personalized recommendations:** The `bestFor` tags and scoring dimensions enable a recommendation engine that matches openings to a user's playing style, rating, and preferred time control.

**Opening comparison:** The multi-dimensional scoring (difficulty, popularity, trap potential, strategic complexity) enables side-by-side opening comparison views.

**Repertoire builder:** The `repertoires` and `repertoire_lines` tables (already in the schema) will allow users to assemble custom repertoires from catalog openings.

**Community ratings:** A future `user_opening_ratings` table could capture user feedback on difficulty accuracy and content quality, enabling crowd-sourced refinement of the editorial scores.
