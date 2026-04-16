#!/usr/bin/env node
/**
 * seed-nodes.mjs — Seeds line_nodes from node-trees-seed.json
 * 
 * Idempotent: deletes existing nodes for the target lines before inserting.
 * Run: node scripts/seed-nodes.mjs
 */

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const data = JSON.parse(readFileSync("data/node-trees-seed.json", "utf-8"));
const nodes = data.nodes;

console.log(`\n🌳 Seeding ${nodes.length} nodes across ${data.meta.lines} lines...\n`);

const conn = await createConnection(DATABASE_URL);

// Get unique line IDs
const lineIds = [...new Set(nodes.map((n) => n.lineId))];

// Delete existing nodes for these lines (idempotent)
for (const lineId of lineIds) {
  await conn.query("DELETE FROM line_nodes WHERE line_id = ?", [lineId]);
}
console.log(`  ✓ Cleared existing nodes for ${lineIds.length} lines`);

// Insert in batches of 50
const BATCH_SIZE = 50;
let inserted = 0;

for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
  const batch = nodes.slice(i, i + BATCH_SIZE);
  const values = batch.map((n) => [
    n.id,
    n.lineId,
    n.parentNodeId,
    n.ply,
    n.moveSan,
    n.moveUci,
    n.fen,
    n.isMainLine,
    n.annotation,
    n.nag,
    n.eval,
    n.transpositionNodeId,
    n.sortOrder,
  ]);

  await conn.query(
    `INSERT INTO line_nodes (id, line_id, parent_node_id, ply, move_san, move_uci, fen, is_main_line, annotation, nag, \`eval\`, transposition_node_id, sort_order)
     VALUES ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
    values.flat()
  );

  inserted += batch.length;
  process.stdout.write(`  ✓ Inserted ${inserted}/${nodes.length} nodes\r`);
}

console.log(`\n\n✅ Done! ${inserted} nodes seeded across ${lineIds.length} lines.`);

// Verify
const [rows] = await conn.query("SELECT COUNT(*) as cnt FROM line_nodes");
console.log(`   Total nodes in DB: ${rows[0].cnt}`);

// Show per-line breakdown
const [breakdown] = await conn.query(
  `SELECT ln.line_id, ol.title, COUNT(*) as node_count 
   FROM line_nodes ln 
   JOIN opening_lines ol ON ln.line_id = ol.id 
   WHERE ln.line_id IN (${lineIds.map(() => "?").join(",")})
   GROUP BY ln.line_id, ol.title 
   ORDER BY ol.title`,
  lineIds
);

console.log("\n   Per-line breakdown:");
for (const row of breakdown) {
  console.log(`     ${row.title}: ${row.node_count} nodes`);
}

await conn.end();
