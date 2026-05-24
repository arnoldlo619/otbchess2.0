import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);

await conn.execute(`
CREATE TABLE IF NOT EXISTS \`live_broadcasts\` (
  \`id\` varchar(36) NOT NULL,
  \`tournament_id\` varchar(36) NOT NULL,
  \`round_number\` int NOT NULL DEFAULT 1,
  \`board_number\` int NOT NULL DEFAULT 1,
  \`pairing_id\` varchar(36),
  \`white_player_name\` varchar(120) NOT NULL DEFAULT 'White',
  \`black_player_name\` varchar(120) NOT NULL DEFAULT 'Black',
  \`white_player_elo\` int,
  \`black_player_elo\` int,
  \`white_avatar_url\` varchar(500),
  \`black_avatar_url\` varchar(500),
  \`status\` varchar(20) NOT NULL DEFAULT 'ready',
  \`input_source\` varchar(30) NOT NULL DEFAULT 'manual',
  \`current_fen\` text NOT NULL,
  \`pgn\` mediumtext NOT NULL,
  \`last_move_san\` varchar(10),
  \`last_move_uci\` varchar(10),
  \`move_number\` int NOT NULL DEFAULT 0,
  \`side_to_move\` varchar(1) NOT NULL DEFAULT 'w',
  \`result\` varchar(10),
  \`public_slug\` varchar(20) NOT NULL,
  \`created_by\` varchar(36),
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`lb_public_slug_idx\` (\`public_slug\`),
  KEY \`lb_tournament_id_idx\` (\`tournament_id\`)
)
`);
console.log("✓ live_broadcasts table created");

await conn.execute(`
CREATE TABLE IF NOT EXISTS \`live_moves\` (
  \`id\` varchar(36) NOT NULL,
  \`broadcast_id\` varchar(36) NOT NULL,
  \`ply\` int NOT NULL,
  \`san\` varchar(10) NOT NULL,
  \`uci\` varchar(10) NOT NULL,
  \`fen_before\` text NOT NULL,
  \`fen_after\` text NOT NULL,
  \`source\` varchar(30) NOT NULL DEFAULT 'manual',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`lm_broadcast_id_idx\` (\`broadcast_id\`),
  KEY \`lm_ply_idx\` (\`broadcast_id\`, \`ply\`)
)
`);
console.log("✓ live_moves table created");

await conn.end();
console.log("Done.");
