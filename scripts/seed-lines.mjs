/**
 * seed-lines.mjs — Seed opening lines from line-packs-seed.json into the database.
 * Idempotent: uses REPLACE INTO so re-running updates existing rows.
 *
 * Usage: node scripts/seed-lines.mjs
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

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const [packSlug, pack] of Object.entries(data.linePacks)) {
    const openingId = slugToId[packSlug];
    if (!openingId) {
      console.warn(`⚠️  No opening found for slug "${packSlug}" — skipping`);
      totalSkipped += pack.lines.length;
      continue;
    }

    console.log(`\n📦 ${pack.openingName} (${pack.lineCount} lines)`);

    for (const line of pack.lines) {
      const id = nanoid(16);
      const slug = line.slug;

      // Check if line already exists by slug
      const [existing] = await conn.execute(
        "SELECT id FROM opening_lines WHERE slug = ?",
        [slug]
      );

      const lineId = existing.length > 0 ? existing[0].id : id;

      const sql = `
        REPLACE INTO opening_lines (
          id, opening_id, title, slug, eco, pgn, final_fen, ply_count,
          description, difficulty, commonness, priority,
          is_must_know, is_trap, line_type, color,
          strategic_summary, hint_text, punishment_idea,
          pawn_structure, themes, sort_order, is_published, author_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Build description from line summary + strategic goal
      const description = [line.lineSummary, line.strategicGoal]
        .filter(Boolean)
        .join("\n\n");

      // Build punishment text from common mistake + punishment idea
      const punishment = [line.commonOpponentMistake, line.punishmentIdea]
        .filter(Boolean)
        .join(" → ");

      await conn.execute(sql, [
        lineId,
        openingId,
        line.title,
        slug,
        line.eco,
        line.pgn,
        line.finalFen,
        line.plyCount,
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
      console.log(`   ✅ ${action}: ${line.title} (${slug})`);
      totalInserted++;
    }
  }

  // Verify counts
  const [countResult] = await conn.execute(
    "SELECT COUNT(*) as cnt FROM opening_lines"
  );
  console.log(`\n📊 Summary:`);
  console.log(`   Lines processed: ${totalInserted}`);
  console.log(`   Lines skipped: ${totalSkipped}`);
  console.log(`   Total lines in DB: ${countResult[0].cnt}`);

  await conn.end();
  console.log("\n✅ Line seeding complete!");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
