/**
 * Direct SQL migration: create club_events and club_feed tables.
 * Run with: node scripts/migrate-club-tables.mjs
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env manually
try {
  const envPath = join(__dirname, "../.env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
} catch { /* .env not found, rely on process.env */ }

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const pool = mysql.createPool({ uri: url, ssl: { rejectUnauthorized: true }, connectionLimit: 2 });

const statements = [
  `CREATE TABLE IF NOT EXISTS club_events (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    club_id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NULL,
    venue VARCHAR(200),
    address VARCHAR(300),
    admission_note VARCHAR(200),
    cover_image_url TEXT,
    accent_color VARCHAR(20) NOT NULL DEFAULT '#4CAF50',
    creator_id VARCHAR(64) NOT NULL,
    creator_name VARCHAR(100) NOT NULL DEFAULT '',
    is_published TINYINT NOT NULL DEFAULT 1,
    event_type VARCHAR(30) NOT NULL DEFAULT 'standard',
    tournament_id VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ce_club_idx (club_id),
    INDEX ce_start_idx (start_at),
    INDEX ce_club_start_idx (club_id, start_at)
  )`,
  `CREATE TABLE IF NOT EXISTS club_feed (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    club_id VARCHAR(64) NOT NULL,
    type VARCHAR(40) NOT NULL,
    actor_name VARCHAR(100) NOT NULL DEFAULT '',
    actor_avatar_url TEXT,
    detail TEXT,
    link_href VARCHAR(500),
    link_label VARCHAR(100),
    is_pinned TINYINT NOT NULL DEFAULT 0,
    payload TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX cf_club_idx (club_id),
    INDEX cf_club_created_idx (club_id, created_at),
    INDEX cf_pinned_idx (club_id, is_pinned)
  )`,
];

for (const sql of statements) {
  try {
    await pool.execute(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✓ Table ${tableName} created (or already exists)`);
  } catch (err) {
    console.error("✗ Error:", err.message);
    process.exit(1);
  }
}

await pool.end();
console.log("Migration complete.");
