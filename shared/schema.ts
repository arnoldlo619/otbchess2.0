/**
 * OTB Chess — Database Schema (Drizzle ORM, MySQL / TiDB Cloud)
 *
 * Tables:
 *  - users: OTB Chess accounts (email/password auth, chess.com/lichess linking)
 *  - push_subscriptions: Persists Web Push subscriptions per tournament so
 *    the director can broadcast round-start notifications even after a server
 *    restart. Each row represents one browser subscription endpoint.
 *  - tournament_players: One row per (tournament, player) registration.
 *  - tournament_state: Full director state JSON blob per tournament.
 */

import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  index,
  int,
  float,
  tinyint,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── users ────────────────────────────────────────────────────────────────────
// One row per registered OTB Chess account.
// Passwords are stored as bcrypt hashes (never plaintext).
// Chess platform usernames are optional and used for ELO lookup.
export const users = mysqlTable(
  "users",
  {
    // Surrogate PK (nanoid)
    id: varchar("id", { length: 36 }).primaryKey(),

    // Login credential — must be unique
    email: varchar("email", { length: 255 }).notNull().unique(),

    // bcrypt hash of the user's password
    passwordHash: text("password_hash").notNull(),

    // How the user appears in the UI
    displayName: varchar("display_name", { length: 100 }).notNull(),

    // Optional chess platform usernames for ELO lookup
    chesscomUsername: varchar("chesscom_username", { length: 100 }),
    lichessUsername: varchar("lichess_username", { length: 100 }),

    // Cached ELO ratings (refreshed on profile save)
    chesscomElo: int("chesscom_elo"),
    chesscomRapid: int("chesscom_rapid"),
    chesscomBlitz: int("chesscom_blitz"),
    chesscomBullet: int("chesscom_bullet"),
    chesscomPrevRapid: int("chesscom_prev_rapid"),
    chesscomPrevBlitz: int("chesscom_prev_blitz"),
    chesscomPrevBullet: int("chesscom_prev_bullet"),
    lichessElo: int("lichess_elo"),

    // FIDE ID (optional, for linking to official FIDE profile)
    fideId: varchar("fide_id", { length: 20 }),

    // Avatar URL (chess.com avatar or custom upload)
    avatarUrl: text("avatar_url"),

    // Guest flag — true for ephemeral guest sessions (no email/password)
    isGuest: boolean("is_guest").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── push_subscriptions ───────────────────────────────────────────────────────
// Stores one row per (tournament, endpoint) pair.
// The endpoint URL is unique per browser subscription and acts as the natural
// primary key. We also index tournament_id for fast broadcast queries.
export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    // Surrogate PK — varchar(255) is safe for all MySQL/TiDB versions
    id: varchar("id", { length: 36 }).primaryKey(),

    // The tournament this subscription belongs to
    tournamentId: varchar("tournament_id", { length: 255 }).notNull(),

    // Web Push endpoint URL (unique per browser/device)
    endpoint: text("endpoint").notNull(),

    // ECDH public key for payload encryption (base64url)
    p256dh: text("p256dh").notNull(),

    // Authentication secret (base64url)
    auth: text("auth").notNull(),

    // When the subscription was created
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tournamentIdx: index("tournament_id_idx").on(table.tournamentId),
  })
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

// ─── tournament_players ───────────────────────────────────────────────────────
// Stores one row per (tournament, player) pair.
// player_json holds the full Player object serialised as JSON so we avoid
// schema churn when the Player type evolves.
// Unique constraint on (tournament_id, username) prevents duplicate registrations.
export const tournamentPlayers = mysqlTable(
  "tournament_players",
  {
    // Surrogate PK
    id: varchar("id", { length: 36 }).primaryKey(),

    // The tournament this player registered for
    tournamentId: varchar("tournament_id", { length: 255 }).notNull(),

    // chess.com username (lower-cased) — used as the dedup key
    username: varchar("username", { length: 100 }).notNull(),

    // Full Player object as JSON (name, elo, avatar, etc.)
    playerJson: text("player_json").notNull(),

    // When the player registered
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    tournamentIdx: index("tp_tournament_id_idx").on(table.tournamentId),
  })
);

export type TournamentPlayer = typeof tournamentPlayers.$inferSelect;
export type NewTournamentPlayer = typeof tournamentPlayers.$inferInsert;

// ─── tournament_state ─────────────────────────────────────────────────────────
// Stores the full director state for one tournament as a JSON blob.
// One row per tournament — tournament_id is the PK.
// This allows the director's dashboard to recover from a page refresh or
// device switch without losing pairings, results, or round progress.
export const tournamentState = mysqlTable("tournament_state", {
  // Tournament slug / ID (matches the key used in localStorage)
  tournamentId: varchar("tournament_id", { length: 255 }).primaryKey(),

  // Full DirectorState object serialised as JSON
  stateJson: text("state_json").notNull(),

  // Last time this row was written
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TournamentStateRow = typeof tournamentState.$inferSelect;
export type NewTournamentStateRow = typeof tournamentState.$inferInsert;

// ─── user_tournaments ─────────────────────────────────────────────────────────
// Links a registered user account to a tournament they created.
// Enables cross-device "My Tournaments" history on the profile page.
export const userTournaments = mysqlTable(
  "user_tournaments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tournamentId: varchar("tournament_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    venue: varchar("venue", { length: 255 }),
    date: varchar("date", { length: 20 }),
    format: varchar("format", { length: 50 }),
    rounds: int("rounds"),
    inviteCode: varchar("invite_code", { length: 20 }),
    // Tournament lifecycle status: registration | in_progress | completed | paused
    status: varchar("status", { length: 20 }).default("registration"),
    /** Optional host-chosen short URL slug, e.g. "ThursdayOTBNight" */
    customSlug: varchar("custom_slug", { length: 80 }),
    /** Whether this tournament has a public live dashboard accessible via QR code */
    isPublic: tinyint("is_public").notNull().default(0),
    /** Timestamp when the tournament transitioned to in_progress (used for 24h auto-expiry) */
    startedAt: timestamp("started_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("ut_user_id_idx").on(table.userId),
    tournamentIdx: index("ut_tournament_id_idx").on(table.tournamentId),
  })
);

export type UserTournament = typeof userTournaments.$inferSelect;
export type NewUserTournament = typeof userTournaments.$inferInsert;

// ─── recording_sessions ─────────────────────────────────────────────────────
// One row per OTB game recording attempt.
// Tracks the lifecycle from camera capture through engine analysis.
export const recordingSessions = mysqlTable(
  "recording_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tournamentId: varchar("tournament_id", { length: 255 }),
    // ready | recording | uploading | processing | needs_correction | analyzing | complete | failed
    status: varchar("status", { length: 30 }).notNull().default("ready"),
    videoKey: text("video_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("rs_user_id_idx").on(table.userId),
    statusIdx: index("rs_status_idx").on(table.status),
  })
);

export type RecordingSession = typeof recordingSessions.$inferSelect;
export type NewRecordingSession = typeof recordingSessions.$inferInsert;

