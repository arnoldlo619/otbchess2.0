import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

// Manually load .env since dotenv may not be available as ESM
try {
  const env = readFileSync("/home/ubuntu/otb-chess/.env", "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
} catch {}


const conn = await createConnection(process.env.DATABASE_URL);

const [existing] = await conn.execute("SHOW TABLES LIKE 'chess_player_cache'");
if (existing.length > 0) {
  console.log("✓ chess_player_cache already exists");
} else {
  await conn.execute(`
    CREATE TABLE chess_player_cache (
      username    VARCHAR(100) NOT NULL PRIMARY KEY,
      profile_json TEXT        NOT NULL,
      stats_json   TEXT        NOT NULL,
      cached_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ chess_player_cache created");
}

await conn.end();
