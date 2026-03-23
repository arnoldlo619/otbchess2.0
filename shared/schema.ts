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
