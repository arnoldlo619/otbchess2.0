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
