/**
 * Migration: add started_at column to user_tournaments table.
 * Run with: node scripts/add-started-at.mjs
 */
import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function run() {
  const conn = await createConnection(DATABASE_URL);
  console.log("Connected to database");

  // Check if column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'user_tournaments' AND COLUMN_NAME = 'started_at'`
  );

  if (rows.length > 0) {
    console.log("Column started_at already exists — skipping");
    await conn.end();
    return;
  }

  // Add the column
  await conn.execute(
    `ALTER TABLE user_tournaments ADD COLUMN started_at TIMESTAMP NULL DEFAULT NULL AFTER is_public`
  );
  console.log("✓ Added started_at column to user_tournaments");
  await conn.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
