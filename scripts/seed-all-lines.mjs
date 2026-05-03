/**
 * seed-all-lines.mjs — Seed ALL opening lines AND their node trees
 * from the unified line-packs-seed.json.
 *
 * Idempotent: uses REPLACE INTO for lines, DELETE+INSERT for nodes.
 * Usage: node scripts/seed-all-lines.mjs
 */
import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { nanoid } from "nanoid";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const data = JSON.parse(
  readFileSync(new URL("../data/line-packs-seed.json", import.meta.url), "utf8")
);

async function main() {
  const conn = await createConnection(DATABASE_URL);

  // Resolve opening slugs → IDs
  const [openings] = await conn.execute("SELECT id, slug FROM openings");
  const slugToId = Object.fromEntries(openings.map((r) => [r.slug, r.id]));

  let totalLinesInserted = 0;
  let totalLinesSkipped = 0;
  let totalNodesInserted = 0;

  for (const [packSlug, pack] of Object.entries(data.linePacks)) {
    const openingId = slugToId[packSlug];
    if (!openingId) {
      console.warn(`⚠️  No opening found for slug "${packSlug}" — skipping`);
      totalLinesSkipped += pack.lines.length;
      continue;
    }

    console.log(`\n📦 ${pack.openingName} (${pack.lines.length} lines)`);

    for (const line of pack.lines) {
      const slug = line.slug;

      // Check if line already exists by slug
      const [existing] = await conn.execute(
        "SELECT id FROM opening_lines WHERE slug = ?",
        [slug]
      );

      const lineId = existing.length > 0 ? existing[0].id : nanoid(16);

      // Build description from line summary + strategic goal
      const description = [line.lineSummary, line.strategicGoal]
        .filter(Boolean)
        .join("\n\n");

      // Build punishment text from common mistake + punishment idea
      const punishment = [line.commonOpponentMistake, line.punishmentIdea]
        .filter(Boolean)
        .join(" → ");

      // Upsert the line
      const lineSql = `
        REPLACE INTO opening_lines (
          id, opening_id, title, slug, eco, pgn, final_fen, ply_count,
          description, difficulty, commonness, priority,
          is_must_know, is_trap, line_type, color,
          strategic_summary, hint_text, punishment_idea,
          pawn_structure, themes, sort_order, is_published, author_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await conn.execute(lineSql, [
        lineId,
        openingId,
        line.title,
        slug,
        line.eco,
        line.pgn,
        line.finalFen || "",
        line.plyCount || 0,
        description || null,
        line.difficulty,
        line.commonness,
        line.priority,
        line.isMustKnow ? 1 : 0,
        line.isTrap ? 1 : 0,
        line.lineType,
        line.color,
        line.strategicGoal || null,
        line.hintText || null,
        punishment || null,
        line.pawnStructure || null,
        line.themes ? JSON.stringify(line.themes) : null,
        line.sortOrder,
        1, // is_published
        "ChessOTB Staff",
      ]);

      const action = existing.length > 0 ? "updated" : "inserted";
      totalLinesInserted++;

      // Now seed nodes for this line
      const nodes = line.nodes || [];
      if (nodes.length === 0) {
        console.log(`   ✅ ${action}: ${line.title} (${slug}) — 0 nodes`);
        continue;
      }

      // Delete existing nodes for this line
      await conn.execute("DELETE FROM line_nodes WHERE line_id = ?", [lineId]);

      // Generate node IDs and parent references
      const nodeIds = nodes.map(() => nanoid(16));
      
      // Insert nodes in batches
      const BATCH_SIZE = 50;
      let nodesInserted = 0;

      for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
        const batch = nodes.slice(i, i + BATCH_SIZE);
        const batchIds = nodeIds.slice(i, i + BATCH_SIZE);

        const values = batch.map((n, batchIdx) => {
          const globalIdx = i + batchIdx;
          const parentId = globalIdx === 0 ? null : nodeIds[globalIdx - 1];
          return [
            batchIds[batchIdx],  // id
            lineId,               // line_id
            parentId,             // parent_node_id
            n.ply,                // ply
            n.moveSan || null,    // move_san
            n.moveUci || null,    // move_uci
            n.fen,                // fen
            n.isMainLine ? 1 : 0, // is_main_line
            n.annotation || null,  // annotation
            n.nag || null,         // nag
            n.eval || null,        // eval
            null,                  // transposition_node_id
            globalIdx,             // sort_order
          ];
        });

        const placeholders = values
          .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .join(", ");

        await conn.query(
          `INSERT INTO line_nodes (id, line_id, parent_node_id, ply, move_san, move_uci, fen, is_main_line, annotation, nag, \`eval\`, transposition_node_id, sort_order)
           VALUES ${placeholders}`,
          values.flat()
        );

        nodesInserted += batch.length;
      }

      totalNodesInserted += nodesInserted;
      console.log(`   ✅ ${action}: ${line.title} (${slug}) — ${nodesInserted} nodes`);
    }

    // Update the opening's lineCount
    const lineCount = pack.lines.length;
    await conn.execute(
      "UPDATE openings SET line_count = ? WHERE id = ?",
      [lineCount, openingId]
    );
  }

  // Verify counts
  const [lineCount] = await conn.execute("SELECT COUNT(*) as cnt FROM opening_lines");
  const [nodeCount] = await conn.execute("SELECT COUNT(*) as cnt FROM line_nodes");

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Lines inserted/updated: ${totalLinesInserted}`);
  console.log(`   Lines skipped (no opening): ${totalLinesSkipped}`);
  console.log(`   Nodes inserted: ${totalNodesInserted}`);
  console.log(`   Total lines in DB: ${lineCount[0].cnt}`);
  console.log(`   Total nodes in DB: ${nodeCount[0].cnt}`);

  await conn.end();
  console.log(`\n✅ Complete seeding done!`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
