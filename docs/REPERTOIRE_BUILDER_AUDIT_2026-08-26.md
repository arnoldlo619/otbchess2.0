# Repertoire Builder Audit and Completion Scope

## Baseline

The existing Repertoire Builder already had a production-quality chessboard, move tree, PGN import/export, Lichess Explorer proxy with static fallback, engine evaluation, annotations, practice mode, auto-save, and free/Pro limits. Its central gap was **discoverability**: the published opening catalog and its curated lines were available to the separate openings/study system but could not be incorporated from the Builder itself.

The live catalog audit found **18 published opening families** and **219 published curated lines**. The fallback explorer covers approximately 1,400 positions. This content is now directly usable as repertoire material rather than remaining isolated study content.

## Completed Upgrade

The Builder now includes a third right-panel workspace: **Library**. It provides the following end-to-end workflow:

1. Default the catalog to the repertoire’s color, with a White/Black switch for deliberate preparation across both sides.
2. Search published families by name, ECO, or description and inspect line counts, difficulty, practical metadata, and starter-friendly status.
3. Open any family to browse its published main lines, sidelines, gambits, traps, and must-know lines.
4. Add a selected line directly to the active repertoire. The client fetches its canonical published PGN, parses it through the existing variation-aware importer, deep-merges it into the current tree, auto-saves it, and opens the Tree tab for review.
5. Preserve existing user lines, comments, annotations, and branches; importing a line never replaces the user’s repertoire.

## Engine Reliability Correction

During browser validation, Stockfish attempted to derive a missing local WASM sibling and received the development server's HTML fallback. The Builder now requires actual cross-origin isolation before using the multi-thread worker and passes the verified managed single-thread WASM location through Stockfish's worker-hash protocol. This keeps engine analysis available without the prior WebAssembly initialization failure.

## Content Integrity

The Library uses the existing published openings API and stored line PGNs. It does not invent chess moves, evaluations, or training claims. The Lichess opening-name dataset may be used only as the documented CC0 factual naming/ECO enrichment source; editorial explanations remain ChessOTB-controlled.

## Remaining Follow-up
The next content phase should use the existing importer tooling to expand the curated database deliberately by opening family and level, with sourced PGN, reviewed move trees, and explicit starter/must-know/trap labels. The UI is now ready to surface that expanded content immediately.

## First White Repertoire Expansion

The first reviewed expansion adds the **English Opening**, **Catalan Opening**, **King's Indian Attack**, and **Réti Opening** to the published White library. It contributes **44 canonical named lines**: 12 English, 12 Catalan, 8 King's Indian Attack, and 12 Réti. Every imported line retains its ECO code, exact PGN, derived final FEN, and CC0 attribution to the [Lichess chess-openings dataset](https://github.com/lichess-org/chess-openings).

The new idempotent seed and reconciliation scripts reuse existing source rows and consolidate duplicate families or lines while preserving any repertoire-line references. This keeps the library reliable even where the deployed database has not enforced the logical slug uniqueness expected by the application schema.

The next reviewed White batch closes the catalog’s only high-popularity empty-system gap: the **Ruy Lopez** now has 18 canonical published reference lines, including the Berlin, Closed, Exchange, Open, Marshall, and Steinitz branches. It uses the same CC0 source, idempotent seed, reconciliation, and user-safe import workflow as the initial batch.

The next requested White batch adds the **Ponziani Opening** with 11 canonical reference lines and the **Trompowsky Attack** with 9. It also expands the **Catalan Opening** from 12 to 20 canonical lines, including Open, Closed, and deeper main-line structures. Every line remains directly sourced from the CC0 Lichess opening dataset, attributed in the catalog, and protected by the same duplicate-safe seeding and reconciliation workflow.

## Modern Scandinavian Black repertoire

The Black repertoire now begins with a practical **Scandinavian Defense** collection. The catalog retains 24 canonical published B01 lines, all tagged black, covering the modern `...Nf6` move order, Portuguese and Icelandic-Palme gambit ideas, `...Qd6`, `...Qa5`, classical, Bronstein, and main-line branches. The extended seed is color-aware, so parent and line metadata preserve Black orientation while continuing to use the same CC0 source and duplicate-safe reconciliation process.

## Sicilian Defense and King's Indian Defense Black repertoire

The next reviewed Black batch adds 18 selected, practical CC0-attributed canonical source rows for each requested family. The **Sicilian Defense** seed focuses on named Najdorf, Classical, Dragon, Scheveningen, Taimanov, Kan, Accelerated Dragon, and closed-structure branches; the catalog currently retains 51 unique published Sicilian lines, including prior curated material. The **King's Indian Defense** seed focuses on Normal, Classical, Fianchetto, Averbakh, Makogonov, Sämisch, Karpov, and main-line branches; it currently retains 28 unique published lines, including prior curated material.

The reconciliation workflow now idempotently aligns every published catalog line's color metadata with its retained opening parent. This corrects historical Sicilian rows without modifying user repertoire trees, annotations, line PGNs, or source attribution, and makes the correct Black orientation reproducible on future seed/reconciliation runs.
