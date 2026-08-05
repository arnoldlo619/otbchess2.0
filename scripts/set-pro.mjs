import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env file
const envPath = resolve(__dirname, "../.env");
let DATABASE_URL;
try {
  const envContent = readFileSync(envPath, "utf8");
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
} catch {}

if (!DATABASE_URL) {
  DATABASE_URL = process.env.DATABASE_URL;
}

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

const email = "humbleinvestment619@gmail.com";

// Find user first
const existing = await db.select({ id: users.id, email: users.email, displayName: users.displayName, isPro: users.isPro })
  .from(users)
  .where(eq(users.email, email));

if (existing.length === 0) {
  console.error(`No user found with email: ${email}`);
  await connection.end();
  process.exit(1);
}

console.log("Found user:", existing[0]);

// Set isPro = true, proExpiresAt = null (permanent)
await db.update(users)
  .set({ isPro: true, proExpiresAt: null })
  .where(eq(users.email, email));

// Verify
const updated = await db.select({ id: users.id, email: users.email, isPro: users.isPro, proExpiresAt: users.proExpiresAt })
  .from(users)
  .where(eq(users.email, email));

console.log("Updated user:", updated[0]);
console.log("✅ Pro membership activated for", email);

await connection.end();
