import mysql from "mysql2/promise";

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    // Add google_id column without unique constraint first
    await conn.execute("ALTER TABLE `users` ADD COLUMN `google_id` varchar(255)");
    console.log("google_id column added");
  } catch (e) {
    console.log("google_id add:", e.message);
  }
  try {
    // Add unique index separately (TiDB compatible)
    await conn.execute("CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`)");
    console.log("google_id unique index added");
  } catch (e) {
    console.log("google_id index:", e.message);
  }
  await conn.end();
  console.log("Migration complete");
}

run().catch(console.error);
