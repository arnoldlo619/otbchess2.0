/**
 * add-stripe-customer-id.mjs
 *
 * One-time migration: adds stripe_customer_id column to the users table.
 * Safe to run multiple times — uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 *
 * Usage: node scripts/add-stripe-customer-id.mjs
 */

import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  // Check if column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'stripe_customer_id'
     LIMIT 1`
  );

  if (rows.length > 0) {
    console.log("stripe_customer_id column already exists — skipping.");
  } else {
    await conn.execute(
      `ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL`
    );
    console.log("✓ Added stripe_customer_id column to users table.");
  }
} finally {
  await conn.end();
}