// ─── processed_games ────────────────────────────────────────────────────────
// Stores the reconstructed game data from a recording session.
export const processedGames = mysqlTable(
  "processed_games",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    pgn: text("pgn").notNull(),
    // JSON array of { moveNumber, timestamp } for video sync
    moveTimestamps: text("move_timestamps"),
    // JSON array of { timestampMs, fen, confidence } from CV pipeline
    fenTimeline: text("fen_timeline"),
    openingName: varchar("opening_name", { length: 255 }),
    openingEco: varchar("opening_eco", { length: 10 }),
    totalMoves: int("total_moves").default(0),
    whitePlayer: varchar("white_player", { length: 100 }),
    blackPlayer: varchar("black_player", { length: 100 }),
    result: varchar("result", { length: 10 }),
    event: varchar("event", { length: 255 }),
    date: varchar("date", { length: 20 }),
    // Sharing & accuracy (populated after analysis completes)
    isPublic: tinyint("is_public").default(0).notNull(),
    shareToken: varchar("share_token", { length: 20 }),
    whiteAccuracy: float("white_accuracy"),
    blackAccuracy: float("black_accuracy"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("pg_session_id_idx").on(table.sessionId),
  })
);

export type ProcessedGame = typeof processedGames.$inferSelect;
export type NewProcessedGame = typeof processedGames.$inferInsert;

// ─── move_analyses ──────────────────────────────────────────────────────────
// Per-move engine analysis results from Stockfish.
export const moveAnalyses = mysqlTable(
  "move_analyses",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    gameId: varchar("game_id", { length: 36 }).notNull(),
    moveNumber: int("move_number").notNull(),
    color: varchar("color", { length: 5 }).notNull(), // 'w' or 'b'
    san: varchar("san", { length: 20 }).notNull(),
    fen: text("fen").notNull(),
    // Centipawn evaluation (positive = white advantage)
    eval: int("eval"),
    bestMove: varchar("best_move", { length: 20 }),
    // best | good | inaccuracy | mistake | blunder
    classification: varchar("classification", { length: 20 }),
    winChance: int("win_chance"),
    continuation: text("continuation"),
    // Video timestamp data (null for manual PGN games)
    timestampMs: int("timestamp_ms"),
    timestampConfidence: float("timestamp_confidence"),
    frameKey: text("frame_key"),
  },
  (table) => ({
    gameIdx: index("ma_game_id_idx").on(table.gameId),
  })
);

export type MoveAnalysis = typeof moveAnalyses.$inferSelect;
export type NewMoveAnalysis = typeof moveAnalyses.$inferInsert;

// ─── correction_entries ─────────────────────────────────────────────────────
// Tracks AI uncertainty points and user corrections during game reconstruction.
export const correctionEntries = mysqlTable(
  "correction_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    gameId: varchar("game_id", { length: 36 }).notNull(),
    moveNumber: int("move_number").notNull(),
    // JSON array of candidate SAN moves
    candidateMoves: text("candidate_moves"),
    chosenMove: varchar("chosen_move", { length: 20 }),
    confidence: int("confidence"),
    skipped: int("skipped").default(0),
  },
  (table) => ({
    gameIdx: index("ce_game_id_idx").on(table.gameId),
  })
);

export type CorrectionEntry = typeof correctionEntries.$inferSelect;
export type NewCorrectionEntry = typeof correctionEntries.$inferInsert;

// ─── video_chunks ────────────────────────────────────────────────────────────
// Tracks individual video chunks uploaded during a recording session.
// Each chunk is a 5-second WebM blob saved to the local filesystem.
// On finalize, chunks are concatenated by ffmpeg into a single video file.
export const videoChunks = mysqlTable(
  "video_chunks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    chunkIndex: int("chunk_index").notNull(),
    filePath: text("file_path").notNull(),
    sizeBytes: int("size_bytes").default(0),
    mimeType: varchar("mime_type", { length: 50 }).default("video/webm"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("vc_session_id_idx").on(table.sessionId),
    sessionChunkIdx: index("vc_session_chunk_idx").on(table.sessionId, table.chunkIndex),
  })
);

export type VideoChunk = typeof videoChunks.$inferSelect;
export type NewVideoChunk = typeof videoChunks.$inferInsert;

// ─── cv_jobs ──────────────────────────────────────────────────────────────────────────────
// One row per computer-vision processing job.
// A job is created when a video is finalized and consumed by the CV worker.
// Status lifecycle: pending → running → complete | failed
export const cvJobs = mysqlTable(
  "cv_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    // pending | running | complete | failed
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // Path to the concatenated video file
    videoPath: text("video_path").notNull(),
    // Number of frames sampled from the video
    framesProcessed: int("frames_processed").default(0),
    // Total frames in the video (estimated)
    totalFrames: int("total_frames").default(0),
    // Reconstructed PGN (populated on success)
    reconstructedPgn: text("reconstructed_pgn"),
    // JSON array of { moveNumber, timestampMs, confidence } objects
    moveTimeline: text("move_timeline"),
    // Error message if status is 'failed'
    errorMessage: text("error_message"),
    // Optional path to a JSON file containing the client-side FEN timeline seed
    fenTimelineFile: text("fen_timeline_file"),
    // Optional path to a JSON file containing manual board corners [[x,y],[x,y],[x,y],[x,y]]
    cornersFile: text("corners_file"),
    // Last stable FEN detected during processing (for live board preview in UI)
    lastFen: text("last_fen"),
    // Number of stable board positions detected so far
    stablePositions: int("stable_positions").default(0),
    // Number of retry attempts
    attempts: int("attempts").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    sessionIdx: index("cj_session_id_idx").on(table.sessionId),
    statusIdx: index("cj_status_idx").on(table.status),
  })
);

export type CvJob = typeof cvJobs.$inferSelect;
export type NewCvJob = typeof cvJobs.$inferInsert;

// ─── battle_rooms ─────────────────────────────────────────────────────────────
// One row per 1v1 battle room created by a host.
// Status lifecycle: waiting → active → completed
export const battleRooms = mysqlTable(
  "battle_rooms",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    // 6-character uppercase join code (e.g. "AB12CD")
    code: varchar("code", { length: 8 }).notNull().unique(),
    // Host user ID (must be a registered user)
    hostId: varchar("host_id", { length: 36 }).notNull(),
    // Guest user ID (null until opponent joins)
    guestId: varchar("guest_id", { length: 36 }),
    // waiting | active | completed | cancelled
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    // Game result: null | host_win | guest_win | draw
    result: varchar("result", { length: 20 }),
    // Optional time control string (e.g. "10+0", "5+3")
    timeControl: varchar("time_control", { length: 20 }),
    // PGN string recorded via Live Notation Mode (null if notation was not used)
    pgn: text("pgn"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    codeIdx: index("br_code_idx").on(table.code),
    hostIdx: index("br_host_id_idx").on(table.hostId),
    statusIdx: index("br_status_idx").on(table.status),
  })
);

export type BattleRoom = typeof battleRooms.$inferSelect;
export type NewBattleRoom = typeof battleRooms.$inferInsert;

// ─── club_conversations ───────────────────────────────────────────────────────
// One row per direct-message thread between two members of the same club.
// The pair (clubId, userAId, userBId) is unique (userAId < userBId by convention).
export const clubConversations = mysqlTable(
  "club_conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clubId: varchar("club_id", { length: 36 }).notNull(),
    userAId: varchar("user_a_id", { length: 36 }).notNull(),
    userBId: varchar("user_b_id", { length: 36 }).notNull(),
    // ISO timestamp of the last message (for sorting)
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    clubIdx: index("cc_club_id_idx").on(table.clubId),
    userAIdx: index("cc_user_a_idx").on(table.userAId),
    userBIdx: index("cc_user_b_idx").on(table.userBId),
  })
);

export type ClubConversation = typeof clubConversations.$inferSelect;
export type NewClubConversation = typeof clubConversations.$inferInsert;

