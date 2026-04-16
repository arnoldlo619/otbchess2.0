/**
 * seed-openings.mjs
 *
 * Reads data/openings-seed.json and inserts all content into the openings
 * database tables. Idempotent — uses INSERT IGNORE to skip duplicates.
 *
 * Usage:
 *   node scripts/seed-openings.mjs                     # seed from default file
 *   node scripts/seed-openings.mjs path/to/custom.json  # seed from custom file
 */
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";

// ─── Config ──────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const seedFile = process.argv[2] || "data/openings-seed.json";
const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 36);

// ─── Load seed data ──────────────────────────────────────────────────────────
let seed;
try {
  seed = JSON.parse(readFileSync(seedFile, "utf-8"));
} catch (err) {
  console.error(`Failed to read seed file: ${seedFile}`);
  console.error(err.message);
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// ─── Counters ────────────────────────────────────────────────────────────────
const counts = {
  tags: 0,
  openings: 0,
  lines: 0,
  nodes: 0,
  modelGames: 0,
  openingTagMaps: 0,
  lineTagMaps: 0,
};

// ─── Helper: slugToId map for tags ───────────────────────────────────────────
const tagIdBySlug = new Map();

// ─── 1. Insert tags ─────────────────────────────────────────────────────────
console.log("Seeding tags...");
for (const tag of seed.tags || []) {
  const id = nanoid();
  tagIdBySlug.set(tag.slug, id);
  try {
    await conn.execute(
      `INSERT IGNORE INTO opening_tags (id, name, slug, category, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tag.name, tag.slug, tag.category || "theme", tag.description || null, tag.sortOrder || 100]
    );
    counts.tags++;
  } catch (err) {
    // If slug already exists, fetch the existing id
    const [rows] = await conn.execute("SELECT id FROM opening_tags WHERE slug = ?", [tag.slug]);
    if (rows.length) tagIdBySlug.set(tag.slug, rows[0].id);
  }
}
console.log(`  ✓ ${counts.tags} tags`);

// ─── 2. Insert openings + nested content ────────────────────────────────────
console.log("Seeding openings...");
for (const opening of seed.openings || []) {
  const openingId = nanoid();

  await conn.execute(
    `INSERT IGNORE INTO openings
     (id, name, slug, eco, color, starting_moves, starting_fen, description, summary,
      difficulty, popularity, play_character, themes, line_count, sort_order, is_published, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      openingId,
      opening.name,
      opening.slug,
      opening.eco,
      opening.color,
      opening.startingMoves,
      opening.startingFen,
      opening.description || null,
      opening.summary || null,
      opening.difficulty || "intermediate",
      opening.popularity || 50,
      opening.playCharacter || "universal",
      opening.themes ? JSON.stringify(opening.themes) : null,
      (opening.lines || []).length,
      opening.sortOrder || 100,
      1, // published
      opening.authorName || null,
    ]
  );
  counts.openings++;

  // ── Opening-level tags ──
  for (const tagSlug of opening.tags || []) {
    const tagId = tagIdBySlug.get(tagSlug);
    if (!tagId) continue;
    await conn.execute(
      `INSERT IGNORE INTO opening_tag_map (id, tag_id, opening_id) VALUES (?, ?, ?)`,
      [nanoid(), tagId, openingId]
    );
    counts.openingTagMaps++;
  }

  // ── Lines within this opening ──
  for (const line of opening.lines || []) {
    const lineId = nanoid();

    await conn.execute(
      `INSERT IGNORE INTO opening_lines
       (id, opening_id, title, slug, eco, pgn, final_fen, ply_count, description,
        difficulty, commonness, priority, is_must_know, is_trap, line_type, color,
        strategic_summary, hint_text, punishment_idea, pawn_structure, themes,
        sort_order, is_published, author_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId,
        openingId,
        line.title,
        line.slug,
        line.eco,
        line.pgn,
        line.finalFen,
        line.plyCount || 0,
        line.description || null,
        line.difficulty || "intermediate",
        line.commonness || 50,
        line.priority || 50,
        line.isMustKnow ? 1 : 0,
        line.isTrap ? 1 : 0,
        line.lineType || "main",
        line.color,
        line.strategicSummary || null,
        line.hintText || null,
        line.punishmentIdea || null,
        line.pawnStructure || null,
        line.themes ? JSON.stringify(line.themes) : null,
        line.sortOrder || 100,
        1, // published
        line.authorName || null,
      ]
    );
    counts.lines++;

    // ── Line-level tags ──
    for (const tagSlug of line.tags || []) {
      const tagId = tagIdBySlug.get(tagSlug);
      if (!tagId) continue;
      await conn.execute(
        `INSERT IGNORE INTO line_tag_map (id, tag_id, line_id) VALUES (?, ?, ?)`,
        [nanoid(), tagId, lineId]
      );
      counts.lineTagMaps++;
    }

    // ── Nodes (move tree) ──
    const nodeIdByPly = new Map();
    let prevNodeId = null;

    for (const node of line.nodes || []) {
      const nodeId = nanoid();
      nodeIdByPly.set(node.ply, nodeId);

      // parentNodeId: for ply > 0, use the previous main-line node
      const parentNodeId = node.ply > 0 ? prevNodeId : null;

      await conn.execute(
        `INSERT IGNORE INTO line_nodes
         (id, line_id, parent_node_id, ply, move_san, move_uci, fen,
          is_main_line, annotation, nag, eval, transposition_node_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nodeId,
          lineId,
          parentNodeId,
          node.ply,
          node.moveSan || null,
          node.moveUci || null,
          node.fen,
          node.isMainLine ? 1 : 0,
          node.annotation || null,
          node.nag || null,
          node.eval || null,
          node.transpositionNodeId || null,
          node.sortOrder || 0,
        ]
      );
      counts.nodes++;

      if (node.isMainLine) prevNodeId = nodeId;
    }

    // ── Model games ──
    for (const game of line.modelGames || []) {
      await conn.execute(
        `INSERT IGNORE INTO model_games
         (id, line_id, title, white_player, black_player, event, year, result,
          pgn, final_fen, total_moves, commentary, selection_reason, sort_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nanoid(),
          lineId,
          game.title,
          game.whitePlayer,
          game.blackPlayer,
          game.event || null,
          game.year || null,
          game.result,
          game.pgn,
          game.finalFen || null,
          game.totalMoves || null,
          game.commentary || null,
          game.selectionReason || null,
          game.sortOrder || 0,
          1, // published
        ]
      );
      counts.modelGames++;
    }
  }
}

console.log(`  ✓ ${counts.openings} openings`);
console.log(`  ✓ ${counts.lines} lines`);
console.log(`  ✓ ${counts.nodes} nodes`);
console.log(`  ✓ ${counts.modelGames} model games`);
console.log(`  ✓ ${counts.openingTagMaps} opening-tag links`);
console.log(`  ✓ ${counts.lineTagMaps} line-tag links`);

// ─── Verify ──────────────────────────────────────────────────────────────────
console.log("\nVerifying row counts...");
const tables = [
  "opening_tags", "openings", "opening_lines", "line_nodes",
  "model_games", "opening_tag_map", "line_tag_map",
];
for (const t of tables) {
  const [rows] = await conn.execute(`SELECT COUNT(*) AS cnt FROM ${t}`);
  console.log(`  ${t}: ${rows[0].cnt} rows`);
}

await conn.end();
console.log("\nSeed complete.");
