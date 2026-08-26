/**
 * Source-backed White repertoire expansion.
 *
 * Adds four practical White systems and canonical line sequences from the
 * Lichess chess-openings dataset (CC0): English, Catalan, King's Indian
 * Attack, and Réti. The script is idempotent and deliberately leaves existing
 * staff-authored repertoire content untouched.
 */
import { createConnection } from "mysql2/promise";
import { nanoid } from "nanoid";
import { Chess } from "chess.js";

const sourceBase = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";

const systems = [
  {
    slug: "english-opening",
    name: "English Opening",
    eco: "A10-A39",
    startingMoves: "1. c4",
    summary: "Flexible flank opening with transpositional options and long-term central influence.",
    description: "A practical White system built around 1.c4. The supplied reference lines cover the Symmetrical, Agincourt, and King’s English branches using canonical named sequences.",
    difficulty: "intermediate",
    playCharacter: "universal",
    themes: ["central-control", "piece-activity", "positional-squeeze"],
    matcher: (name) => name.startsWith("English Opening:") && /Symmetrical Variation|Agincourt Defense|King's English Variation/.test(name),
  },
  {
    slug: "catalan-opening",
    name: "Catalan Opening",
    eco: "E01-E09",
    startingMoves: "1. d4 Nf6 2. c4 e6 3. g3",
    summary: "A fianchetto-based queen-pawn repertoire that combines central pressure with lasting bishop activity.",
    description: "A practical Catalan collection using canonical named sequences. The lines offer a foundation for navigating open and closed center structures.",
    difficulty: "intermediate",
    playCharacter: "positional",
    themes: ["central-control", "piece-activity", "positional-squeeze"],
    matcher: (name) => name.startsWith("Catalan Opening"),
  },
  {
    slug: "kings-indian-attack",
    name: "King's Indian Attack",
    eco: "A07-A08",
    startingMoves: "1. Nf3 d5 2. g3",
    summary: "A flexible kingside fianchetto system that emphasizes familiar piece placement across multiple defenses.",
    description: "A practical King’s Indian Attack collection with canonical named responses against French, Sicilian, and Yugoslav structures.",
    difficulty: "beginner",
    playCharacter: "universal",
    themes: ["kingside-attack", "piece-activity", "system-opening"],
    matcher: (name) => name.startsWith("King's Indian Attack:") && /French Variation|Sicilian Variation|Yugoslav Variation|Pachman System/.test(name),
  },
  {
    slug: "reti-opening",
    name: "Réti Opening",
    eco: "A09-A29",
    startingMoves: "1. Nf3 d5 2. c4",
    summary: "A flexible hypermodern opening that invites transpositions while keeping central structure choices open.",
    description: "A practical Réti collection using canonical named sequences for the core, advance, accepted, and Anglo-Slav branches.",
    difficulty: "intermediate",
    playCharacter: "universal",
    themes: ["central-control", "piece-activity", "positional-squeeze"],
    matcher: (name) => name.startsWith("Réti Opening") && /^(Réti Opening$|Réti Opening: (Advance Variation|Réti Accepted|Anglo-Slav Variation))/.test(name),
  },
  {
    slug: "ruy-lopez",
    name: "Ruy Lopez",
    eco: "C60-C99",
    startingMoves: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    summary: "A cornerstone 1.e4 opening that builds enduring central pressure and supports both strategic and tactical play.",
    description: "A practical Ruy Lopez collection with canonical Berlin, Closed, Exchange, Open, Marshall, and Steinitz reference branches.",
    difficulty: "intermediate",
    playCharacter: "universal",
    themes: ["central-control", "piece-activity", "queenside-space"],
    matcher: (name) => name.startsWith("Ruy Lopez") && /^(Ruy Lopez$|Ruy Lopez: (Berlin Defense|Closed|Exchange Variation|Open|Marshall Attack|Morphy Defense|Steinitz Defense))/.test(name),
  },
];

function sourceSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function finalFen(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.fen();
}

function plyCount(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.history().length;
}

async function sourceRows() {
  const sources = await Promise.all(["a", "b", "c", "d", "e"].map(async (volume) => {
    const response = await fetch(`${sourceBase}/${volume}.tsv`);
    if (!response.ok) throw new Error(`Unable to fetch ${volume}.tsv`);
    return response.text();
  }));

  return sources.flatMap((tsv) => tsv.trim().split("\n").slice(1).map((line) => {
    const [eco, name, pgn] = line.split("\t");
    return { eco, name, pgn };
  }));
}