// ─── club_messages ────────────────────────────────────────────────────────────
// One row per message in a club_conversations thread.
// type: 'text' | 'chess_invite' | 'chess_move'
export const clubMessages = mysqlTable(
  "club_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 36 }).notNull(),
    senderId: varchar("sender_id", { length: 36 }).notNull(),
    // 'text' | 'chess_invite' | 'chess_move'
    type: varchar("type", { length: 20 }).notNull().default("text"),
    body: text("body"),
    // For chess_invite / chess_move: reference to club_chess_games.id
    chessGameId: varchar("chess_game_id", { length: 36 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("cm_conversation_id_idx").on(table.conversationId),
    senderIdx: index("cm_sender_id_idx").on(table.senderId),
  })
);

export type ClubMessage = typeof clubMessages.$inferSelect;
export type NewClubMessage = typeof clubMessages.$inferInsert;

// ─── club_chess_games ─────────────────────────────────────────────────────────
// One row per turn-based chess game initiated via club DMs.
// pgn stores the full game PGN string (updated after each move).
export const clubChessGames = mysqlTable(
  "club_chess_games",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 36 }).notNull(),
    // The player who sent the invite (plays White)
    whiteId: varchar("white_id", { length: 36 }).notNull(),
    // The player who accepted (plays Black)
    blackId: varchar("black_id", { length: 36 }).notNull(),
    // 'pending' | 'active' | 'completed' | 'declined'
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // Full PGN string (updated on each move)
    pgn: text("pgn").default(""),
    // FEN of current position
    currentFen: text("current_fen").default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    // 'white' | 'black' — whose turn it is
    turn: varchar("turn", { length: 10 }).notNull().default("white"),
    // 'white_wins' | 'black_wins' | 'draw' | null
    result: varchar("result", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("ccg_conversation_id_idx").on(table.conversationId),
    whiteIdx: index("ccg_white_id_idx").on(table.whiteId),
    blackIdx: index("ccg_black_id_idx").on(table.blackId),
  })
);

export type ClubChessGame = typeof clubChessGames.$inferSelect;
export type NewClubChessGame = typeof clubChessGames.$inferInsert;

// ─── club_invites ─────────────────────────────────────────────────────────────
// One row per pending or accepted email invite to a club.
export const clubInvites = mysqlTable(
  "club_invites",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clubId: varchar("club_id", { length: 36 }).notNull(),
    // Email address the invite was sent to
    email: varchar("email", { length: 255 }).notNull(),
    // Unique token embedded in the invite link
    token: varchar("token", { length: 64 }).notNull().unique(),
    // User ID of the director who sent the invite
    invitedBy: varchar("invited_by", { length: 36 }).notNull(),
    // 'pending' | 'accepted' | 'revoked'
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => ({
    clubIdx: index("ci_club_id_idx").on(table.clubId),
    tokenIdx: index("ci_token_idx").on(table.token),
    emailIdx: index("ci_email_idx").on(table.email),
  })
);
export type ClubInvite = typeof clubInvites.$inferSelect;
export type NewClubInvite = typeof clubInvites.$inferInsert;

// ─── rating_history ───────────────────────────────────────────────────────────
// Stores up to 10 time-series rating snapshots per user per format.
// Appended each time a chess.com sync detects a changed rating.
// Used to render sparkline charts in the AvatarNavDropdown.
export const ratingHistory = mysqlTable(
  "rating_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    // 'rapid' | 'blitz' | 'bullet'
    format: varchar("format", { length: 10 }).notNull(),
    rating: int("rating").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => ({
    userFormatIdx: index("rh_user_format_idx").on(table.userId, table.format),
  })
);

export type RatingHistory = typeof ratingHistory.$inferSelect;
export type NewRatingHistory = typeof ratingHistory.$inferInsert;

// ─── club_battles ─────────────────────────────────────────────────────────────
// One row per 1v1 OTB battle between two club members.
// Mirrors the ClubBattle interface from clubBattleRegistry.ts but persisted
// server-side so stats are cross-device and all-time.
//
// result: 'player_a' | 'player_b' | 'draw' | null (null = in-progress)
// status: 'pending' | 'active' | 'completed'
//
// playerAId / playerBId are the OTB user IDs (users.id).
// playerAName / playerBName are denormalised display names for fast reads.
export const clubBattles = mysqlTable(
  "club_battles",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    clubId: varchar("club_id", { length: 36 }).notNull(),
    playerAId: varchar("player_a_id", { length: 64 }).notNull(),
    playerAName: varchar("player_a_name", { length: 100 }).notNull(),
    playerBId: varchar("player_b_id", { length: 64 }).notNull(),
    playerBName: varchar("player_b_name", { length: 100 }).notNull(),
    // 'pending' | 'active' | 'completed'
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // 'player_a' | 'player_b' | 'draw' — null until completed
    result: varchar("result", { length: 20 }),
    // Optional director notes
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    clubIdx: index("cb_club_id_idx").on(table.clubId),
    playerAIdx: index("cb_player_a_idx").on(table.playerAId),
    playerBIdx: index("cb_player_b_idx").on(table.playerBId),
    clubStatusIdx: index("cb_club_status_idx").on(table.clubId, table.status),
  })
);
export type ClubBattleRow = typeof clubBattles.$inferSelect;
export type NewClubBattleRow = typeof clubBattles.$inferInsert;

// ── Clubs ─────────────────────────────────────────────────────────────────────
// Mirrors the Club interface in client/src/lib/clubRegistry.ts.
// Clubs default to isPublic=1 so they appear in Discover immediately.
export const dbClubs = mysqlTable(
  "clubs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    tagline: varchar("tagline", { length: 200 }).notNull().default(""),
    description: text("description").notNull().default(""),
    location: varchar("location", { length: 100 }).notNull().default(""),
    country: varchar("country", { length: 4 }).notNull().default(""),
    category: varchar("category", { length: 30 }).notNull().default("club"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    accentColor: varchar("accent_color", { length: 20 }).notNull().default("#4CAF50"),
    ownerId: varchar("owner_id", { length: 64 }).notNull(),
    ownerName: varchar("owner_name", { length: 100 }).notNull().default(""),
    memberCount: int("member_count").notNull().default(1),
    tournamentCount: int("tournament_count").notNull().default(0),
    followerCount: int("follower_count").notNull().default(0),
    isPublic: tinyint("is_public").notNull().default(1),
    website: varchar("website", { length: 300 }),
    twitter: varchar("twitter", { length: 100 }),
    discord: varchar("discord", { length: 300 }),
    announcement: text("announcement"),
    foundedAt: timestamp("founded_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("clubs_slug_idx").on(table.slug),
    ownerIdx: index("clubs_owner_idx").on(table.ownerId),
    publicIdx: index("clubs_public_idx").on(table.isPublic),
  })
);
export type DbClubRow = typeof dbClubs.$inferSelect;
export type NewDbClubRow = typeof dbClubs.$inferInsert;

