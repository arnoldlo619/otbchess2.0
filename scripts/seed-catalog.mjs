/**
 * seed-catalog.mjs — Idempotent catalog seed script for ChessOTB openings explorer.
 *
 * Reads data/openings-catalog-seed.json and upserts:
 *   - opening_tags (extended taxonomy)
 *   - openings (16 launch openings with all catalog metadata)
 *   - opening_tag_map (many-to-many links)
 *
 * Usage: node scripts/seed-catalog.mjs
 *
 * Safe to run multiple times — uses INSERT IGNORE + ON DUPLICATE KEY UPDATE.
 */

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { randomBytes } from "crypto";

const nanoid = () => randomBytes(12).toString("base64url");

const seed = JSON.parse(
  readFileSync(new URL("../data/openings-catalog-seed.json", import.meta.url), "utf-8")
);

const conn = await createConnection(process.env.DATABASE_URL);

console.log("🏷️  Upserting tags...");
let tagCount = 0;
const tagIdMap = {};

for (const tag of seed.tags) {
  const id = nanoid();
  await conn.execute(
    `INSERT IGNORE INTO opening_tags (id, slug, name, category, description)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tag.slug, tag.name, tag.category, tag.description]
  );
  // Fetch the actual ID (may already exist)
  const [rows] = await conn.execute(
    `SELECT id FROM opening_tags WHERE slug = ?`,
    [tag.slug]
  );
  tagIdMap[tag.slug] = rows[0].id;
  tagCount++;
}
console.log(`   ✓ ${tagCount} tags processed (${Object.keys(tagIdMap).length} in map)`);

console.log("\n♟️  Upserting openings...");
let openingCount = 0;

for (let i = 0; i < seed.openings.length; i++) {
  const o = seed.openings[i];
  const id = nanoid();
  const themes = JSON.stringify(o.themes || []);
  const sortOrder = (i + 1) * 10; // 10, 20, 30, ...

  await conn.execute(
    `INSERT INTO openings (
      id, name, slug, eco, color, starting_moves, starting_fen,
      description, summary, difficulty, popularity, play_character,
      themes, line_count, sort_order, is_published,
      is_featured, starter_friendly, estimated_line_count,
      trap_potential, strategic_complexity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      eco = VALUES(eco),
      color = VALUES(color),
      starting_moves = VALUES(starting_moves),
      starting_fen = VALUES(starting_fen),
      description = VALUES(description),
      summary = VALUES(summary),
      difficulty = VALUES(difficulty),
      popularity = VALUES(popularity),
      play_character = VALUES(play_character),
      themes = VALUES(themes),
      sort_order = VALUES(sort_order),
      is_published = VALUES(is_published),
      is_featured = VALUES(is_featured),
      starter_friendly = VALUES(starter_friendly),
      estimated_line_count = VALUES(estimated_line_count),
      trap_potential = VALUES(trap_potential),
      strategic_complexity = VALUES(strategic_complexity)`,
    [
      id,
      o.name,
      o.slug,
      o.eco,
      o.color,
      o.startingMoves,
      o.startingFen,
      o.description,
      o.summary,
      o.difficulty,
      o.popularity,
      o.playCharacter,
      themes,
      o.estimatedLineCount || 0,
      sortOrder,
      1, // published
      o.isFeatured ? 1 : 0,
      o.starterFriendly ? 1 : 0,
      o.estimatedLineCount || 0,
      o.trapPotential || 50,
      o.strategicComplexity || 50,
    ]
  );

  // Get the actual opening ID
  const [rows] = await conn.execute(
    `SELECT id FROM openings WHERE slug = ?`,
    [o.slug]
  );
  const openingId = rows[0].id;

  // Upsert tag mappings (themes + tags combined)
  const allTagSlugs = [...(o.themes || []), ...(o.tags || [])];
  const uniqueSlugs = [...new Set(allTagSlugs)];

  for (const tagSlug of uniqueSlugs) {
    const tagId = tagIdMap[tagSlug];
    if (!tagId) {
      console.log(`   ⚠ Tag "${tagSlug}" not found in tag map, skipping`);
      continue;
    }
    await conn.execute(
      `INSERT IGNORE INTO opening_tag_map (id, opening_id, tag_id)
       VALUES (?, ?, ?)`,
      [nanoid(), openingId, tagId]
    );
  }

  openingCount++;
  console.log(`   ✓ ${o.name} (${o.slug}) — ${uniqueSlugs.length} tags`);
}

console.log(`\n✅ Catalog seed complete: ${openingCount} openings, ${tagCount} tags`);

// Verify
const [openingsCount] = await conn.execute(`SELECT COUNT(*) as c FROM openings`);
const [tagsCount] = await conn.execute(`SELECT COUNT(*) as c FROM opening_tags`);
const [mapsCount] = await conn.execute(`SELECT COUNT(*) as c FROM opening_tag_map`);
console.log(`\n📊 Database totals:`);
console.log(`   Openings: ${openingsCount[0].c}`);
console.log(`   Tags: ${tagsCount[0].c}`);
console.log(`   Tag mappings: ${mapsCount[0].c}`);

await conn.end();
