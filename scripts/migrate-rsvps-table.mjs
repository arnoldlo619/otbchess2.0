/**
 * Direct SQL migration: create club_event_rsvps table.
 * Run with: node scripts/migrate-rsvps-table.mjs
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

const sql = `
  CREATE TABLE IF NOT EXISTS club_event_rsvps (
    id           VARCHAR(64)  NOT NULL PRIMARY KEY,
    event_id     VARCHAR(64)  NOT NULL,
    club_id      VARCHAR(64)  NOT NULL,
    user_id      VARCHAR(64)  NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url   TEXT,
    status       VARCHAR(20)  NOT NULL DEFAULT 'going',
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rsvp_event_user (event_id, user_id),
    INDEX idx_cer_event (event_id),
    INDEX idx_cer_club  (club_id),
    INDEX idx_cer_user  (user_id)
  )
`;

try {
  await pool.execute(sql);
  console.log("✓ Table club_event_rsvps created (or already exists)");
} catch (err) {
  console.error("✗ Error:", err.message);
  process.exit(1);
}

await pool.end();
console.log("Migration complete.");
