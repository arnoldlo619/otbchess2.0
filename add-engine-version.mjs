/**
 * One-time migration: add engine_version column to prep_cache table
 * and purge all existing cached reports so they get rebuilt with the new ECO book.
 * Run: node add-engine-version.mjs
 */
import { createConnection } from '/home/ubuntu/otb-chess/node_modules/.pnpm/mysql2@3.18.0_@types+node@24.7.0/node_modules/mysql2/promise.js';
import { readFileSync } from 'fs';

// Manually load .env since dotenv may not be available as ESM
try {
  const envFile = readFileSync('/home/ubuntu/otb-chess/.env', 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
} catch (_) {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse mysql://user:pass@host:port/dbname?ssl=...
const parsed = new URL(url.replace(/^mysql:/, 'mysql:'));
const user = parsed.username;
const password = parsed.password;
const host = parsed.hostname;
const port = parseInt(parsed.port) || 3306;
const database = parsed.pathname.replace(/^\//, '').split('?')[0];

console.log(`Connecting to ${host}:${port}/${database} as ${user}`);

const conn = await createConnection({ host, port, user, password, database, ssl: { rejectUnauthorized: false } });

try {
  // 1. Add engine_version column if it doesn't exist
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'prep_cache' AND COLUMN_NAME = 'engine_version'`,
    [database]
  );
  
  if (cols.length === 0) {
    await conn.execute(`ALTER TABLE prep_cache ADD COLUMN engine_version VARCHAR(20) DEFAULT '1.0.0'`);
    console.log('✓ Added engine_version column to prep_cache');
  } else {
    console.log('ℹ engine_version column already exists');
  }

  // 2. Purge ALL existing cached reports so they get rebuilt with the new Jobava London ECO
  const [result] = await conn.execute(`DELETE FROM prep_cache WHERE 1=1`);
  console.log(`✓ Purged ${result.affectedRows} cached prep reports (will rebuild on next request)`);

} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await conn.end();
}

console.log('Migration complete!');
