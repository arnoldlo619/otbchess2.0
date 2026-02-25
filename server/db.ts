/**
 * Database connection singleton for the OTB Chess server.
 * Uses Drizzle ORM with the mysql2 driver connecting to TiDB Cloud.
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

export async function getDb() {
  if (_db) return _db as ReturnType<typeof drizzle<typeof schema>>;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = mysql.createPool({
    uri: url,
    ssl: { rejectUnauthorized: true },
    connectionLimit: 5,
    waitForConnections: true,
  });

  _db = drizzle(pool, { schema, mode: "default" });
  return _db as ReturnType<typeof drizzle<typeof schema>>;
}
