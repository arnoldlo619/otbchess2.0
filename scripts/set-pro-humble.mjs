/**
 * One-off script: grant Pro membership to humbleinvestment619@gmail.com
 * Usage: node scripts/set-pro-humble.mjs
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* rely on existing env */ }

const TARGET_EMAIL = "humbleinvestment619@gmail.com";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const conn = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true } });

  const [rows] = await conn.execute(
    "SELECT id, email, display_name, is_pro, is_staff FROM users WHERE email = ?",
    [TARGET_EMAIL]
  );

  if (!rows.length) {
    console.error(`❌  No user found with email: ${TARGET_EMAIL}`);
    await conn.end();
    process.exit(1);
  }

  const user = rows[0];
  console.log(`Found user: id=${user.id}  display_name=${user.display_name}  email=${user.email}`);
  console.log(`  Current: is_pro=${user.is_pro}  is_staff=${user.is_staff}`);

  const [result] = await conn.execute(
    "UPDATE users SET is_pro = 1, pro_expires_at = NULL WHERE email = ?",
    [TARGET_EMAIL]
  );
  console.log(`  Updated ${result.affectedRows} row(s).`);

  const [verify] = await conn.execute(
    "SELECT id, email, display_name, is_pro, pro_expires_at FROM users WHERE email = ?",
    [TARGET_EMAIL]
  );
  const u = verify[0];
  console.log(`✅  Done: id=${u.id}  display_name=${u.display_name}  is_pro=${u.is_pro}  pro_expires_at=${u.pro_expires_at}`);

  await conn.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
