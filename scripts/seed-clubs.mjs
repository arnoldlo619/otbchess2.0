/**
 * seed-clubs.mjs
 * Seeds the 11 demo clubs from clubRegistry into the DB clubs table.
 * Run once: node scripts/seed-clubs.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Use mysql2 directly since we can't easily import the TS server code
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SEED_CLUBS = [
  {
    id: "seed-club-1",
    name: "Knight Club Chess",
    slug: "knight-club-chess",
    tagline: "London's chess nightlife — where the board meets the dancefloor.",
    description: "Knight Club Chess is London's premier chess nightlife collective, hosting high-energy evening events that blend competitive OTB chess with live music, DJs, and a vibrant social scene.",
    location: "London, UK",
    country: "GB",
    category: "community",
    avatarUrl: null,
    bannerUrl: "/manus-storage/681287088_17881618377555133_2847493176513169793_n_f0dcf8c6.jpg",
    accentColor: "#2233CC",
    ownerId: "seed",
    ownerName: "Knight Club Chess",
    memberCount: 142,
    tournamentCount: 24,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.instagram.com/knightclubchess/",
    twitter: null,
    discord: null,
    announcement: "♟️ Next event: Seoul to London collab night — chess, live DJs, all levels welcome. Follow @knightclubchess for tickets.",
    foundedAt: new Date("2023-06-01T10:00:00Z"),
  },
  {
    id: "seed-club-2",
    name: "NYC Chess Collective",
    slug: "nyc-chess-collective",
    tagline: "Bringing chess to every corner of New York City.",
    description: "A community-driven club running weekly blitz nights in Brooklyn, Manhattan, and Queens.",
    location: "New York, NY",
    country: "US",
    category: "community",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#8B1A1A",
    ownerId: "seed",
    ownerName: "Maria Santos",
    memberCount: 89,
    tournamentCount: 18,
    followerCount: 0,
    isPublic: 1,
    website: null,
    twitter: null,
    discord: "https://discord.gg/nycchess",
    announcement: null,
    foundedAt: new Date("2024-06-01T10:00:00Z"),
  },
  {
    id: "seed-club-3",
    name: "Harvard Chess Club",
    slug: "harvard-chess-club",
    tagline: "Crimson pieces, championship minds.",
    description: "The Harvard Chess Club brings together Harvard students, faculty, and the broader Cambridge community for weekly play, intercollegiate matches, and the annual Harvard Open tournament.",
    location: "Cambridge, MA",
    country: "US",
    category: "university",
    avatarUrl: null,
    bannerUrl: "/manus-storage/HCC_twitter_logo4_-_crimson__black_8df617be.jpg",
    accentColor: "#A51C30",
    ownerId: "seed",
    ownerName: "Harvard Chess Club",
    memberCount: 34,
    tournamentCount: 9,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.harvardchess.com",
    twitter: null,
    discord: null,
    announcement: "♟️ Harvard Open 2026 registration is open. All skill levels welcome.",
    foundedAt: new Date("2022-09-01T10:00:00Z"),
  },
  {
    id: "seed-club-4",
    name: "Berlin Schachclub",
    slug: "berlin-schachclub",
    tagline: "Schach für alle — Chess for everyone.",
    description: "Berlin's most active chess club with over 200 members.",
    location: "Berlin, Germany",
    country: "DE",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#2D4A22",
    ownerId: "seed",
    ownerName: "Klaus Müller",
    memberCount: 218,
    tournamentCount: 31,
    followerCount: 0,
    isPublic: 1,
    website: "https://berlinschachclub.de",
    twitter: null,
    discord: null,
    announcement: null,
    foundedAt: new Date("2023-11-01T10:00:00Z"),
  },
  {
    id: "seed-club-5",
    name: "Koenji Chess Club",
    slug: "koenji-chess-club",
    tagline: "Every 1st & 3rd Wednesday at The Den in Koenji.",
    description: "Koenji Chess Club meets every 1st and 3rd Wednesday at The Den in Koenji, Suginami-ku, Tokyo — 6 to 10pm. All levels welcome.",
    location: "Koenji, Tokyo, Japan",
    country: "JP",
    category: "community",
    avatarUrl: null,
    bannerUrl: "/manus-storage/732620725_18086479040637666_7406604460605570594_n_e42c49af.jpg",
    accentColor: "#CC2222",
    ownerId: "seed",
    ownerName: "Koenji Chess Club",
    memberCount: 67,
    tournamentCount: 12,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.instagram.com/p/DaG5lKBAf5t/",
    twitter: null,
    discord: null,
    announcement: "♟️ Next event: July 1 — The Den, 4-25-8 Koenjiminami, Suginami-ku. 6–10pm.",
    foundedAt: new Date("2023-04-01T10:00:00Z"),
  },
  {
    id: "seed-club-7",
    name: "Pawn Chess Club",
    slug: "pawn-chess-club",
    tagline: "NYC's most vibrant chess nightlife — all levels welcome.",
    description: "Born in New York City with a simple goal: create a space where strangers and friends could play chess without intimidation.",
    location: "New York, NY",
    country: "US",
    category: "community",
    avatarUrl: null,
    bannerUrl: "/manus-storage/PawnChessClub_4938828b.jpeg",
    accentColor: "#E8C547",
    ownerId: "seed",
    ownerName: "Ismu Isamu",
    memberCount: 312,
    tournamentCount: 38,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.instagram.com/pawnchessclub/",
    twitter: null,
    discord: null,
    announcement: "🎉 Speed Dating Chess Night — every Friday 7–9pm. All levels welcome. Limited tickets.",
    foundedAt: new Date("2022-09-01T10:00:00Z"),
  },
  {
    id: "seed-club-8",
    name: "Club Chess NYC",
    slug: "club-chess-nyc",
    tagline: "Where chess meets nightlife — est. 2023.",
    description: "Club Chess is a New York City-based chess collective founded in 2023.",
    location: "New York, NY",
    country: "US",
    category: "club",
    avatarUrl: null,
    bannerUrl: "/manus-storage/clubchessnyc_94c89398.jpg",
    accentColor: "#9B59B6",
    ownerId: "seed",
    ownerName: "Luke Quietman",
    memberCount: 274,
    tournamentCount: 29,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.instagram.com/clubchess.club/",
    twitter: null,
    discord: null,
    announcement: "♟️ Next event: Chess Night at The Monroe — live DJ, all levels. RSVP via Instagram.",
    foundedAt: new Date("2023-03-01T10:00:00Z"),
  },
  {
    id: "seed-club-9",
    name: "Marshall Chess Club",
    slug: "marshall-chess-club",
    tagline: "The heart of American chess since 1915.",
    description: "Founded in 1915 by U.S. Chess Champion Frank J. Marshall, the Marshall Chess Club is one of the oldest and most prestigious chess clubs in the world.",
    location: "New York, NY",
    country: "US",
    category: "club",
    avatarUrl: null,
    bannerUrl: "/manus-storage/marshallchessclub_e498ca97.jpg",
    accentColor: "#1A3A5C",
    ownerId: "seed",
    ownerName: "Marshall Chess Club",
    memberCount: 520,
    tournamentCount: 110,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.marshallchessclub.org",
    twitter: null,
    discord: null,
    announcement: "🏛️ The Marshall Chess Club Library is now open to members.",
    foundedAt: new Date("1915-01-01T10:00:00Z"),
  },
  {
    id: "seed-club-10",
    name: "Saint Louis Chess Club",
    slug: "saint-louis-chess-club",
    tagline: "World-class chess in the heart of America.",
    description: "The Saint Louis Chess Club is widely regarded as the premier chess club in the United States.",
    location: "Saint Louis, MO",
    country: "US",
    category: "professional",
    avatarUrl: null,
    bannerUrl: "/manus-storage/stlouischessclub_06d2a166.webp",
    accentColor: "#C41E3A",
    ownerId: "seed",
    ownerName: "Saint Louis Chess Club",
    memberCount: 890,
    tournamentCount: 47,
    followerCount: 0,
    isPublic: 1,
    website: "https://saintlouischessclub.org",
    twitter: null,
    discord: null,
    announcement: "🏆 2025 U.S. National Championships — registrations open now.",
    foundedAt: new Date("2008-08-01T10:00:00Z"),
  },
  {
    id: "seed-club-11",
    name: "Charlotte Chess Center",
    slug: "charlotte-chess-center",
    tagline: "The nation's award-winning chess hub.",
    description: "The Charlotte Chess Center (CCC) is a US award-winning chess club serving the Charlotte, NC community.",
    location: "Charlotte, NC",
    country: "US",
    category: "professional",
    avatarUrl: null,
    bannerUrl: "/manus-storage/charlottechesscenter_3f304989.png",
    accentColor: "#0066CC",
    ownerId: "seed",
    ownerName: "Charlotte Chess Center",
    memberCount: 640,
    tournamentCount: 52,
    followerCount: 0,
    isPublic: 1,
    website: "https://www.charlottechesscenter.org",
    twitter: null,
    discord: null,
    announcement: "📅 Sunday Action Quads — every Sunday afternoon.",
    foundedAt: new Date("2014-06-01T10:00:00Z"),
  },
];

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  let inserted = 0;
  let skipped = 0;

  for (const club of SEED_CLUBS) {
    try {
      await conn.execute(
        `INSERT INTO clubs (id, name, slug, tagline, description, location, country, category,
          avatar_url, banner_url, accent_color, owner_id, owner_name, member_count,
          tournament_count, follower_count, is_public, website, twitter, discord,
          announcement, founded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           tagline = VALUES(tagline),
           member_count = VALUES(member_count),
           is_public = VALUES(is_public),
           banner_url = VALUES(banner_url)`,
        [
          club.id, club.name, club.slug, club.tagline, club.description,
          club.location, club.country, club.category,
          club.avatarUrl, club.bannerUrl, club.accentColor,
          club.ownerId, club.ownerName,
          club.memberCount, club.tournamentCount, club.followerCount,
          club.isPublic,
          club.website, club.twitter, club.discord, club.announcement,
          club.foundedAt,
        ]
      );
      inserted++;
      console.log(`✓ ${club.name}`);
    } catch (err) {
      console.error(`✗ ${club.name}:`, err.message);
      skipped++;
    }
  }

  await conn.end();
  console.log(`\nDone: ${inserted} upserted, ${skipped} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
