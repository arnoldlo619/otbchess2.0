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
    lichessElo: int("lichess_elo"),

    // Avatar URL (chess.com avatar or custom upload)
    avatarUrl: text("avatar_url"),

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