// ── Club Members (DB) ─────────────────────────────────────────────────────────
export const dbClubMembers = mysqlTable(
  "club_members",
  {
    id: int("id").primaryKey().autoincrement(),
    clubId: varchar("club_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull().default(""),
    chesscomUsername: varchar("chesscom_username", { length: 50 }),
    lichessUsername: varchar("lichess_username", { length: 50 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    tournamentsPlayed: int("tournaments_played").notNull().default(0),
    bestFinish: int("best_finish"),
    lastSeenAt: timestamp("last_seen_at"),
    leagueChampionships: int("league_championships").notNull().default(0),
  },
  (table) => ({
    clubIdx: index("cm_club_idx").on(table.clubId),
    userIdx: index("cm_user_idx").on(table.userId),
    uniqueMember: index("cm_club_user_idx").on(table.clubId, table.userId),
  })
);
export type DbClubMemberRow = typeof dbClubMembers.$inferSelect;
export type NewDbClubMemberRow = typeof dbClubMembers.$inferInsert;

// Fantasy Chess League Tables
export const leagues = mysqlTable('leagues', {
  id: varchar('id', { length: 64 }).primaryKey(),
  clubId: varchar('club_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  commissionerId: varchar('commissioner_id', { length: 64 }).notNull(),
  commissionerName: varchar('commissioner_name', { length: 100 }).notNull().default(''),
  formatType: varchar('format_type', { length: 30 }).notNull().default('round_robin'),
  maxPlayers: int('max_players').notNull(),
  currentWeek: int('current_week').notNull().default(1),
  totalWeeks: int('total_weeks').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({ clubIdx: index('lg_club_idx').on(t.clubId), commIdx: index('lg_comm_idx').on(t.commissionerId) }));
export type LeagueRow = typeof leagues.$inferSelect;
export type NewLeagueRow = typeof leagues.$inferInsert;

export const leaguePlayers = mysqlTable('league_players', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  playerId: varchar('player_id', { length: 64 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull().default(''),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  chesscomUsername: varchar('chesscom_username', { length: 50 }),
  rating: int('rating'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => ({ leagueIdx: index('lp_league_idx').on(t.leagueId), uniquePlayer: index('lp_lp_idx').on(t.leagueId, t.playerId) }));
export type LeaguePlayerRow = typeof leaguePlayers.$inferSelect;
export type NewLeaguePlayerRow = typeof leaguePlayers.$inferInsert;

export const leagueWeeks = mysqlTable('league_weeks', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  weekNumber: int('week_number').notNull(),
  publishedAt: timestamp('published_at'),
  isComplete: tinyint('is_complete').notNull().default(0),
  deadline: timestamp('deadline'),
}, (t) => ({ leagueIdx: index('lw_league_idx').on(t.leagueId) }));
export type LeagueWeekRow = typeof leagueWeeks.$inferSelect;
export type NewLeagueWeekRow = typeof leagueWeeks.$inferInsert;

export const leagueMatches = mysqlTable('league_matches', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  weekId: int('week_id').notNull(),
  weekNumber: int('week_number').notNull(),
  playerWhiteId: varchar('player_white_id', { length: 64 }).notNull(),
  playerWhiteName: varchar('player_white_name', { length: 100 }).notNull().default(''),
  playerBlackId: varchar('player_black_id', { length: 64 }).notNull(),
  playerBlackName: varchar('player_black_name', { length: 100 }).notNull().default(''),
  resultStatus: varchar('result_status', { length: 20 }).notNull().default('pending'),
  result: varchar('result', { length: 20 }),
  reportedByUserId: varchar('reported_by_user_id', { length: 64 }),
  // Dual-confirmation fields
  whiteReport: varchar('white_report', { length: 20 }),
  blackReport: varchar('black_report', { length: 20 }),
  whiteReportedAt: timestamp('white_reported_at'),
  blackReportedAt: timestamp('black_reported_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ leagueIdx: index('lm_league_idx').on(t.leagueId), weekIdx: index('lm_week_idx').on(t.weekId) }));
export type LeagueMatchRow = typeof leagueMatches.$inferSelect;
export type NewLeagueMatchRow = typeof leagueMatches.$inferInsert;

export const leagueStandings = mysqlTable('league_standings', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  playerId: varchar('player_id', { length: 64 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull().default(''),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  wins: int('wins').notNull().default(0),
  losses: int('losses').notNull().default(0),
  draws: int('draws').notNull().default(0),
  points: float('points').notNull().default(0),
  rank: int('rank').notNull().default(0),
  streak: varchar('streak', { length: 20 }).notNull().default(''),
  movement: varchar('movement', { length: 10 }).notNull().default('same'),
  lastResults: varchar('last_results', { length: 100 }).notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (t) => ({ leagueIdx: index('ls_league_idx').on(t.leagueId), uniqueStanding: index('ls_lp_idx').on(t.leagueId, t.playerId) }));
export type LeagueStandingRow = typeof leagueStandings.$inferSelect;
export type NewLeagueStandingRow = typeof leagueStandings.$inferInsert;

// ─── league_join_requests ──────────────────────────────────────────────────────
// Tracks player requests to join a Draft league. Commissioner can approve/reject.
export const leagueJoinRequests = mysqlTable('league_join_requests', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  playerId: varchar('player_id', { length: 64 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull().default(''),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  chesscomUsername: varchar('chesscom_username', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedByUserId: varchar('reviewed_by_user_id', { length: 64 }),
}, (t) => ({
  leagueIdx: index('ljr_league_idx').on(t.leagueId),
  uniqueReq: index('ljr_lp_idx').on(t.leagueId, t.playerId),
}));
export type LeagueJoinRequestRow = typeof leagueJoinRequests.$inferSelect;
export type NewLeagueJoinRequestRow = typeof leagueJoinRequests.$inferInsert;

// ─── league_push_subscriptions ───────────────────────────────────────────────────────────────
// Stores Web Push subscriptions for league commissioners so they receive
// real-time notifications when a player requests to join their Draft league.
export const leaguePushSubscriptions = mysqlTable('league_push_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  leagueIdx: index('lps_league_idx').on(t.leagueId),
  userIdx: index('lps_user_idx').on(t.userId),
}));
export type LeaguePushSubscriptionRow = typeof leaguePushSubscriptions.$inferSelect;
export type NewLeaguePushSubscriptionRow = typeof leaguePushSubscriptions.$inferInsert;

// ─── league_invites ────────────────────────────────────────────────────────────
// Commissioner-initiated invites: commissioner picks a club member and sends them
// an invite. The invited player can accept or decline from their League Dashboard.
export const leagueInvites = mysqlTable('league_invites', {
  id: int('id').primaryKey().autoincrement(),
  leagueId: varchar('league_id', { length: 64 }).notNull(),
  invitedUserId: varchar('invited_user_id', { length: 64 }).notNull(),
  invitedDisplayName: varchar('invited_display_name', { length: 100 }).notNull().default(''),
  invitedAvatarUrl: varchar('invited_avatar_url', { length: 500 }),
  invitedChesscomUsername: varchar('invited_chesscom_username', { length: 50 }),
  commissionerId: varchar('commissioner_id', { length: 64 }).notNull(),
  commissionerName: varchar('commissioner_name', { length: 100 }).notNull().default(''),
  // status: pending | accepted | declined | cancelled
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  message: varchar('message', { length: 300 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
}, (t) => ({
  leagueIdx: index('linv_league_idx').on(t.leagueId),
  userIdx: index('linv_user_idx').on(t.invitedUserId),
  uniqueInvite: index('linv_lu_idx').on(t.leagueId, t.invitedUserId),
}));
export type LeagueInviteRow = typeof leagueInvites.$inferSelect;
export type NewLeagueInviteRow = typeof leagueInvites.$inferInsert;

// ─── prep_cache ──────────────────────────────────────────────────────────────
// Caches full matchup prep reports per chess.com username.
// TTL: 24 hours — stale entries are refreshed on next request.
export const prepCache = mysqlTable('prep_cache', {
  id: int('id').primaryKey().autoincrement(),
  /** chess.com username (lower-cased) — unique lookup key */
  username: varchar('username', { length: 100 }).notNull().unique(),
  /** Full PrepReport JSON blob */
  reportJson: text('report_json').notNull(),
  /** Number of games analysed (for quick display without parsing JSON) */
  gamesAnalyzed: int('games_analyzed').notNull().default(0),
  /** When this cache entry was created / last refreshed */
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
}, (t) => ({
  usernameIdx: index('pc_username_idx').on(t.username),
  cachedAtIdx: index('pc_cached_at_idx').on(t.cachedAt),
}));
export type PrepCacheRow = typeof prepCache.$inferSelect;
export type NewPrepCacheRow = typeof prepCache.$inferInsert;

// ─── director_smtp_config ─────────────────────────────────────────────────────
// Stores per-user SMTP configuration for sending tournament results emails
// directly from the platform. Password is AES-256 encrypted server-side.
export const directorSmtpConfig = mysqlTable("director_smtp_config", {
  id: int("id").primaryKey().autoincrement(),
  /** Owner user ID — one config per user */
  userId: varchar("user_id", { length: 36 }).notNull().unique(),
  /** SMTP host, e.g. smtp.gmail.com */
  host: varchar("host", { length: 255 }).notNull(),
  /** SMTP port, e.g. 587 (STARTTLS) or 465 (SSL) */
  port: int("port").notNull().default(587),
  /** Whether to use TLS/SSL */
  secure: boolean("secure").notNull().default(false),
  /** SMTP username / login */
  smtpUser: varchar("smtp_user", { length: 255 }).notNull(),
  /** AES-256-CBC encrypted SMTP password (hex-encoded IV:ciphertext) */
  smtpPassEncrypted: text("smtp_pass_encrypted").notNull(),
  /** Display name shown in From field, e.g. "Brooklyn Chess Club" */
  fromName: varchar("from_name", { length: 100 }).notNull().default("ChessOTB Director"),
  /** From email address, e.g. director@mychessclub.com */
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DirectorSmtpConfig = typeof directorSmtpConfig.$inferSelect;
export type NewDirectorSmtpConfig = typeof directorSmtpConfig.$inferInsert;


// ─── tournament_analytics ────────────────────────────────────────────────────
// Lightweight event tracking for tournament organizer analytics.
// Each row represents one trackable event (page view, search, follow, etc.)
// Aggregated at query time for the analytics dashboard.
export const tournamentAnalytics = mysqlTable(
  "tournament_analytics",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    // The tournament this event belongs to
    tournamentId: varchar("tournament_id", { length: 255 }).notNull(),
    // Event type: page_view | search | follow | email_capture | account_create | club_join | card_claim
    eventType: varchar("event_type", { length: 30 }).notNull(),
    // Optional JSON metadata (e.g., search query, player name)
    metadata: text("metadata"),
    // When the event occurred
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tournamentIdx: index("ta_tournament_id_idx").on(table.tournamentId),
    eventTypeIdx: index("ta_event_type_idx").on(table.eventType),
    tournamentEventIdx: index("ta_tid_event_idx").on(
      table.tournamentId,
      table.eventType
    ),
  })
);

export type TournamentAnalyticsRow = typeof tournamentAnalytics.$inferSelect;
export type NewTournamentAnalyticsRow = typeof tournamentAnalytics.$inferInsert;

// ─── saved_prep_reports ───────────────────────────────────────────────────────
// Stores prep reports saved by logged-in users for quick re-access.
// The full report JSON is stored so it can be displayed instantly without
// re-fetching from the chess.com API.
export const savedPrepReports = mysqlTable(
  "saved_prep_reports",
  {
    id: int("id").primaryKey().autoincrement(),
    /** The user who saved this report */
    userId: varchar("user_id", { length: 36 }).notNull(),
    /** The opponent's chess.com username */
    opponentUsername: varchar("opponent_username", { length: 100 }).notNull(),
    /** The opponent's display name (from the report) */
    opponentName: varchar("opponent_name", { length: 100 }),
    /** Snapshot of key stats for display in the saved list */
    winRate: int("win_rate"),
    gamesAnalyzed: int("games_analyzed"),
    prepLinesCount: int("prep_lines_count"),
    /** Full report JSON for instant re-display */
    reportJson: text("report_json").notNull(),
    savedAt: timestamp("saved_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("spr_user_id_idx").on(table.userId),
    userOpponentIdx: index("spr_user_opponent_idx").on(
      table.userId,
      table.opponentUsername
    ),
  })
);
export type SavedPrepReport = typeof savedPrepReports.$inferSelect;
export type NewSavedPrepReport = typeof savedPrepReports.$inferInsert;

// ─── club_events ──────────────────────────────────────────────────────────────
// Server-side store for club events created by directors/owners.
export const clubEvents = mysqlTable(
  "club_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    clubId: varchar("club_id", { length: 64 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at"),
    venue: varchar("venue", { length: 200 }),
    address: varchar("address", { length: 300 }),
    admissionNote: varchar("admission_note", { length: 200 }),
    coverImageUrl: text("cover_image_url"),
    accentColor: varchar("accent_color", { length: 20 }).notNull().default("#4CAF50"),
    creatorId: varchar("creator_id", { length: 64 }).notNull(),
    creatorName: varchar("creator_name", { length: 100 }).notNull().default(""),
    isPublished: tinyint("is_published").notNull().default(1),
    eventType: varchar("event_type", { length: 30 }).notNull().default("standard"),
    tournamentId: varchar("tournament_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    ceClubIdx: index("ce_club_idx").on(table.clubId),
    ceStartIdx: index("ce_start_idx").on(table.startAt),
    ceClubStartIdx: index("ce_club_start_idx").on(table.clubId, table.startAt),
  })
);
export type ClubEventRow = typeof clubEvents.$inferSelect;
export type NewClubEventRow = typeof clubEvents.$inferInsert;

// ─── club_feed ────────────────────────────────────────────────────────────────
// Server-side store for club feed posts (announcements, polls, tournament cards).
export const clubFeed = mysqlTable(
  "club_feed",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    clubId: varchar("club_id", { length: 64 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    actorName: varchar("actor_name", { length: 100 }).notNull().default(""),
    actorAvatarUrl: text("actor_avatar_url"),
    detail: text("detail"),
    linkHref: varchar("link_href", { length: 500 }),
    linkLabel: varchar("link_label", { length: 100 }),
    isPinned: tinyint("is_pinned").notNull().default(0),
    payload: text("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    cfClubIdx: index("cf_club_idx").on(table.clubId),
    cfClubCreatedIdx: index("cf_club_created_idx").on(table.clubId, table.createdAt),
    cfPinnedIdx: index("cf_pinned_idx").on(table.clubId, table.isPinned),
  })
);
export type ClubFeedRow = typeof clubFeed.$inferSelect;
export type NewClubFeedRow = typeof clubFeed.$inferInsert;

// ─── club_event_rsvps ─────────────────────────────────────────────────────────
// Server-side store for club event RSVPs (going / maybe / not_going).
// One row per (event_id, user_id) pair — upserted on change.
export const clubEventRsvps = mysqlTable(
  "club_event_rsvps",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    eventId: varchar("event_id", { length: 64 }).notNull(),
    clubId: varchar("club_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull().default(""),
    avatarUrl: text("avatar_url"),
    status: varchar("status", { length: 20 }).notNull().default("going"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    cerEventIdx: index("idx_cer_event").on(table.eventId),
    cerClubIdx: index("idx_cer_club").on(table.clubId),
    cerUserIdx: index("idx_cer_user").on(table.userId),
  })
);
export type ClubEventRsvpRow = typeof clubEventRsvps.$inferSelect;
export type NewClubEventRsvpRow = typeof clubEventRsvps.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// OPENINGS DATABASE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture overview:
//
//   openings          Top-level opening families (e.g. "Sicilian Defense")
//     └─ opening_lines   Specific variations within an opening (e.g. "Najdorf: 6.Bg5")
//          └─ line_nodes  Node-based move tree with branching & transpositions
//
//   repertoires        Curated or user-created repertoire collections
//     └─ repertoire_lines  Junction: which lines belong to which repertoire
//
//   model_games        Annotated reference games linked to specific lines
//   user_line_reviews  Per-user spaced repetition state & progress tracking
//   opening_tags       Flexible tag system with junction tables
//
// Design principles:
//   - varchar(36) nanoid PKs (matches existing project convention)
//   - No FK constraints (TiDB Cloud compatibility)
//   - FEN stored at every node for instant board rendering
//   - SAN + UCI + PGN stored for maximum client flexibility
//   - Separate "opening" (family) from "line" (specific variation)
//   - Node tree supports branching, transpositions, and alternative moves
//   - user_line_reviews is spaced-repetition-ready (SM-2 compatible fields)
//   - All tables are index-heavy for fast browsing and filtering
// ═══════════════════════════════════════════════════════════════════════════════

// ─── openings ────────────────────────────────────────────────────────────────
// Top-level opening families. Each row represents a named opening system
// (e.g. "Sicilian Defense", "Queen's Gambit Declined") — NOT individual lines.
// Think of this as the "folder" that groups related lines together.
//
// Why it exists:
//   - Provides a browsable catalog of openings for the explore UI
//   - Groups lines into logical families for filtering and search
//   - Stores opening-level metadata (description, history, key ideas)
//   - Enables "opening pages" similar to chess.com's opening explorer
export const openings = mysqlTable(
  "openings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** Canonical name, e.g. "Sicilian Defense" */
    name: varchar("name", { length: 200 }).notNull(),

    /** URL-safe slug, e.g. "sicilian-defense" */
    slug: varchar("slug", { length: 200 }).notNull().unique(),

    /** ECO code prefix, e.g. "B20" (may span a range like "B20-B99") */
    eco: varchar("eco", { length: 20 }).notNull(),

    /** Which color this opening is primarily for */
    color: varchar("color", { length: 10 }).notNull(), // 'white' | 'black' | 'both'

    /** The defining first moves in SAN, e.g. "1.e4 c5" */
    startingMoves: varchar("starting_moves", { length: 200 }).notNull(),

    /** FEN after the starting moves */
    startingFen: text("starting_fen").notNull(),

    /** Rich description (Markdown-safe) — history, key ideas, when to play it */
    description: text("description"),

    /** One-line summary for cards/lists, e.g. "Sharp, tactical, asymmetric" */
    summary: varchar("summary", { length: 300 }),

    /** Difficulty for study: beginner | intermediate | advanced | expert */
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("intermediate"),

    /** Popularity / commonness at club level (0–100) */
    popularity: int("popularity").notNull().default(50),

    /** Positional character: tactical | positional | universal */
    playCharacter: varchar("play_character", { length: 30 }).notNull().default("universal"),

    /** Key strategic themes as JSON array, e.g. ["pawn-center","kingside-attack"] */
    themes: text("themes"),

    /** Number of lines in this opening (denormalized for fast display) */
    lineCount: int("line_count").notNull().default(0),

    /** Sort order for curated browsing (lower = shown first) */
    sortOrder: int("sort_order").notNull().default(100),

    /** Whether this opening is published and visible to users */
    isPublished: tinyint("is_published").notNull().default(0),

    /** Content author or source attribution */
    authorName: varchar("author_name", { length: 100 }),

    /** Cover image URL for the opening card */
    coverImageUrl: text("cover_image_url"),

    /** Whether this opening is featured / promoted in the catalog */
    isFeatured: tinyint("is_featured").notNull().default(0),

    /** Whether this opening is suitable for beginners / first-time learners */
    starterFriendly: tinyint("starter_friendly").notNull().default(0),

    /** Estimated number of lines in this opening (for display before lines are loaded) */
    estimatedLineCount: int("estimated_line_count").notNull().default(0),

    /** Trap potential score (0–100) — how many traps / punishing lines exist */
    trapPotential: int("trap_potential").notNull().default(50),

    /** Strategic complexity score (0–100) — how deep the positional ideas run */
    strategicComplexity: int("strategic_complexity").notNull().default(50),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("op_slug_idx").on(table.slug),
    ecoIdx: index("op_eco_idx").on(table.eco),
    colorIdx: index("op_color_idx").on(table.color),
    publishedIdx: index("op_published_idx").on(table.isPublished),
    sortIdx: index("op_sort_idx").on(table.sortOrder),
    featuredIdx: index("op_featured_idx").on(table.isFeatured),
  })
);
export type OpeningRow = typeof openings.$inferSelect;
export type NewOpeningRow = typeof openings.$inferInsert;

// ─── opening_lines ───────────────────────────────────────────────────────────
// A specific variation within an opening. Each line has a defined move sequence,
// metadata for study prioritization, and links to its parent opening.
//
// Why it exists:
//   - The core study unit — users learn and review individual lines
//   - Rich metadata enables smart filtering: must-know, traps, difficulty
//   - Priority + commonness scores drive study queue ordering
//   - Strategic summary + hint + punishment support guided practice
//   - Links to parent opening for hierarchical navigation
export const openingLines = mysqlTable(
  "opening_lines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to openings.id — which opening family this line belongs to */
    openingId: varchar("opening_id", { length: 36 }).notNull(),

    /** Human-readable title, e.g. "Najdorf: 6.Bg5 Main Line" */
    title: varchar("title", { length: 300 }).notNull(),

    /** URL-safe slug, e.g. "najdorf-6bg5-main-line" */
    slug: varchar("slug", { length: 300 }).notNull(),

    /** ECO code for this specific line, e.g. "B96" */
    eco: varchar("eco", { length: 10 }).notNull(),

    /** Full PGN of the main line (no variations — those live in line_nodes) */
    pgn: text("pgn").notNull(),

    /** Final FEN position after the main line moves */
    finalFen: text("final_fen").notNull(),

    /** Total half-moves (plies) in the main line */
    plyCount: int("ply_count").notNull().default(0),

    /** Rich description (Markdown-safe) — when to play, key ideas */
    description: text("description"),

    /** beginner | intermediate | advanced | expert */
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("intermediate"),

    /** How commonly this line appears in practice (0–100) */
    commonness: int("commonness").notNull().default(50),

    /** Study priority score (0–100, higher = study first) */
    priority: int("priority").notNull().default(50),

    /** Whether this is a must-know line for the opening */
    isMustKnow: tinyint("is_must_know").notNull().default(0),

    /** Whether this line contains a tactical trap */
    isTrap: tinyint("is_trap").notNull().default(0),

    /** Line classification: main | sideline | gambit | surprise | trap */
    lineType: varchar("line_type", { length: 20 }).notNull().default("main"),

    /** Which color this line is primarily for */
    color: varchar("color", { length: 10 }).notNull(), // 'white' | 'black'

    /** Strategic summary — 1-2 sentences on the resulting position */
    strategicSummary: text("strategic_summary"),

    /** Hint text shown during practice before revealing the move */
    hintText: text("hint_text"),

    /** What happens if the opponent deviates — the "punishment idea" */
    punishmentIdea: text("punishment_idea"),

    /** Pawn structure label, e.g. "Maroczy Bind", "Isolated Queen's Pawn" */
    pawnStructure: varchar("pawn_structure", { length: 100 }),

    /** Key themes as JSON array, e.g. ["kingside-attack","piece-activity"] */
    themes: text("themes"),

    /** Sort order within the parent opening */
    sortOrder: int("sort_order").notNull().default(100),

    /** Whether this line is published and visible */
    isPublished: tinyint("is_published").notNull().default(0),

    /** Content author or source attribution */
    authorName: varchar("author_name", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    openingIdx: index("ol_opening_id_idx").on(table.openingId),
    slugIdx: index("ol_slug_idx").on(table.slug),
    ecoIdx: index("ol_eco_idx").on(table.eco),
    colorIdx: index("ol_color_idx").on(table.color),
    priorityIdx: index("ol_priority_idx").on(table.priority),
    mustKnowIdx: index("ol_must_know_idx").on(table.isMustKnow),
    trapIdx: index("ol_trap_idx").on(table.isTrap),
    publishedIdx: index("ol_published_idx").on(table.isPublished),
    openingSortIdx: index("ol_opening_sort_idx").on(table.openingId, table.sortOrder),
  })
);
export type OpeningLineRow = typeof openingLines.$inferSelect;
export type NewOpeningLineRow = typeof openingLines.$inferInsert;

// ─── line_nodes ──────────────────────────────────────────────────────────────
// Node-based move tree. Each node represents a single half-move (ply) in a
// line's move tree. Nodes form a directed acyclic graph (DAG) via parentNodeId,
// enabling branching variations and transposition links.
//
// Why it exists:
//   - Supports branching: one parent node can have multiple child moves
//   - Supports transpositions: a node can link to another node via transpositionNodeId
//   - Stores FEN at every node for instant board rendering at any point
//   - Stores SAN + UCI for both human display and engine communication
//   - Annotation per node enables move-by-move commentary
//   - isMainLine flag distinguishes the primary continuation from alternatives
export const lineNodes = mysqlTable(
  "line_nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to opening_lines.id — which line this node belongs to */
    lineId: varchar("line_id", { length: 36 }).notNull(),

    /** FK to line_nodes.id — parent node (null for the root/starting position) */
    parentNodeId: varchar("parent_node_id", { length: 36 }),

    /** Half-move index (0 = starting position, 1 = first move, etc.) */
    ply: int("ply").notNull(),

    /** Move in Standard Algebraic Notation, e.g. "Nf3" (null for root node) */
    moveSan: varchar("move_san", { length: 20 }),

    /** Move in UCI format, e.g. "g1f3" (null for root node) */
    moveUci: varchar("move_uci", { length: 10 }),

    /** FEN position AFTER this move is played */
    fen: text("fen").notNull(),

    /** Whether this node is on the main line (vs. a sideline/alternative) */
    isMainLine: tinyint("is_main_line").notNull().default(1),

    /** Move-level annotation (Markdown-safe) — explains why this move */
    annotation: text("annotation"),

    /** NAG (Numeric Annotation Glyph): 1=!, 2=?, 3=!!, 4=??, 5=!?, 6=?! */
    nag: int("nag"),

    /** Engine evaluation in centipawns (positive = white advantage) */
    eval: int("eval"),

    /** FK to line_nodes.id — if this position transposes to another known node */
    transpositionNodeId: varchar("transposition_node_id", { length: 36 }),

    /** Sort order among siblings (children of the same parent) */
    sortOrder: int("sort_order").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    lineIdx: index("ln_line_id_idx").on(table.lineId),
    parentIdx: index("ln_parent_node_idx").on(table.parentNodeId),
    linePlyIdx: index("ln_line_ply_idx").on(table.lineId, table.ply),
    transpositionIdx: index("ln_transposition_idx").on(table.transpositionNodeId),
  })
);
export type LineNodeRow = typeof lineNodes.$inferSelect;
export type NewLineNodeRow = typeof lineNodes.$inferInsert;

// ─── repertoires ─────────────────────────────────────────────────────────────
// A curated collection of opening lines, either staff-authored ("Official
// Sicilian Repertoire for Black") or user-created ("My 1.e4 Repertoire").
//
// Why it exists:
//   - Groups lines into a coherent study plan with a defined order
//   - Supports both platform-curated and user-created repertoires
//   - Enables "study this repertoire" flow with progress tracking
//   - Future: community-shared repertoires, coach-assigned repertoires
export const repertoires = mysqlTable(
  "repertoires",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** Human-readable title, e.g. "Complete Sicilian Najdorf for Black" */
    title: varchar("title", { length: 300 }).notNull(),

    /** URL-safe slug */
    slug: varchar("slug", { length: 300 }).notNull(),

    /** Rich description (Markdown-safe) */
    description: text("description"),

    /** Which color this repertoire covers */
    color: varchar("color", { length: 10 }).notNull(), // 'white' | 'black' | 'both'

    /** Target audience: beginner | intermediate | advanced | expert */
    targetLevel: varchar("target_level", { length: 20 }).notNull().default("intermediate"),

    /** Who created it: staff | community | user */
    authorType: varchar("author_type", { length: 20 }).notNull().default("staff"),

    /** Author display name */
    authorName: varchar("author_name", { length: 100 }),

    /** FK to users.id — null for staff-authored repertoires */
    authorUserId: varchar("author_user_id", { length: 36 }),

    /** Whether this repertoire is published and visible */
    isPublished: tinyint("is_published").notNull().default(0),

    /** Whether this is a featured/promoted repertoire */
    isFeatured: tinyint("is_featured").notNull().default(0),

    /** Number of lines in this repertoire (denormalized) */
    lineCount: int("line_count").notNull().default(0),

    /** Estimated study time in minutes */
    estimatedMinutes: int("estimated_minutes"),

    /** Cover image URL */
    coverImageUrl: text("cover_image_url"),

    /** Sort order for curated browsing */
    sortOrder: int("sort_order").notNull().default(100),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("rep_slug_idx").on(table.slug),
    colorIdx: index("rep_color_idx").on(table.color),
    authorTypeIdx: index("rep_author_type_idx").on(table.authorType),
    authorUserIdx: index("rep_author_user_idx").on(table.authorUserId),
    publishedIdx: index("rep_published_idx").on(table.isPublished),
    featuredIdx: index("rep_featured_idx").on(table.isFeatured),
  })
);
export type RepertoireRow = typeof repertoires.$inferSelect;
export type NewRepertoireRow = typeof repertoires.$inferInsert;

// ─── repertoire_lines ────────────────────────────────────────────────────────
// Junction table linking repertoires to opening_lines with ordering.
//
// Why it exists:
//   - Many-to-many: one line can appear in multiple repertoires
//   - sortOrder controls the study sequence within a repertoire
//   - Keeps repertoire composition separate from line content
export const repertoireLines = mysqlTable(
  "repertoire_lines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to repertoires.id */
    repertoireId: varchar("repertoire_id", { length: 36 }).notNull(),

    /** FK to opening_lines.id */
    lineId: varchar("line_id", { length: 36 }).notNull(),

    /** Position in the repertoire study order */
    sortOrder: int("sort_order").notNull().default(0),

    /** Optional note specific to this line within this repertoire */
    note: text("note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    repertoireIdx: index("rl_repertoire_id_idx").on(table.repertoireId),
    lineIdx: index("rl_line_id_idx").on(table.lineId),
    repertoireSortIdx: index("rl_rep_sort_idx").on(table.repertoireId, table.sortOrder),
  })
);
export type RepertoireLineRow = typeof repertoireLines.$inferSelect;
export type NewRepertoireLineRow = typeof repertoireLines.$inferInsert;

// ─── model_games ─────────────────────────────────────────────────────────────
// Annotated reference games that illustrate a specific opening line in action.
// Think "Kasparov vs. Topalov, Wijk aan Zee 1999" linked to the Sicilian Najdorf.
//
// Why it exists:
//   - Shows users how a line plays out in a real game
//   - Annotations explain key moments and strategic ideas
//   - Links to specific lines for contextual study
//   - Future: auto-link user's own games that match a studied line
export const modelGames = mysqlTable(
  "model_games",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to opening_lines.id — which line this game illustrates */
    lineId: varchar("line_id", { length: 36 }).notNull(),

    /** Game title, e.g. "Kasparov vs. Topalov, Wijk aan Zee 1999" */
    title: varchar("title", { length: 300 }).notNull(),

    /** White player name */
    whitePlayer: varchar("white_player", { length: 100 }).notNull(),

    /** Black player name */
    blackPlayer: varchar("black_player", { length: 100 }).notNull(),

    /** Event name, e.g. "Wijk aan Zee" */
    event: varchar("event", { length: 200 }),

    /** Year the game was played */
    year: int("year"),

    /** Game result: 1-0 | 0-1 | 1/2-1/2 */
    result: varchar("result", { length: 10 }).notNull(),

    /** Full PGN with annotations */
    pgn: text("pgn").notNull(),

    /** Final FEN position */
    finalFen: text("final_fen"),

    /** Total moves in the game */
    totalMoves: int("total_moves"),

    /** Rich annotation / commentary (Markdown-safe) */
    commentary: text("commentary"),

    /** Why this game was selected as a model game */
    selectionReason: text("selection_reason"),

    /** Sort order among model games for the same line */
    sortOrder: int("sort_order").notNull().default(0),

    /** Whether this game is published */
    isPublished: tinyint("is_published").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    lineIdx: index("mg_line_id_idx").on(table.lineId),
    lineSortIdx: index("mg_line_sort_idx").on(table.lineId, table.sortOrder),
  })
);
export type ModelGameRow = typeof modelGames.$inferSelect;
export type NewModelGameRow = typeof modelGames.$inferInsert;

// ─── user_line_reviews ───────────────────────────────────────────────────────
// Per-user, per-line spaced repetition state. One row per (user, line) pair.
// Fields are SM-2 algorithm compatible for future spaced repetition scheduling.
//
// Why it exists:
//   - Tracks which lines a user has studied and their mastery level
//   - SM-2 fields (interval, easeFactor, repetitions) enable spaced repetition
//   - Streak and accuracy tracking for gamification
//   - nextReviewAt drives the daily study queue
//   - Future: adaptive difficulty based on review performance
export const userLineReviews = mysqlTable(
  "user_line_reviews",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to users.id */
    userId: varchar("user_id", { length: 36 }).notNull(),

    /** FK to opening_lines.id */
    lineId: varchar("line_id", { length: 36 }).notNull(),

    /** Current mastery: new | learning | reviewing | mastered */
    status: varchar("status", { length: 20 }).notNull().default("new"),

    /** SM-2: current interval in days between reviews */
    intervalDays: int("interval_days").notNull().default(0),

    /** SM-2: ease factor (starts at 2.5, min 1.3) — stored as integer × 100 */
    easeFactor: int("ease_factor").notNull().default(250),

    /** SM-2: number of consecutive successful reviews */
    repetitions: int("repetitions").notNull().default(0),

    /** When this line should next be reviewed */
    nextReviewAt: timestamp("next_review_at"),

    /** Last time the user reviewed this line */
    lastReviewedAt: timestamp("last_reviewed_at"),

    /** Total number of review attempts */
    totalAttempts: int("total_attempts").notNull().default(0),

    /** Number of correct (quality >= 3) attempts */
    correctAttempts: int("correct_attempts").notNull().default(0),

    /** Current streak of consecutive correct reviews */
    streak: int("streak").notNull().default(0),

    /** Best streak ever achieved */
    bestStreak: int("best_streak").notNull().default(0),

    /** Last review quality rating (0–5, SM-2 scale) */
    lastQuality: int("last_quality"),

    /** Average time in seconds to complete a review of this line */
    avgReviewSeconds: int("avg_review_seconds"),

    /** JSON array of recent review results for analytics, e.g. [{"q":4,"ts":"..."},…] */
    reviewHistory: text("review_history"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("ulr_user_id_idx").on(table.userId),
    lineIdx: index("ulr_line_id_idx").on(table.lineId),
    userLineIdx: index("ulr_user_line_idx").on(table.userId, table.lineId),
    userStatusIdx: index("ulr_user_status_idx").on(table.userId, table.status),
    nextReviewIdx: index("ulr_next_review_idx").on(table.userId, table.nextReviewAt),
  })
);
export type UserLineReviewRow = typeof userLineReviews.$inferSelect;
export type NewUserLineReviewRow = typeof userLineReviews.$inferInsert;

// ─── opening_tags ────────────────────────────────────────────────────────────
// Flexible tag system for categorizing openings and lines.
// Tags can represent themes ("kingside-attack"), structures ("isolated-qp"),
// styles ("aggressive"), or custom categories ("beginner-friendly").
//
// Why it exists:
//   - Enables flexible, multi-dimensional filtering beyond ECO codes
//   - Tags can be added without schema changes
//   - Supports both opening-level and line-level tagging
//   - Future: user-created tags, community voting on tag relevance
export const openingTags = mysqlTable(
  "opening_tags",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** Tag display name, e.g. "Kingside Attack" */
    name: varchar("name", { length: 100 }).notNull(),

    /** URL-safe slug, e.g. "kingside-attack" */
    slug: varchar("slug", { length: 100 }).notNull().unique(),

    /** Tag category: theme | structure | style | level | custom */
    category: varchar("category", { length: 30 }).notNull().default("theme"),

    /** Optional description of what this tag means */
    description: text("description"),

    /** Sort order for display */
    sortOrder: int("sort_order").notNull().default(100),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("ot_slug_idx").on(table.slug),
    categoryIdx: index("ot_category_idx").on(table.category),
  })
);
export type OpeningTagRow = typeof openingTags.$inferSelect;
export type NewOpeningTagRow = typeof openingTags.$inferInsert;

