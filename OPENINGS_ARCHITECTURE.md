# Openings Database System — Architecture & Content Strategy

**Author:** Manus AI for ChessOTB.club  
**Version:** 1.0.0  
**Date:** April 2026

---

## 1. Executive Summary

The ChessOTB openings database is a scalable, content-first system designed to power premium opening exploration, structured repertoire building, and spaced-repetition study for Pro members. The architecture draws strategic inspiration from two best-in-class products — the clean browsing experience of **Chessreps** and the data-informed line logic of **Chessbook** — while being purpose-built for ChessOTB's OTB-focused audience.

The system is composed of **10 database tables** organized into three functional layers: a **content layer** (openings, lines, nodes, model games, tags), a **curation layer** (repertoires, repertoire-line junctions), and a **learning layer** (user line reviews with SM-2 spaced repetition fields). Every table uses the project's established conventions — `varchar(36)` nanoid primary keys, no foreign key constraints for TiDB Cloud compatibility, and comprehensive indexing for fast filtered queries.

---

## 2. Entity Relationship Overview

The diagram below illustrates the relationships between all entities in the openings system. Solid arrows represent direct parent-child relationships; dashed arrows represent many-to-many junctions.

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│  openings   │──1:N──│  opening_lines   │──1:N──│  line_nodes  │
│  (families) │       │  (variations)    │       │  (move tree) │
└──────┬──────┘       └────────┬─────────┘       └──────────────┘
       │                       │
       │                       ├──1:N──┌──────────────┐
       │                       │       │ model_games  │
       │                       │       └──────────────┘
       │                       │
       │                       ├──N:M──┌──────────────────┐
       │                       │       │ user_line_reviews │
       │                       │       │ (per user×line)   │
       │                       │       └──────────────────┘
       │                       │
       │                       └──N:M──┌──────────────┐
       │                               │ line_tag_map │──→ opening_tags
       │                               └──────────────┘
       │
       └──────N:M──┌─────────────────┐
                   │ opening_tag_map │──→ opening_tags
                   └─────────────────┘

