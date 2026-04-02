/**
 * Direct SQL migration: create saved_prep_reports table
 * Run with: node scripts/migrate-saved-prep.mjs
 */
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env manually
try {
  const envFile = readFileSync(path.join(__dirname, "../.env"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
} catch { /* .env may not exist in production */ }

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`saved_prep_reports\` (
      \`id\`                 INT          NOT NULL AUTO_INCREMENT,
      \`user_id\`            VARCHAR(36)  NOT NULL,
      \`opponent_username\`  VARCHAR(100) NOT NULL,
      \`opponent_name\`      VARCHAR(100) NULL,
      \`win_rate\`           INT          NULL,
      \`games_analyzed\`     INT          NULL,
      \`prep_lines_count\`   INT          NULL,
      \`report_json\`        TEXT         NOT NULL,
      \`saved_at\`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`spr_user_id_idx\` (\`user_id\`),
      INDEX \`spr_user_opponent_idx\` (\`user_id\`, \`opponent_username\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log("✓ saved_prep_reports table created (or already exists)");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
