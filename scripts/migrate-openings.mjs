/**
 * migrate-openings.mjs
 *
 * Creates the openings database tables directly via SQL.
 * Uses CREATE TABLE IF NOT EXISTS to be idempotent.
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const tables = [
  // ── openings ──
  `CREATE TABLE IF NOT EXISTS openings (
    id varchar(36) NOT NULL PRIMARY KEY,
    name varchar(200) NOT NULL,
    slug varchar(200) NOT NULL UNIQUE,
    eco varchar(20) NOT NULL,
    color varchar(10) NOT NULL,
    starting_moves varchar(200) NOT NULL,
    starting_fen text NOT NULL,
    description text,
    summary varchar(300),
    difficulty varchar(20) NOT NULL DEFAULT 'intermediate',
    popularity int NOT NULL DEFAULT 50,
    play_character varchar(30) NOT NULL DEFAULT 'universal',
    themes text,
    line_count int NOT NULL DEFAULT 0,
    sort_order int NOT NULL DEFAULT 100,
    is_published tinyint NOT NULL DEFAULT 0,
    author_name varchar(100),
    cover_image_url text,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX op_slug_idx (slug),
    INDEX op_eco_idx (eco),
    INDEX op_color_idx (color),
    INDEX op_published_idx (is_published),
    INDEX op_sort_idx (sort_order)
  )`,

  // ── opening_lines ──
  `CREATE TABLE IF NOT EXISTS opening_lines (
    id varchar(36) NOT NULL PRIMARY KEY,
    opening_id varchar(36) NOT NULL,
    title varchar(300) NOT NULL,
    slug varchar(300) NOT NULL,
    eco varchar(10) NOT NULL,
    pgn text NOT NULL,
    final_fen text NOT NULL,
    ply_count int NOT NULL DEFAULT 0,
    description text,
    difficulty varchar(20) NOT NULL DEFAULT 'intermediate',
    commonness int NOT NULL DEFAULT 50,
    priority int NOT NULL DEFAULT 50,
    is_must_know tinyint NOT NULL DEFAULT 0,
    is_trap tinyint NOT NULL DEFAULT 0,
    line_type varchar(20) NOT NULL DEFAULT 'main',
    color varchar(10) NOT NULL,
    strategic_summary text,
    hint_text text,
    punishment_idea text,
    pawn_structure varchar(100),
    themes text,
    sort_order int NOT NULL DEFAULT 100,
    is_published tinyint NOT NULL DEFAULT 0,
    author_name varchar(100),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ol_opening_id_idx (opening_id),
    INDEX ol_slug_idx (slug),
    INDEX ol_eco_idx (eco),
    INDEX ol_color_idx (color),
    INDEX ol_priority_idx (priority),
    INDEX ol_must_know_idx (is_must_know),
    INDEX ol_trap_idx (is_trap),
    INDEX ol_published_idx (is_published),
    INDEX ol_opening_sort_idx (opening_id, sort_order)
  )`,

  // ── line_nodes ──
  `CREATE TABLE IF NOT EXISTS line_nodes (
    id varchar(36) NOT NULL PRIMARY KEY,
    line_id varchar(36) NOT NULL,
    parent_node_id varchar(36),
    ply int NOT NULL,
    move_san varchar(20),
    move_uci varchar(10),
    fen text NOT NULL,
    is_main_line tinyint NOT NULL DEFAULT 1,
    annotation text,
    nag int,
    eval int,
    transposition_node_id varchar(36),
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ln_line_id_idx (line_id),
    INDEX ln_parent_node_idx (parent_node_id),
    INDEX ln_line_ply_idx (line_id, ply),
    INDEX ln_transposition_idx (transposition_node_id)
  )`,

  // ── repertoires ──
  `CREATE TABLE IF NOT EXISTS repertoires (
    id varchar(36) NOT NULL PRIMARY KEY,
    title varchar(300) NOT NULL,
    slug varchar(300) NOT NULL,
    description text,
    color varchar(10) NOT NULL,
    target_level varchar(20) NOT NULL DEFAULT 'intermediate',
    author_type varchar(20) NOT NULL DEFAULT 'staff',
    author_name varchar(100),
    author_user_id varchar(36),
    is_published tinyint NOT NULL DEFAULT 0,
    is_featured tinyint NOT NULL DEFAULT 0,
    line_count int NOT NULL DEFAULT 0,
    estimated_minutes int,
    cover_image_url text,
    sort_order int NOT NULL DEFAULT 100,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX rep_slug_idx (slug),
    INDEX rep_color_idx (color),
    INDEX rep_author_type_idx (author_type),
    INDEX rep_author_user_idx (author_user_id),
    INDEX rep_published_idx (is_published),
    INDEX rep_featured_idx (is_featured)
  )`,

  // ── repertoire_lines ──
  `CREATE TABLE IF NOT EXISTS repertoire_lines (
    id varchar(36) NOT NULL PRIMARY KEY,
    repertoire_id varchar(36) NOT NULL,
    line_id varchar(36) NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    note text,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX rl_repertoire_id_idx (repertoire_id),
    INDEX rl_line_id_idx (line_id),
    INDEX rl_rep_sort_idx (repertoire_id, sort_order)
  )`,

  // ── model_games ──
  `CREATE TABLE IF NOT EXISTS model_games (
    id varchar(36) NOT NULL PRIMARY KEY,
    line_id varchar(36) NOT NULL,
    title varchar(300) NOT NULL,
    white_player varchar(100) NOT NULL,
    black_player varchar(100) NOT NULL,
    event varchar(200),
    year int,
    result varchar(10) NOT NULL,
    pgn text NOT NULL,
    final_fen text,
    total_moves int,
    commentary text,
    selection_reason text,
    sort_order int NOT NULL DEFAULT 0,
    is_published tinyint NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX mg_line_id_idx (line_id),
    INDEX mg_line_sort_idx (line_id, sort_order)
  )`,

  // ── user_line_reviews ──
  `CREATE TABLE IF NOT EXISTS user_line_reviews (
    id varchar(36) NOT NULL PRIMARY KEY,
    user_id varchar(36) NOT NULL,
    line_id varchar(36) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'new',
    interval_days int NOT NULL DEFAULT 0,
    ease_factor int NOT NULL DEFAULT 250,
    repetitions int NOT NULL DEFAULT 0,
    next_review_at timestamp NULL,
    last_reviewed_at timestamp NULL,
    total_attempts int NOT NULL DEFAULT 0,
    correct_attempts int NOT NULL DEFAULT 0,
    streak int NOT NULL DEFAULT 0,
    best_streak int NOT NULL DEFAULT 0,
    last_quality int,
    avg_review_seconds int,
    review_history text,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ulr_user_id_idx (user_id),
    INDEX ulr_line_id_idx (line_id),
    INDEX ulr_user_line_idx (user_id, line_id),
    INDEX ulr_user_status_idx (user_id, status),
    INDEX ulr_next_review_idx (user_id, next_review_at)
  )`,

  // ── opening_tags ──
  `CREATE TABLE IF NOT EXISTS opening_tags (
    id varchar(36) NOT NULL PRIMARY KEY,
    name varchar(100) NOT NULL,
    slug varchar(100) NOT NULL UNIQUE,
    category varchar(30) NOT NULL DEFAULT 'theme',
    description text,
    sort_order int NOT NULL DEFAULT 100,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ot_slug_idx (slug),
    INDEX ot_category_idx (category)
  )`,

  // ── opening_tag_map ──
  `CREATE TABLE IF NOT EXISTS opening_tag_map (
    id varchar(36) NOT NULL PRIMARY KEY,
    tag_id varchar(36) NOT NULL,
    opening_id varchar(36) NOT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX otm_tag_id_idx (tag_id),
    INDEX otm_opening_id_idx (opening_id),
    INDEX otm_tag_opening_idx (tag_id, opening_id)
  )`,

  // ── line_tag_map ──
  `CREATE TABLE IF NOT EXISTS line_tag_map (
    id varchar(36) NOT NULL PRIMARY KEY,
    tag_id varchar(36) NOT NULL,
    line_id varchar(36) NOT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ltm_tag_id_idx (tag_id),
    INDEX ltm_line_id_idx (line_id),
    INDEX ltm_tag_line_idx (tag_id, line_id)
  )`,
];

console.log("Creating openings database tables...\n");

for (const sql of tables) {
  const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
  const name = match ? match[1] : "unknown";
  try {
    await conn.execute(sql);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log("\nDone. Verifying tables exist...\n");

const [rows] = await conn.execute(
  "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('openings','opening_lines','line_nodes','repertoires','repertoire_lines','model_games','user_line_reviews','opening_tags','opening_tag_map','line_tag_map') ORDER BY TABLE_NAME"
);

for (const row of rows) {
  console.log(`  ✓ ${row.TABLE_NAME}`);
}

console.log(`\n${rows.length}/10 openings tables verified.`);

await conn.end();
