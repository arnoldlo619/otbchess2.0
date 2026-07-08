import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

// Load env
const envPath = new URL("../.env", import.meta.url).pathname;
const env = {};
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// 1. List all clubs
const [clubs] = await conn.execute("SELECT id, name, location, city, avatar_url, banner_url FROM clubs ORDER BY name");
console.log("=== CURRENT CLUBS ===");
for (const c of clubs) {
  console.log(`  id=${c.id} | name="${c.name}" | city="${c.city}" | avatar=${c.avatar_url}`);
}

await conn.end();
