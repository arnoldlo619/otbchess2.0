/**
 * Openings Library Database Audit
 * Checks all published openings and lines for completeness.
 * Run: node audit-openings-db.mjs
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set in environment");

// Parse the DATABASE_URL
const url = new URL(dbUrl);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || "4000"),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log("✅ Connected to database\n");

// ─── 1. Published openings ────────────────────────────────────────────────────
const [openings] = await conn.execute(
  `SELECT id, name, slug, color, description, is_published FROM openings WHERE is_published = 1`
);
console.log(`📂 Published openings: ${openings.length}`);

const openingIssues = [];
for (const o of openings) {
  const issues = [];
  if (!o.description || o.description.trim() === "") issues.push("missing description");
  if (!o.color) issues.push("missing color (side)");
  if (issues.length) openingIssues.push({ name: o.name, slug: o.slug, issues });
}

if (openingIssues.length === 0) {
  console.log("  ✅ All published openings have complete data\n");
} else {
  console.log(`  ⚠️  ${openingIssues.length} openings with issues:`);
  for (const o of openingIssues) console.log(`     - ${o.name} (${o.slug}): ${o.issues.join(", ")}`);
  console.log();
}

// ─── 2. Published lines ───────────────────────────────────────────────────────
const [lines] = await conn.execute(
  `SELECT id, title, slug, opening_id, pgn, final_fen, ply_count, difficulty,
          strategic_summary, hint_text, punishment_idea, line_type, is_must_know, is_trap,
          is_published
   FROM opening_lines WHERE is_published = 1`
);
console.log(`📋 Published lines: ${lines.length}`);

const lineIssues = [];
for (const l of lines) {
  const issues = [];
  if (!l.pgn || l.pgn.trim() === "") issues.push("missing PGN");
  if (!l.final_fen || l.final_fen.trim() === "") issues.push("missing finalFen");
  if (!l.ply_count || l.ply_count === 0) issues.push("ply_count is 0");
  if (!l.difficulty) issues.push("missing difficulty");
  if (!l.strategic_summary || l.strategic_summary.trim() === "") issues.push("missing strategicSummary");
  if (!l.hint_text || l.hint_text.trim() === "") issues.push("missing hintText");
  if (issues.length) lineIssues.push({ title: l.title, slug: l.slug, issues });
}

if (lineIssues.length === 0) {
  console.log("  ✅ All published lines have complete data\n");
} else {
  console.log(`  ⚠️  ${lineIssues.length} lines with issues:`);
  for (const l of lineIssues) console.log(`     - ${l.title} (${l.slug}): ${l.issues.join(", ")}`);
  console.log();
}

// ─── 3. Lines without nodes ───────────────────────────────────────────────────
const [lineIds] = await conn.execute(
  `SELECT id, title, slug FROM opening_lines WHERE is_published = 1`
);
const [nodeCountRows] = await conn.execute(
  `SELECT line_id, COUNT(*) as cnt FROM line_nodes GROUP BY line_id`
);
const nodeCountMap = {};
for (const r of nodeCountRows) nodeCountMap[r.line_id] = r.cnt;

const linesWithoutNodes = lineIds.filter((l) => !nodeCountMap[l.id] || nodeCountMap[l.id] === 0);
console.log(`🔢 Lines without nodes: ${linesWithoutNodes.length}`);
if (linesWithoutNodes.length > 0) {
  for (const l of linesWithoutNodes) console.log(`   - ${l.title} (${l.slug})`);
} else {
  console.log("  ✅ All published lines have nodes\n");
}

// ─── 4. Lines with very few nodes (< 5) ──────────────────────────────────────
const linesWithFewNodes = lineIds.filter((l) => nodeCountMap[l.id] && nodeCountMap[l.id] < 5);
console.log(`\n⚠️  Lines with fewer than 5 nodes: ${linesWithFewNodes.length}`);
if (linesWithFewNodes.length > 0) {
  for (const l of linesWithFewNodes) {
    console.log(`   - ${l.title} (${l.slug}): ${nodeCountMap[l.id]} nodes`);
  }
}

// ─── 5. Openings with no published lines ─────────────────────────────────────
const [openingLineCounts] = await conn.execute(
  `SELECT opening_id, COUNT(*) as cnt FROM opening_lines WHERE is_published = 1 GROUP BY opening_id`
);
const openingLineCountMap = {};
for (const r of openingLineCounts) openingLineCountMap[r.opening_id] = r.cnt;

const openingsWithNoLines = openings.filter((o) => !openingLineCountMap[o.id]);
console.log(`\n📭 Published openings with no published lines: ${openingsWithNoLines.length}`);
if (openingsWithNoLines.length > 0) {
  for (const o of openingsWithNoLines) console.log(`   - ${o.name} (${o.slug})`);
} else {
  console.log("  ✅ All published openings have at least one published line");
}

// ─── 6. Summary ───────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════");
console.log("AUDIT SUMMARY");
console.log("═══════════════════════════════════════════");
console.log(`Published openings:          ${openings.length}`);
console.log(`Published lines:             ${lines.length}`);
console.log(`Openings with data issues:   ${openingIssues.length}`);
console.log(`Lines with data issues:      ${lineIssues.length}`);
console.log(`Lines without nodes:         ${linesWithoutNodes.length}`);
console.log(`Lines with < 5 nodes:        ${linesWithFewNodes.length}`);
console.log(`Openings with no lines:      ${openingsWithNoLines.length}`);

await conn.end();
