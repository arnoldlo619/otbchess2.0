import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const env = {};
try {
  readFileSync(".env", "utf8").split("\n").forEach(l => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch {}

const url = process.env.DATABASE_URL || env.DATABASE_URL;
const conn = await createConnection(url);

// 1. Update Berlin Schachclub -> World Chess Club Berlin
await conn.execute(
  `UPDATE clubs SET name=?, slug=?, tagline=?, description=?, location=?, city=?, country=?, avatar_url=?, banner_url=?, website=?, is_verified=? WHERE id=?`,
  [
    "World Chess Club Berlin",
    "world-chess-club-berlin",
    "Berlin's Premier Chess Destination — Cafe, Bar & Club",
    "World Chess Club Berlin is a world-class chess venue located in the heart of Berlin, Germany. Combining a vibrant cafe and bar with serious competitive chess, WCCB hosts players of all levels — from casual drop-ins to titled grandmasters. The club is affiliated with the World Chess organization and serves as a cultural hub for the global chess community in Europe.",
    "Berlin, Germany",
    "Berlin",
    "DE",
    "/manus-storage/world-chess-club-berlin_4b6a47fc.png",
    "/manus-storage/world-chess-club-berlin_4b6a47fc.png",
    "https://worldchess.com",
    1,
    "seed-club-4"
  ]
);
console.log("1. Updated Berlin Schachclub -> World Chess Club Berlin");

// 2. Update NYC Chess Collective -> South Austin Chess Club
await conn.execute(
  `UPDATE clubs SET name=?, slug=?, tagline=?, description=?, location=?, city=?, country=?, avatar_url=?, banner_url=?, website=?, is_verified=? WHERE id=?`,
  [
    "South Austin Chess Club",
    "south-austin-chess-club",
    "Free Entry. All Levels Welcome. South Austin's Chess Home.",
    "South Austin Chess Club meets weekly at Buzz Mill Coffee in South Austin, TX. We run casual and rated OTB tournaments open to all skill levels — beginners to masters. Free entry, 5 rounds of 5+3 blitz, with prizes for top finishers. Come play, learn, and connect with Austin's growing chess community.",
    "Austin, TX",
    "Austin",
    "US",
    "/manus-storage/south-austin-chess-club_555adee3.jpeg",
    "/manus-storage/south-austin-chess-club_555adee3.jpeg",
    null,
    0,
    "seed-club-2"
  ]
);
console.log("2. Updated NYC Chess Collective -> South Austin Chess Club");

// 3. Update The OTB Club avatar/banner
await conn.execute(
  `UPDATE clubs SET avatar_url=?, banner_url=? WHERE id=?`,
  [
    "/manus-storage/otb-chess-club-logo_55025880.png",
    "/manus-storage/otb-chess-club-logo_55025880.png",
    "wij0mi39"
  ]
);
console.log("3. Updated The OTB Club avatar");

// 4. Create EXIT! CHESS CLUB
// First check if it already exists
const [existing] = await conn.execute("SELECT id FROM clubs WHERE slug=?", ["exit-chess-club"]);
if (existing.length > 0) {
  console.log("4. EXIT! CHESS CLUB already exists, updating...");
  await conn.execute(
    `UPDATE clubs SET name=?, tagline=?, description=?, location=?, city=?, country=?, avatar_url=?, banner_url=?, is_verified=? WHERE slug=?`,
    [
      "EXIT! CHESS CLUB",
      "Allston's Underground Chess Scene — Hosted by ChessOTB.club",
      "EXIT! Chess Club is Allston, MA's underground chess collective, hosted by ChessOTB.club. We bring together players of all levels for casual and competitive OTB chess in the heart of Allston. Weekly meetups feature blitz tournaments, casual games, and a welcoming community vibe. No entry fee, just bring your A-game.",
      "Allston, MA",
      "Boston",
      "US",
      "/manus-storage/exit-chess-club_d9101dc6.jpg",
      "/manus-storage/exit-chess-club_d9101dc6.jpg",
      1,
      "exit-chess-club"
    ]
  );
} else {
  console.log("4. Creating EXIT! CHESS CLUB...");
  // Get the owner ID from an existing club
  const [ownerRows] = await conn.execute("SELECT owner_id, owner_name FROM clubs WHERE id='wij0mi39' LIMIT 1");
  const ownerId = ownerRows[0]?.owner_id || "system";
  const ownerName = ownerRows[0]?.owner_name || "ChessOTB";

  await conn.execute(
    `INSERT INTO clubs (id, name, slug, tagline, description, location, city, country, avatar_url, banner_url, accent_color, owner_id, owner_name, member_count, is_public, is_verified, join_policy, status, category, meeting_schedule) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      "exit-chess-club-allston",
      "EXIT! CHESS CLUB",
      "exit-chess-club",
      "Allston's Underground Chess Scene — Hosted by ChessOTB.club",
      "EXIT! Chess Club is Allston, MA's underground chess collective, hosted by ChessOTB.club. We bring together players of all levels for casual and competitive OTB chess in the heart of Allston. Weekly meetups feature blitz tournaments, casual games, and a welcoming community vibe. No entry fee, just bring your A-game.",
      "Allston, MA",
      "Boston",
      "US",
      "/manus-storage/exit-chess-club_d9101dc6.jpg",
      "/manus-storage/exit-chess-club_d9101dc6.jpg",
      "#22c55e",
      ownerId,
      ownerName,
      1,
      1,
      1,
      "public",
      "published",
      "club",
      "weekly"
    ]
  );
}
console.log("4. EXIT! CHESS CLUB done");

await conn.end();
console.log("\nAll updates complete!");
process.exit(0);
