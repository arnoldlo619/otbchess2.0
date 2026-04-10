/**
 * Admin script: delete 6 test clubs and all their related data.
 * Run from the project root: node scripts/delete-clubs.mjs
 * Uses mysql2 to match the server's database driver (TiDB Cloud).
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment. Run via: DATABASE_URL=... node scripts/delete-clubs.mjs");
  process.exit(1);
}

const pool = await mysql.createPool({
  uri: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectionLimit: 3,
  waitForConnections: true,
});

const CLUB_IDS_TO_DELETE = [
  "r0s9i1us", // SD Social Chess Club (1 member)
  "cdnwuxss", // San Diego OTB Chess (1 member)
  "u6ffe0hl", // OTB Chess Club duplicate (1 member)
  "wij0mi39", // The OTB Club (1 member)
  "wr21lxke", // SD Social Chess Club duplicate (1 member)
  "xl7q812b", // San Diego Chess (1 member)
];

async function run(sql, ...params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function deleteClub(clubId) {
  console.log(`\nDeleting club: ${clubId}`);

  // 1. League sub-tables
  const leagueRows = await run("SELECT id FROM leagues WHERE club_id = ?", clubId);
  for (const lg of leagueRows) {
    await run("DELETE FROM league_matches WHERE league_id = ?", lg.id);
    await run("DELETE FROM league_standings WHERE league_id = ?", lg.id);
    await run("DELETE FROM league_weeks WHERE league_id = ?", lg.id);
    await run("DELETE FROM league_players WHERE league_id = ?", lg.id);
    await run("DELETE FROM league_join_requests WHERE league_id = ?", lg.id);
    await run("DELETE FROM league_invites WHERE league_id = ?", lg.id);
    console.log(`  Deleted league sub-tables for league ${lg.id}`);
  }
  await run("DELETE FROM leagues WHERE club_id = ?", clubId);

  // 2. Events and RSVPs
  const evRows = await run("SELECT id FROM club_events WHERE club_id = ?", clubId);
  for (const ev of evRows) {
    await run("DELETE FROM club_event_rsvps WHERE event_id = ?", ev.id);
  }
  await run("DELETE FROM club_events WHERE club_id = ?", clubId);

  // 3. Feed
  await run("DELETE FROM club_feed WHERE club_id = ?", clubId);

  // 4. Battles
  await run("DELETE FROM club_battles WHERE club_id = ?", clubId);

  // 5. Invites
  await run("DELETE FROM club_invites WHERE club_id = ?", clubId);

  // 6. Messaging
  const convRows = await run("SELECT id FROM club_conversations WHERE club_id = ?", clubId);
  for (const conv of convRows) {
    await run("DELETE FROM club_chess_games WHERE conversation_id = ?", conv.id);
    await run("DELETE FROM club_messages WHERE conversation_id = ?", conv.id);
  }
  await run("DELETE FROM club_conversations WHERE club_id = ?", clubId);

  // 7. Members
  await run("DELETE FROM club_members WHERE club_id = ?", clubId);

  // 8. The club itself
  const result = await run("DELETE FROM clubs WHERE id = ? RETURNING name", clubId).catch(async () => {
    // MySQL doesn't support RETURNING — fetch name first then delete
    return null;
  });

  // MySQL-compatible approach: get name first, then delete
  const [nameRows] = await pool.execute("SELECT name FROM clubs WHERE id = ?", [clubId]);
  await pool.execute("DELETE FROM clubs WHERE id = ?", [clubId]);
  const clubName = nameRows.length > 0 ? nameRows[0].name : "(not found)";
  console.log(`  ✓ Deleted club: "${clubName}" (${clubId})`);
}

try {
  for (const id of CLUB_IDS_TO_DELETE) {
    await deleteClub(id);
  }
  console.log("\n✅ All 6 clubs deleted successfully.");
} catch (err) {
  console.error("\n❌ Error during deletion:", err);
} finally {
  await pool.end();
}
