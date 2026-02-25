/**
 * OTB Chess — Database Schema (Drizzle ORM, MySQL / TiDB Cloud)
 *
 * Tables:
 *  - push_subscriptions: Persists Web Push subscriptions per tournament so
 *    the director can broadcast round-start notifications even after a server
 *    restart. Each row represents one browser subscription endpoint.
 */

import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

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