// ─── opening_tag_map ─────────────────────────────────────────────────────────
// Junction table: tags ↔ openings (many-to-many).
export const openingTagMap = mysqlTable(
  "opening_tag_map",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to opening_tags.id */
    tagId: varchar("tag_id", { length: 36 }).notNull(),

    /** FK to openings.id */
    openingId: varchar("opening_id", { length: 36 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tagIdx: index("otm_tag_id_idx").on(table.tagId),
    openingIdx: index("otm_opening_id_idx").on(table.openingId),
    tagOpeningIdx: index("otm_tag_opening_idx").on(table.tagId, table.openingId),
  })
);
export type OpeningTagMapRow = typeof openingTagMap.$inferSelect;
export type NewOpeningTagMapRow = typeof openingTagMap.$inferInsert;

// ─── line_tag_map ────────────────────────────────────────────────────────────
// Junction table: tags ↔ opening_lines (many-to-many).
export const lineTagMap = mysqlTable(
  "line_tag_map",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    /** FK to opening_tags.id */
    tagId: varchar("tag_id", { length: 36 }).notNull(),

    /** FK to opening_lines.id */
    lineId: varchar("line_id", { length: 36 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tagIdx: index("ltm_tag_id_idx").on(table.tagId),
    lineIdx: index("ltm_line_id_idx").on(table.lineId),
    tagLineIdx: index("ltm_tag_line_idx").on(table.tagId, table.lineId),
  })
);
export type LineTagMapRow = typeof lineTagMap.$inferSelect;
export type NewLineTagMapRow = typeof lineTagMap.$inferInsert;
