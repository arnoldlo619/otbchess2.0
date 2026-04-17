/**
 * Migration: add is_staff column to users table and seed the first staff member.
 *
 * Run: node scripts/add-staff-role.mjs
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually without dotenv dependency
try {
  const envPath = join(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found — rely on process.env */ }

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set");
  process.exit(1);
}

// Parse mysql2 connection from URL
const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

console.log("✅  Connected to database");

// ── 1. Add is_staff column if it doesn't exist ────────────────────────────────
try {
  await conn.execute(`
    ALTER TABLE users
    ADD COLUMN is_staff BOOLEAN NOT NULL DEFAULT FALSE
  `);
  console.log("✅  Added is_staff column to users table");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️   is_staff column already exists — skipping ALTER");
  } else {
    throw err;
  }
}

// ── 2. Seed arnoldlo619@gmail.com as OTB Staff ────────────────────────────────
const STAFF_EMAIL = "arnoldlo619@gmail.com";

const [rows] = await conn.execute(
  "SELECT id, email, is_staff FROM users WHERE email = ?",
  [STAFF_EMAIL]
);

if (rows.length === 0) {
  console.log(`ℹ️   Account ${STAFF_EMAIL} not found in DB yet.`);
  console.log("    The account will be marked as staff automatically on first login.");
  console.log("    (The server auth route will check for this email and set isStaff = true)");
} else {
  const user = rows[0];
  if (user.is_staff) {
    console.log(`ℹ️   ${STAFF_EMAIL} is already marked as OTB Staff`);
  } else {
    await conn.execute(
      "UPDATE users SET is_staff = TRUE, is_pro = TRUE WHERE email = ?",
      [STAFF_EMAIL]
    );
    console.log(`✅  Marked ${STAFF_EMAIL} as OTB Staff (isStaff = true, isPro = true)`);
  }
}

// ── 3. Verify ─────────────────────────────────────────────────────────────────
const [verify] = await conn.execute(
  "SELECT id, email, is_pro, is_staff FROM users WHERE email = ?",
  [STAFF_EMAIL]
);

if (verify.length > 0) {
  const u = verify[0];
  console.log(`\n📋  Staff account status:`);
  console.log(`    email:    ${u.email}`);
  console.log(`    isPro:    ${u.is_pro ? "✅ true" : "❌ false"}`);
  console.log(`    isStaff:  ${u.is_staff ? "✅ true" : "❌ false"}`);
} else {
  console.log(`\nℹ️   ${STAFF_EMAIL} not yet registered — will be auto-promoted on first login.`);
}

await conn.end();
console.log("\n✅  Migration complete");