const connection = await createConnection(process.env.DATABASE_URL);
const rows = await sourceRows();

for (const [systemIndex, system] of systems.entries()) {
  const startingFen = finalFen(system.startingMoves);
  const [existingParents] = await connection.execute("SELECT id FROM openings WHERE slug = ? ORDER BY created_at ASC, id ASC LIMIT 1", [system.slug]);
  const openingId = existingParents[0]?.id ?? nanoid(16);
  await connection.execute(
    `INSERT INTO openings (
      id, name, slug, eco, color, starting_moves, starting_fen, description,
      summary, difficulty, popularity, play_character, themes, line_count,
      sort_order, is_published, is_featured, starter_friendly,
      estimated_line_count, trap_potential, strategic_complexity, author_name
    ) VALUES (?, ?, ?, ?, 'white', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name), eco = VALUES(eco), starting_moves = VALUES(starting_moves),
      starting_fen = VALUES(starting_fen), description = VALUES(description),
      summary = VALUES(summary), difficulty = VALUES(difficulty),
      play_character = VALUES(play_character), themes = VALUES(themes),
      is_published = 1, author_name = VALUES(author_name)`,
    [
      openingId, system.name, system.slug, system.eco, system.startingMoves,
      startingFen, system.description, system.summary, system.difficulty, 70,
      system.playCharacter, JSON.stringify(system.themes), 0, 320 + systemIndex * 10,
      system.difficulty === "beginner" ? 1 : 0, 10, 45, 60, "Lichess chess-openings (CC0)",
    ]
  );

  const uniqueRows = [...new Map(rows.filter((row) => system.matcher(row.name)).map((row) => [row.pgn, row])).values()]
    .sort((left, right) => plyCount(left.pgn) - plyCount(right.pgn))
    .slice(0, 12);

  for (const [lineIndex, row] of uniqueRows.entries()) {
    const lineSlug = `${system.slug}-reference-${sourceSlug(row.eco)}-${lineIndex + 1}`;
    const isGambit = /gambit/i.test(row.name);
    const [existingLines] = await connection.execute("SELECT id FROM opening_lines WHERE opening_id = ? AND slug = ? ORDER BY created_at ASC, id ASC LIMIT 1", [openingId, lineSlug]);
    const lineId = existingLines[0]?.id ?? nanoid(16);
    await connection.execute(
      `INSERT INTO opening_lines (
        id, opening_id, title, slug, eco, pgn, final_fen, ply_count, description,
        difficulty, commonness, priority, is_must_know, is_trap, line_type, color,
        strategic_summary, hint_text, punishment_idea, pawn_structure, themes,
        sort_order, is_published, author_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 50, ?, 0, 0, ?, 'white', ?, ?, NULL, NULL, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title), eco = VALUES(eco), pgn = VALUES(pgn),
        final_fen = VALUES(final_fen), ply_count = VALUES(ply_count),
        description = VALUES(description), line_type = VALUES(line_type),
        strategic_summary = VALUES(strategic_summary), hint_text = VALUES(hint_text),
        themes = VALUES(themes), is_published = 1, author_name = VALUES(author_name)`,
      [
        lineId, openingId, row.name, lineSlug, row.eco, row.pgn,
        finalFen(row.pgn), plyCount(row.pgn),
        "Canonical named sequence from the Lichess chess-openings dataset. Use the board and engine panel to decide whether this position fits your personal repertoire.",
        system.difficulty, 65, isGambit ? "gambit" : "main",
        "Reference sequence for this named White repertoire branch.",
        "Play the canonical sequence, then use the explorer and engine to compare practical continuations.",
        JSON.stringify(system.themes), (lineIndex + 1) * 10, "Lichess chess-openings (CC0)",
      ]
    );
  }

  await connection.execute(
    `UPDATE openings SET line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = ? AND is_published = 1), estimated_line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = ? AND is_published = 1) WHERE id = ?`,
    [openingId, openingId, openingId]
  );
  console.log(`${system.name}: ${uniqueRows.length} source-backed lines processed`);
}

const [[summary]] = await connection.execute(
  "SELECT COUNT(*) AS openings, SUM(line_count) AS total_lines FROM openings WHERE slug IN ('english-opening','catalan-opening','kings-indian-attack','reti-opening','ruy-lopez')"
);
console.log(`White expansion complete: ${summary.openings} systems, ${summary.total_lines} published lines`);
await connection.end();
process.exit(0);