┌──────────────┐       ┌───────────────────┐
│ repertoires  │──N:M──│ repertoire_lines  │──→ opening_lines
│ (collections)│       │ (junction + order) │
└──────────────┘       └───────────────────┘
```

---

## 3. Entity Definitions

### 3.1 Content Layer

The content layer stores all chess knowledge. It is author-facing and admin-managed.

| Entity | Purpose | Key Fields | Row Scale |
|--------|---------|------------|-----------|
| **openings** | Top-level opening families (e.g., "Sicilian Defense") | `name`, `slug`, `eco`, `color`, `startingMoves`, `startingFen`, `difficulty`, `popularity`, `playCharacter` | ~50–200 |
| **opening_lines** | Specific variations within an opening (e.g., "Najdorf: 6.Bg5") | `title`, `eco`, `pgn`, `finalFen`, `difficulty`, `commonness`, `priority`, `isMustKnow`, `isTrap`, `strategicSummary`, `hintText`, `punishmentIdea` | ~500–5,000 |
| **line_nodes** | Individual half-moves forming a DAG (directed acyclic graph) | `ply`, `moveSan`, `moveUci`, `fen`, `isMainLine`, `annotation`, `nag`, `eval`, `transpositionNodeId` | ~5,000–50,000 |
| **model_games** | Annotated reference games illustrating a specific line | `whitePlayer`, `blackPlayer`, `event`, `year`, `result`, `pgn`, `commentary` | ~200–2,000 |
| **opening_tags** | Flexible categorization labels | `name`, `slug`, `category` (theme / structure / style / level) | ~50–200 |

The **openings** table functions as the top-level "folder" that users browse. Each opening contains multiple **opening_lines**, which are the core study units. Each line's move sequence is decomposed into **line_nodes** that form a tree structure, enabling branching variations and transposition links. **Model games** provide real-world context for each line, and **opening_tags** enable multi-dimensional filtering beyond ECO codes.

### 3.2 Curation Layer

The curation layer organizes content into study plans.

| Entity | Purpose | Key Fields | Row Scale |
|--------|---------|------------|-----------|
| **repertoires** | Curated collections of lines (staff or user-created) | `title`, `color`, `targetLevel`, `authorType`, `authorUserId`, `isFeatured`, `estimatedMinutes` | ~20–500 |
| **repertoire_lines** | Junction table with ordering | `repertoireId`, `lineId`, `sortOrder`, `note` | ~200–10,000 |

A **repertoire** groups lines into a coherent study plan. The `authorType` field distinguishes staff-curated repertoires (shown to all Pro members) from user-created ones (private by default). The `sortOrder` on the junction table controls the study sequence, and the optional `note` field allows repertoire-specific commentary on each line.

### 3.3 Learning Layer

The learning layer tracks individual user progress and powers the study engine.

| Entity | Purpose | Key Fields | Row Scale |
|--------|---------|------------|-----------|
| **user_line_reviews** | Per-user, per-line spaced repetition state | `status`, `intervalDays`, `easeFactor`, `repetitions`, `nextReviewAt`, `streak`, `bestStreak`, `totalAttempts`, `correctAttempts` | Grows with user base |

Each row represents one user's relationship with one line. The SM-2 algorithm fields (`intervalDays`, `easeFactor`, `repetitions`) are fully compatible with standard spaced repetition scheduling. The `status` field provides a human-readable mastery level: `new` → `learning` → `reviewing` → `mastered`. The `nextReviewAt` timestamp drives the daily study queue, and streak/accuracy fields enable gamification.

---

## 4. Why Each Entity Exists

Understanding the "why" behind each table prevents future architectural drift and ensures that new features extend the system rather than work around it.

**openings** exist because users need a browsable catalog. Without a top-level grouping, the line list would be an undifferentiated wall of 5,000+ entries. The opening page serves as the entry point for exploration, with rich descriptions, difficulty ratings, and popularity scores that help users find what to study.

**opening_lines** exist because the line is the fundamental study unit. Users don't study "the Sicilian" in the abstract — they study the Najdorf 6.Bg5 main line. Each line carries the metadata needed for intelligent study prioritization: `priority` and `commonness` scores determine what appears first in the study queue, `isMustKnow` flags essential theory, `isTrap` flags tactical traps worth memorizing, and `strategicSummary` / `hintText` / `punishmentIdea` power the guided practice experience.

**line_nodes** exist because chess variations are trees, not lists. A flat PGN string cannot represent branching alternatives, transpositions, or per-move annotations. The node-based DAG structure supports all three. Each node stores the FEN position for instant board rendering at any point in the tree, plus SAN and UCI move formats for both human display and engine communication.

**model_games** exist because theory without context is forgettable. Seeing Kasparov play the Najdorf against Topalov makes the line memorable and teaches the resulting middlegame plans in a way that abstract descriptions cannot.

**repertoires** exist because a repertoire is more than a list of lines — it's a curated study plan with a defined order and a target audience. The same Najdorf line might appear in both a "Complete Sicilian for Black" repertoire and a "Top 10 Must-Know Lines" repertoire, each with different ordering and notes.

**user_line_reviews** exist because learning requires repetition, and efficient repetition requires scheduling. The SM-2 fields enable the system to show each user exactly the lines they need to review today, with increasing intervals for well-known material and shorter intervals for struggling lines.

**opening_tags** and the two junction tables exist because ECO codes alone are insufficient for modern content discovery. A user searching for "aggressive kingside attacks" or "beginner-friendly solid openings" needs tag-based filtering that cuts across the ECO hierarchy.

---

## 5. Node Tree Architecture

The `line_nodes` table implements a directed acyclic graph (DAG) where each node represents a single half-move (ply). This design supports three critical capabilities that a flat PGN string cannot provide.

**Branching variations** are represented by multiple child nodes sharing the same `parentNodeId`. The `isMainLine` flag distinguishes the primary continuation from alternatives, and `sortOrder` controls the display order of siblings. For example, after 5...a6 in the Najdorf, the main line might be 6.Bg5 (sortOrder=0, isMainLine=1) with alternatives 6.Be2 (sortOrder=1, isMainLine=0) and 6.f3 (sortOrder=2, isMainLine=0).

**Transpositions** are handled via the `transpositionNodeId` field. When a position in one line transposes to a position in another line, the node links to the target node rather than duplicating the subtree. This keeps the data normalized and enables the UI to show "This position can also be reached via..." navigation.

**Per-move annotations** are stored directly on each node via the `annotation` field (Markdown-safe text) and the `nag` field (Numeric Annotation Glyph: 1=!, 2=?, 3=!!, 4=??, 5=!?, 6=?!). The optional `eval` field stores engine evaluation in centipawns for positions where computer analysis is relevant.

---

## 6. Spaced Repetition Design (SM-2)

The `user_line_reviews` table implements the SM-2 algorithm fields, which is the same algorithm used by Anki and other proven spaced repetition systems. The key fields and their roles are described below.

| Field | Type | Default | SM-2 Role |
|-------|------|---------|-----------|
| `intervalDays` | int | 0 | Days until next review |
| `easeFactor` | int | 250 | Ease factor × 100 (min 130, default 250 = 2.5) |
| `repetitions` | int | 0 | Consecutive successful reviews |
| `lastQuality` | int | null | Last review quality (0–5 scale) |
| `nextReviewAt` | timestamp | null | Computed next review date |

The review flow works as follows. When a user practices a line, the system records a quality rating from 0 (complete blackout) to 5 (perfect recall). If quality is 3 or above, the review is successful: `repetitions` increments, `intervalDays` grows according to the SM-2 formula, and `easeFactor` adjusts based on performance. If quality is below 3, the review fails: `repetitions` resets to 0, `intervalDays` resets to 1, and the line re-enters the learning queue.

The `status` field provides a simplified mastery classification derived from the SM-2 state: **new** (never reviewed), **learning** (fewer than 3 successful repetitions), **reviewing** (3+ repetitions, interval < 21 days), and **mastered** (interval ≥ 21 days). This powers the dashboard progress indicators and study queue prioritization.

---

## 7. Content Ingestion Strategy

### 7.1 Seed File Format

All opening content is authored and ingested via JSON seed files that follow the schema defined in `data/openings-seed.json`. The format is hierarchical: each opening contains its lines, each line contains its nodes and model games, and tags are defined at the top level and referenced by slug.

The seed file structure is designed for human authoring. Content creators write natural chess notation (SAN moves, standard FEN), and the ingestion script handles ID generation, parent-child linking, and database insertion. The `INSERT IGNORE` strategy makes the script idempotent — running it twice produces no duplicates.

### 7.2 Ingestion Pipeline

The ingestion pipeline consists of two scripts in the `scripts/` directory.

| Script | Purpose | Usage |
|--------|---------|-------|
| `migrate-openings.mjs` | Creates all 10 tables with `IF NOT EXISTS` | `node scripts/migrate-openings.mjs` |
| `seed-openings.mjs` | Reads JSON seed file and inserts content | `node scripts/seed-openings.mjs [path]` |

The recommended workflow for adding new content is: (1) edit or create a JSON seed file following the established schema, (2) run the seed script, (3) verify via the admin dashboard or direct SQL queries. For bulk imports from external PGN files, a future `import-pgn.mjs` script can parse PGN into the seed JSON format before ingestion.

### 7.3 Future Admin Interface

The database is designed to support a future admin UI with the following capabilities: creating and editing openings and lines via forms, drag-and-drop reordering (via `sortOrder` fields), tag management, repertoire composition, and content publishing (via `isPublished` flags). The `isPublished` flag on every content table enables a draft/publish workflow where content can be prepared and reviewed before going live.

---

## 8. Naming Conventions

Consistent naming across the codebase reduces cognitive load and prevents bugs. The following conventions are enforced throughout the openings system.

| Layer | Convention | Example |
|-------|-----------|---------|
| Database columns | `snake_case` | `opening_id`, `is_must_know`, `next_review_at` |
| Drizzle schema fields | `camelCase` | `openingId`, `isMustKnow`, `nextReviewAt` |
| TypeScript types | `PascalCase` with `Row`/`New` suffix | `OpeningLineRow`, `NewOpeningLineRow` |
| JSON seed keys | `camelCase` (matching Drizzle) | `startingMoves`, `strategicSummary` |
| URL slugs | `kebab-case` | `sicilian-najdorf-6bg5-main` |
| Index names | `prefix_column_idx` | `ol_opening_id_idx`, `ulr_user_line_idx` |
| Tag slugs | `kebab-case` | `kingside-attack`, `beginner-friendly` |

The two-letter index prefix convention matches the existing project pattern (e.g., `cm_` for club_members, `cb_` for club_battles). New prefixes introduced by the openings system are: `op_` (openings), `ol_` (opening_lines), `ln_` (line_nodes), `rep_` (repertoires), `rl_` (repertoire_lines), `mg_` (model_games), `ulr_` (user_line_reviews), `ot_` (opening_tags), `otm_` (opening_tag_map), `ltm_` (line_tag_map).

---

## 9. Scalability & Performance Notes

The schema is designed to perform well from the current seed of 2 openings and 4 lines up to a production scale of 200+ openings and 5,000+ lines. The key performance decisions are documented below.

**Denormalized counts** (`lineCount` on openings, `lineCount` on repertoires) avoid expensive `COUNT(*)` queries on listing pages. These are updated by the seed script and should be maintained by any future write operations.

**Composite indexes** on high-traffic query patterns — `(openingId, sortOrder)` on opening_lines, `(userId, nextReviewAt)` on user_line_reviews, `(lineId, ply)` on line_nodes — ensure that the most common queries (browse lines in an opening, fetch today's review queue, render a move tree) use index-only scans.

**FEN at every node** is a deliberate storage-for-speed tradeoff. Storing FEN at every node uses more disk space than computing it from the move sequence, but it eliminates the need to replay moves client-side when jumping to an arbitrary position in the tree. For a system where users frequently click through move trees, this is the correct tradeoff.

**JSON text columns** for `themes`, `reviewHistory`, and similar array data avoid the need for additional junction tables while keeping the data queryable via MySQL's `JSON_CONTAINS()` function. This is appropriate for fields that are read frequently but filtered rarely.

---

## 10. Future Extension Points

The architecture is designed with explicit extension points for planned features.

**Opening mistake detection** will query `line_nodes` by FEN to match positions from user games against known theory. The `ln_line_ply_idx` index and per-node FEN storage make this lookup efficient. A future `user_game_deviations` table can store detected deviations with links back to the correct `line_nodes` entry.

**Community repertoires** are already supported by the `authorType` field on repertoires (`staff` | `community` | `user`). Enabling community sharing requires only a visibility/permissions layer, not schema changes.

**PGN import** from external sources (Lichess studies, chess.com game archives) can be implemented as a parser that converts PGN into the seed JSON format, then feeds it through the existing `seed-openings.mjs` pipeline.

**Coach-assigned repertoires** can be implemented by adding an `assignedBy` field to a future `user_repertoire_assignments` junction table, linking a repertoire to a student user.

**Gamification** (XP, badges, leaderboards) can be built on top of the `user_line_reviews` data — total lines mastered, longest streak, review accuracy percentage — without modifying the core schema.

---

## 11. File Inventory

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle ORM schema definitions for all 10 openings tables |
| `data/openings-seed.json` | Seed data with 2 openings, 4 lines, 77 nodes, 1 model game, 19 tags |
| `scripts/migrate-openings.mjs` | Creates tables via raw SQL (idempotent) |
| `scripts/seed-openings.mjs` | Reads seed JSON and inserts into database (idempotent) |
| `OPENINGS_ARCHITECTURE.md` | This document |
