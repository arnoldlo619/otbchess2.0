/**
 * OTB Chess — Club Registry
 *
 * Manages chess clubs: creation, membership, and tournament history.
 * Data is persisted in localStorage so it survives page refreshes.
 *
 * Storage keys:
 *   otb-clubs-v1          — array of Club objects
 *   otb-club-members-v1   — array of ClubMember join records
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClubCategory =
  | "club"
  | "school"
  | "university"
  | "online"
  | "community"
  | "professional";

export interface Club {
  id: string;
  /** Display name of the club */
  name: string;
  /** Short handle used in the URL, e.g. "london-chess-club" */
  slug: string;
  /** One-line tagline shown on cards */
  tagline: string;
  /** Longer description shown on the profile page */
  description: string;
  /** City / region */
  location: string;
  /** Country code, e.g. "US" */
  country: string;
  /** Category badge */
  category: ClubCategory;
  /** CDN URL for the club avatar/logo */
  avatarUrl: string | null;
  /** CDN URL for the club banner/cover image */
  bannerUrl: string | null;
  /** Primary brand colour (hex) used for the banner gradient overlay */
  accentColor: string;
  /** User ID of the founding director */
  ownerId: string;
  /** Display name of the founding director */
  ownerName: string;
  /** Total number of members (denormalised for display) */
  memberCount: number;
  /** Total tournaments hosted */
  tournamentCount: number;
  /** Total number of followers (non-member watchers) */
  followerCount?: number;
  /** ISO date string of founding */
  foundedAt: string;
  /** Whether the club is publicly discoverable */
  isPublic: boolean;
  /** Social links */
  website?: string;
  twitter?: string;
  discord?: string;
  /** Pinned announcement shown at the top of the profile */
  announcement?: string;
}

export interface ClubMember {
  clubId: string;
  /** User ID (from AuthUser.id) or a guest identifier */
  userId: string;
  displayName: string;
  chesscomUsername: string | null;
  lichessUsername: string | null;
  avatarUrl: string | null;
  /** "owner" | "director" | "member" */
  role: "owner" | "director" | "member";
  joinedAt: string;
  /** Number of club tournaments this member has played */
  tournamentsPlayed: number;
  /** Best finish position across all club tournaments */
  bestFinish: number | null;
  /** Number of Fantasy Chess League seasons won */
  leagueChampionships?: number;
}

export interface ClubTournament {
  clubId: string;
  tournamentId: string;
  name: string;
  date: string;
  format: string;
  playerCount: number;
  rounds: number;
  status: "upcoming" | "active" | "completed";
  winnerId?: string;
  winnerName?: string;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const CLUBS_KEY = "otb-clubs-v1";
const MEMBERS_KEY = "otb-club-members-v1";
const CLUB_TOURNAMENTS_KEY = "otb-club-tournaments-v1";
const FOLLOWS_KEY = "otb-club-follows-v1";

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadClubs(): Club[] {
  try {
    const raw = localStorage.getItem(CLUBS_KEY);
    return raw ? (JSON.parse(raw) as Club[]) : [];
  } catch {
    return [];
  }
}

function saveClubs(clubs: Club[]): void {
  try {
    localStorage.setItem(CLUBS_KEY, JSON.stringify(clubs));
  } catch { /* localStorage full */ }
}

function loadMembers(): ClubMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    return raw ? (JSON.parse(raw) as ClubMember[]) : [];
  } catch {
    return [];
  }
}

function saveMembers(members: ClubMember[]): void {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  } catch { /* localStorage full */ }
}

function loadClubTournaments(): ClubTournament[] {
  try {
    const raw = localStorage.getItem(CLUB_TOURNAMENTS_KEY);
    return raw ? (JSON.parse(raw) as ClubTournament[]) : [];
  } catch {
    return [];
  }
}

function saveClubTournaments(ct: ClubTournament[]): void {
  try {
    localStorage.setItem(CLUB_TOURNAMENTS_KEY, JSON.stringify(ct));
  } catch { /* localStorage full */ }
}

// ── ID generation ─────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Create a new club. The creator is automatically added as owner. */
export function createClub(
  input: Omit<Club, "id" | "slug" | "memberCount" | "tournamentCount" | "foundedAt">,
  creator: { userId: string; displayName: string; avatarUrl?: string | null }
): Club {
  const id = generateId();
  const slug = slugify(input.name);
  const club: Club = {
    ...input,
    id,
    slug,
    memberCount: 1,
    tournamentCount: 0,
    followerCount: 0,
    foundedAt: new Date().toISOString(),
  };
  const clubs = loadClubs();
  saveClubs([...clubs, club]);

  // Auto-join creator as owner
  const members = loadMembers();
  const ownerMember: ClubMember = {
    clubId: id,
    userId: creator.userId,
    displayName: creator.displayName,
    chesscomUsername: null,
    lichessUsername: null,
    avatarUrl: creator.avatarUrl ?? null,
    role: "owner",
    joinedAt: new Date().toISOString(),
    tournamentsPlayed: 0,
    bestFinish: null,
  };
  saveMembers([...members, ownerMember]);
  return club;
}

/** Retrieve a single club by its id. */
export function getClub(id: string): Club | null {
  return loadClubs().find((c) => c.id === id) ?? null;
}

/** Retrieve a single club by its slug. */
export function getClubBySlug(slug: string): Club | null {
  return loadClubs().find((c) => c.slug === slug) ?? null;
}

/** List all public clubs (for discovery). */
export function listAllClubs(): Club[] {
  return loadClubs().filter((c) => c.isPublic);
}

/** List clubs a specific user is a member of. */
export function listMyClubs(userId: string): Club[] {
  const members = loadMembers();
  const myClubIds = new Set(
    members.filter((m) => m.userId === userId).map((m) => m.clubId)
  );
  return loadClubs().filter((c) => myClubIds.has(c.id));
}

/** Check whether a user is a member of a club. */
export function isMember(clubId: string, userId: string): boolean {
  return loadMembers().some((m) => m.clubId === clubId && m.userId === userId);
}

/** Get a user's membership record for a club. */
export function getMembership(clubId: string, userId: string): ClubMember | null {
  return loadMembers().find((m) => m.clubId === clubId && m.userId === userId) ?? null;
}

/** Get all members of a club. */
export function getClubMembers(clubId: string): ClubMember[] {
  return loadMembers().filter((m) => m.clubId === clubId);
}

/** Join a club as a member. No-ops if already a member. */
export function joinClub(
  clubId: string,
  user: { userId: string; displayName: string; chesscomUsername?: string | null; lichessUsername?: string | null; avatarUrl?: string | null }
): void {
  if (isMember(clubId, user.userId)) return;
  const members = loadMembers();
  const newMember: ClubMember = {
    clubId,
    userId: user.userId,
    displayName: user.displayName,
    chesscomUsername: user.chesscomUsername ?? null,
    lichessUsername: user.lichessUsername ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: "member",
    joinedAt: new Date().toISOString(),
    tournamentsPlayed: 0,
    bestFinish: null,
  };
  saveMembers([...members, newMember]);
  // Increment memberCount
  const clubs = loadClubs();
  saveClubs(clubs.map((c) => c.id === clubId ? { ...c, memberCount: c.memberCount + 1 } : c));
}

/** Leave a club. Owners cannot leave (they must transfer ownership first). */
export function leaveClub(clubId: string, userId: string): void {
  const membership = getMembership(clubId, userId);
  if (!membership || membership.role === "owner") return;
  const members = loadMembers().filter(
    (m) => !(m.clubId === clubId && m.userId === userId)
  );
  saveMembers(members);
  const clubs = loadClubs();
  saveClubs(clubs.map((c) => c.id === clubId ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c));
}

/** Get all tournaments for a club. */
export function getClubTournaments(clubId: string): ClubTournament[] {
  return loadClubTournaments().filter((t) => t.clubId === clubId);
}

/** Update a club's details (owner/director only — caller must verify). */
export function updateClub(id: string, patch: Partial<Omit<Club, "id" | "slug" | "foundedAt">>): Club | null {
  const clubs = loadClubs();
  const idx = clubs.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...clubs[idx], ...patch };
  clubs[idx] = updated;
  saveClubs(clubs);
  return updated;
}

/**
 * Re-counts all tournaments linked to a club from the tournament registry
 * and updates the club's denormalised `tournamentCount` field.
 *
 * Call this after any tournament is created, deleted, or unlinked.
 * Returns the updated count, or null if the club was not found.
 */
export function syncClubTournamentCount(clubId: string): number | null {
  // Lazy import to avoid a circular dependency at module load time.
  // Both registries are localStorage-based so this is always synchronous.
  let count = 0;
  try {
    const raw = localStorage.getItem("otb-tournaments-v1");
    if (raw) {
      const tournaments: Array<{ clubId?: string }> = JSON.parse(raw);
      count = tournaments.filter((t) => t.clubId === clubId).length;
    }
  } catch { /* ignore parse errors */ }

  const updated = updateClub(clubId, { tournamentCount: count });
  return updated ? count : null;
}

// ── Follow API ───────────────────────────────────────────────────────────────

interface ClubFollow {
  clubId: string;
  userId: string;
  followedAt: string;
}

function loadFollows(): ClubFollow[] {
  try {
    const raw = localStorage.getItem(FOLLOWS_KEY);
    return raw ? (JSON.parse(raw) as ClubFollow[]) : [];
  } catch {
    return [];
  }
}

function saveFollows(follows: ClubFollow[]): void {
  try {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
  } catch { /* localStorage full */ }
}

/** Follow a club. No-ops if already following or a member. */
export function followClub(clubId: string, userId: string): void {
  const follows = loadFollows();
  if (follows.some((f) => f.clubId === clubId && f.userId === userId)) return;
  saveFollows([...follows, { clubId, userId, followedAt: new Date().toISOString() }]);
  // Increment followerCount
  const clubs = loadClubs();
  saveClubs(clubs.map((c) =>
    c.id === clubId ? { ...c, followerCount: (c.followerCount ?? 0) + 1 } : c
  ));
}

/** Unfollow a club. */
export function unfollowClub(clubId: string, userId: string): void {
  const follows = loadFollows();
  const existed = follows.some((f) => f.clubId === clubId && f.userId === userId);
  if (!existed) return;
  saveFollows(follows.filter((f) => !(f.clubId === clubId && f.userId === userId)));
  const clubs = loadClubs();
  saveClubs(clubs.map((c) =>
    c.id === clubId ? { ...c, followerCount: Math.max(0, (c.followerCount ?? 1) - 1) } : c
  ));
}

/** Check whether a user is following a club. */
export function isFollowing(clubId: string, userId: string): boolean {
  return loadFollows().some((f) => f.clubId === clubId && f.userId === userId);
}

/** Get the total follower count for a club. */
export function getFollowerCount(clubId: string): number {
  return loadFollows().filter((f) => f.clubId === clubId).length;
}

/** Clear all club data (test helper). */
export function clearClubRegistry(): void {
  try {
    localStorage.removeItem(CLUBS_KEY);
    localStorage.removeItem(MEMBERS_KEY);
    localStorage.removeItem(CLUB_TOURNAMENTS_KEY);
  } catch { /* ignore */ }
}

// ── Mock seed data ────────────────────────────────────────────────────────────
// Seeded once on first load so the discovery page is never empty.

const SEED_CLUBS: Omit<Club, "id" | "slug" | "memberCount" | "tournamentCount" | "foundedAt">[] = [
  {
    name: "London Chess Club",
    tagline: "The oldest chess club in the world, still playing strong.",
    description:
      "Founded in 1807, London Chess Club is one of the world's oldest and most prestigious chess clubs. We host weekly rapid tournaments, monthly classical events, and an annual open championship attracting players from across Europe.",
    location: "London, UK",
    country: "GB",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#1a3a5c",
    ownerId: "seed",
    ownerName: "James Whitmore",
    isPublic: true,
    website: "https://londonchessclub.org",
    announcement: "Spring Open 2026 registrations now open — 64 player cap, Swiss 7 rounds.",
  },
  {
    name: "NYC Chess Collective",
    tagline: "Bringing chess to every corner of New York City.",
    description:
      "A community-driven club running weekly blitz nights in Brooklyn, Manhattan, and Queens. All skill levels welcome. We partner with local schools to grow the next generation of OTB players.",
    location: "New York, NY",
    country: "US",
    category: "community",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#8B1A1A",
    ownerId: "seed",
    ownerName: "Maria Santos",
    isPublic: true,
    discord: "https://discord.gg/nycchess",
  },
  {
    name: "Stanford Chess Team",
    tagline: "Competing at the collegiate level since 1972.",
    description:
      "Stanford's official intercollegiate chess team. We compete in the Pan-American Intercollegiate Chess Championship and host the annual Bay Area Collegiate Open. Open to all Stanford students.",
    location: "Stanford, CA",
    country: "US",
    category: "university",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#8C1515",
    ownerId: "seed",
    ownerName: "Alex Chen",
    isPublic: true,
  },
  {
    name: "Berlin Schachclub",
    tagline: "Schach für alle — Chess for everyone.",
    description:
      "Berlin's most active chess club with over 200 members. Regular Bundesliga participation, youth programs, and a welcoming atmosphere for beginners and masters alike.",
    location: "Berlin, Germany",
    country: "DE",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#2D4A22",
    ownerId: "seed",
    ownerName: "Klaus Müller",
    isPublic: true,
    website: "https://berlinschachclub.de",
  },
  {
    name: "Tokyo Chess Society",
    tagline: "Where East meets West over 64 squares.",
    description:
      "An international chess community in Tokyo welcoming players from Japan and around the world. Monthly tournaments, English and Japanese spoken, all levels welcome.",
    location: "Tokyo, Japan",
    country: "JP",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#8B2252",
    ownerId: "seed",
    ownerName: "Yuki Tanaka",
    isPublic: true,
  },
  {
    name: "Mumbai Chess Academy",
    tagline: "Training India's next generation of grandmasters.",
    description:
      "A professional chess academy offering structured training programs for all ages. Our students have won multiple national youth championships. We host FIDE-rated tournaments monthly.",
    location: "Mumbai, India",
    country: "IN",
    category: "professional",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#5C3317",
    ownerId: "seed",
    ownerName: "Priya Sharma",
    isPublic: true,
  },
  // ── Trending US Showcase Clubs ────────────────────────────────────────────
  {
    name: "Pawn Chess Club",
    tagline: "NYC's most vibrant chess nightlife — all levels welcome.",
    description:
      "Born in New York City with a simple goal: create a space where strangers and friends could play chess without intimidation. Pawn Chess Club hosts weekly evening events across Manhattan and Brooklyn with live DJ sets, speed-dating chess rounds, and casual open play. With 7,800+ Instagram followers and sold-out events every week, Pawn is redefining what a chess club looks and feels like. Founded by @ismuisamu and @simone_nr.",
    location: "New York, NY",
    country: "US",
    category: "community",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#E8C547",
    ownerId: "seed",
    ownerName: "Ismu Isamu",
    isPublic: true,
    website: "https://www.instagram.com/pawnchessclub/",
    announcement: "🎉 Speed Dating Chess Night — every Friday 7–9pm. All levels welcome. Limited tickets.",
  },
  {
    name: "Club Chess NYC",
    tagline: "Where chess meets nightlife — est. 2023.",
    description:
      "Club Chess is a New York City-based chess collective founded in 2023 by @quietluke and @corrineciani. With 8,700+ Instagram followers, Club Chess has become one of the most talked-about chess experiences in the city — blending competitive play with DJ sets, art, and community. Monthly residencies at venues like The Monroe and Tawny NYC. Part of a growing movement bringing chess into cultural nightlife spaces.",
    location: "New York, NY",
    country: "US",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#9B59B6",
    ownerId: "seed",
    ownerName: "Luke Quietman",
    isPublic: true,
    website: "https://www.instagram.com/clubchess.club/",
    announcement: "♟️ Next event: Chess Night at The Monroe — live DJ, all levels. RSVP via Instagram.",
  },
  {
    name: "Marshall Chess Club",
    tagline: "The heart of American chess since 1915.",
    description:
      "Founded in 1915 by U.S. Chess Champion Frank J. Marshall, the Marshall Chess Club is one of the oldest and most prestigious chess clubs in the world. Located in the heart of Greenwich Village, New York City, the Marshall has hosted legends including Bobby Fischer, Fabiano Caruana, and Hikaru Nakamura. A gold affiliate of the United States Chess Federation, the club offers daily open play, USCF-rated tournaments, simultaneous exhibitions, and a world-class chess library.",
    location: "New York, NY",
    country: "US",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#1A3A5C",
    ownerId: "seed",
    ownerName: "Marshall Chess Club",
    isPublic: true,
    website: "https://www.marshallchessclub.org",
    announcement: "🏛️ The Marshall Chess Club Library is now open to members. Visit the club office for more info.",
  },
  {
    name: "Saint Louis Chess Club",
    tagline: "World-class chess in the heart of America.",
    description:
      "The Saint Louis Chess Club is widely regarded as the premier chess club in the United States. Founded in 2008, it has hosted the U.S. Championship, U.S. Women's Championship, Sinquefield Cup, and numerous world-class invitationals. The club offers beginner classes, advanced training, group lessons, and weekly tournaments for all ages and abilities. A member-based community center that has transformed Saint Louis into the chess capital of North America.",
    location: "Saint Louis, MO",
    country: "US",
    category: "professional",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#C41E3A",
    ownerId: "seed",
    ownerName:"Saint Louis Chess Club",
    isPublic: true,
    website: "https://saintlouischessclub.org",
    announcement: "🏆 2025 U.S. National Championships — registrations open now. FIDE-rated. All levels.",
  },
  {
    name: "Charlotte Chess Center",
    tagline: "The nation's award-winning chess hub.",
    description:
      "The Charlotte Chess Center (CCC) is a US award-winning chess club serving the Charlotte, NC community. With 600+ members, 50+ weekly students, and 2,500+ community members reached, CCC is one of the fastest-growing chess clubs in America. The club offers weekly Sunday Action Quads for youth, Monday Adult Casual nights, USCF and FIDE-rated tournaments, school programs, summer camps, and private lessons. Named one of the top chess institutes in the nation.",
    location: "Charlotte, NC",
    country: "US",
    category: "professional",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#0066CC",
    ownerId: "seed",
    ownerName: "Charlotte Chess Center",
    isPublic: true,
    website: "https://www.charlottechesscenter.org",
    announcement: "📅 Sunday Action Quads — every Sunday afternoon. Youth USCF-rated. Register online.",
  },
];

const SEED_MEMBERS_PER_CLUB: Omit<ClubMember, "clubId">[][] = [
  // London Chess Club
  [
    { userId: "seed-m1", displayName: "James Whitmore", chesscomUsername: "jwhitmore", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2024-01-15T10:00:00Z", tournamentsPlayed: 12, bestFinish: 1 },
    { userId: "seed-m2", displayName: "Sophie Clarke", chesscomUsername: "sophieclark", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2024-02-01T10:00:00Z", tournamentsPlayed: 8, bestFinish: 2 },
    { userId: "seed-m3", displayName: "Oliver Bennett", chesscomUsername: null, lichessUsername: "obennett", avatarUrl: null, role: "member", joinedAt: "2024-03-10T10:00:00Z", tournamentsPlayed: 5, bestFinish: 3 },
    { userId: "seed-m4", displayName: "Emma Walsh", chesscomUsername: "emmawalsh99", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2024-04-22T10:00:00Z", tournamentsPlayed: 3, bestFinish: 4 },
    { userId: "seed-m5", displayName: "Liam Foster", chesscomUsername: null, lichessUsername: "lfoster", avatarUrl: null, role: "member", joinedAt: "2024-05-05T10:00:00Z", tournamentsPlayed: 7, bestFinish: 1 },
  ],
  // NYC Chess Collective
  [
    { userId: "seed-m6", displayName: "Maria Santos", chesscomUsername: "mariasantos", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2024-06-01T10:00:00Z", tournamentsPlayed: 15, bestFinish: 1 },
    { userId: "seed-m7", displayName: "DeShawn Williams", chesscomUsername: "deshawnw", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2024-06-15T10:00:00Z", tournamentsPlayed: 10, bestFinish: 2 },
    { userId: "seed-m8", displayName: "Aisha Johnson", chesscomUsername: null, lichessUsername: "aishaj", avatarUrl: null, role: "member", joinedAt: "2024-07-01T10:00:00Z", tournamentsPlayed: 6, bestFinish: 3 },
  ],
  // Stanford Chess Team
  [
    { userId: "seed-m9", displayName: "Alex Chen", chesscomUsername: "alexchen2025", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2024-09-01T10:00:00Z", tournamentsPlayed: 9, bestFinish: 1 },
    { userId: "seed-m10", displayName: "Priya Patel", chesscomUsername: null, lichessUsername: "priyap", avatarUrl: null, role: "member", joinedAt: "2024-09-15T10:00:00Z", tournamentsPlayed: 4, bestFinish: 2 },
  ],
  // Berlin Schachclub
  [
    { userId: "seed-m11", displayName: "Klaus Müller", chesscomUsername: "klausm", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2023-11-01T10:00:00Z", tournamentsPlayed: 20, bestFinish: 1 },
    { userId: "seed-m12", displayName: "Ingrid Bauer", chesscomUsername: null, lichessUsername: "ibauer", avatarUrl: null, role: "director", joinedAt: "2023-12-01T10:00:00Z", tournamentsPlayed: 14, bestFinish: 2 },
    { userId: "seed-m13", displayName: "Hans Richter", chesscomUsername: "hansrichter", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2024-01-10T10:00:00Z", tournamentsPlayed: 8, bestFinish: 3 },
  ],
  // Tokyo Chess Society
  [
    { userId: "seed-m14", displayName: "Yuki Tanaka", chesscomUsername: "yukitanaka", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2024-02-01T10:00:00Z", tournamentsPlayed: 11, bestFinish: 1 },
    { userId: "seed-m15", displayName: "Kenji Yamamoto", chesscomUsername: null, lichessUsername: "kenjiy", avatarUrl: null, role: "member", joinedAt: "2024-03-01T10:00:00Z", tournamentsPlayed: 6, bestFinish: 2 },
  ],
  // Mumbai Chess Academy
  [
    { userId: "seed-m16", displayName: "Priya Sharma", chesscomUsername: "priyasharma", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2023-08-01T10:00:00Z", tournamentsPlayed: 18, bestFinish: 1 },
    { userId: "seed-m17", displayName: "Arjun Mehta", chesscomUsername: "arjunm", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2023-09-01T10:00:00Z", tournamentsPlayed: 12, bestFinish: 2 },
    { userId: "seed-m18", displayName: "Riya Gupta", chesscomUsername: null, lichessUsername: "riyag", avatarUrl: null, role: "member", joinedAt: "2023-10-15T10:00:00Z", tournamentsPlayed: 7, bestFinish: 3 },
  ],
  // Pawn Chess Club
  [
    { userId: "seed-m19", displayName: "Ismu Isamu", chesscomUsername: "ismuisamu", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2022-09-01T10:00:00Z", tournamentsPlayed: 38, bestFinish: 1 },
    { userId: "seed-m20", displayName: "Simone N.", chesscomUsername: "simonenr", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2022-09-01T10:00:00Z", tournamentsPlayed: 32, bestFinish: 1 },
    { userId: "seed-m21", displayName: "Jordan Lee", chesscomUsername: null, lichessUsername: "jordanlee", avatarUrl: null, role: "member", joinedAt: "2023-01-10T10:00:00Z", tournamentsPlayed: 14, bestFinish: 2 },
    { userId: "seed-m22", displayName: "Mia Torres", chesscomUsername: "miatorres", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2023-04-20T10:00:00Z", tournamentsPlayed: 9, bestFinish: 3 },
  ],
  // Club Chess NYC
  [
    { userId: "seed-m23", displayName: "Luke Quietman", chesscomUsername: "quietluke", lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2023-03-01T10:00:00Z", tournamentsPlayed: 29, bestFinish: 1 },
    { userId: "seed-m24", displayName: "Corrine C.", chesscomUsername: "corrineciani", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2023-03-01T10:00:00Z", tournamentsPlayed: 24, bestFinish: 2 },
    { userId: "seed-m25", displayName: "Dante Rivera", chesscomUsername: null, lichessUsername: "drivera", avatarUrl: null, role: "member", joinedAt: "2023-06-15T10:00:00Z", tournamentsPlayed: 11, bestFinish: 2 },
  ],
  // Marshall Chess Club
  [
    { userId: "seed-m26", displayName: "Marshall Chess Club", chesscomUsername: null, lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "1915-01-01T10:00:00Z", tournamentsPlayed: 110, bestFinish: 1 },
    { userId: "seed-m27", displayName: "FM David Brodsky", chesscomUsername: "davidbrodsky", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2020-01-01T10:00:00Z", tournamentsPlayed: 45, bestFinish: 1 },
    { userId: "seed-m28", displayName: "GM Aleksandr Lenderman", chesscomUsername: "lenderman", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2018-06-01T10:00:00Z", tournamentsPlayed: 60, bestFinish: 1 },
    { userId: "seed-m29", displayName: "Sarah Chiang", chesscomUsername: "sarahchiang", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2022-09-01T10:00:00Z", tournamentsPlayed: 18, bestFinish: 3 },
  ],
  // Saint Louis Chess Club
  [
    { userId: "seed-m30", displayName: "Saint Louis Chess Club", chesscomUsername: null, lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2008-08-01T10:00:00Z", tournamentsPlayed: 47, bestFinish: 1 },
    { userId: "seed-m31", displayName: "GM Fabiano Caruana", chesscomUsername: "fabianocaruana", lichessUsername: "fabianocaruana", avatarUrl: null, role: "member", joinedAt: "2015-01-01T10:00:00Z", tournamentsPlayed: 12, bestFinish: 1 },
    { userId: "seed-m32", displayName: "GM Hikaru Nakamura", chesscomUsername: "hikaru", lichessUsername: "hikaru", avatarUrl: null, role: "member", joinedAt: "2014-01-01T10:00:00Z", tournamentsPlayed: 10, bestFinish: 1 },
    { userId: "seed-m33", displayName: "IM Joshua Ruiz", chesscomUsername: "joshuaruiz", lichessUsername: null, avatarUrl: null, role: "director", joinedAt: "2019-06-01T10:00:00Z", tournamentsPlayed: 28, bestFinish: 1 },
  ],
  // Charlotte Chess Center
  [
    { userId: "seed-m34", displayName: "Charlotte Chess Center", chesscomUsername: null, lichessUsername: null, avatarUrl: null, role: "owner", joinedAt: "2014-06-01T10:00:00Z", tournamentsPlayed: 52, bestFinish: 1 },
    { userId: "seed-m35", displayName: "FM Eric Yuhan Li", chesscomUsername: "ericyuhanli", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2020-01-01T10:00:00Z", tournamentsPlayed: 22, bestFinish: 1 },
    { userId: "seed-m36", displayName: "Aiden Park", chesscomUsername: "aidenpark", lichessUsername: null, avatarUrl: null, role: "member", joinedAt: "2021-09-01T10:00:00Z", tournamentsPlayed: 15, bestFinish: 1 },
    { userId: "seed-m37", displayName: "Coach Raj Patel", chesscomUsername: null, lichessUsername: "rajpatel", avatarUrl: null, role: "director", joinedAt: "2016-01-01T10:00:00Z", tournamentsPlayed: 30, bestFinish: 2 },
  ],
];

const SEED_MEMBER_COUNTS = [142, 89, 34, 218, 67, 156, 312, 274, 520, 890, 640];
const SEED_TOURNAMENT_COUNTS = [24, 18, 9, 31, 12, 22, 38, 29, 110, 47, 52];
const SEED_FOUNDED_DATES = [
  "2024-01-15T10:00:00Z",
  "2024-06-01T10:00:00Z",
  "2024-09-01T10:00:00Z",
  "2023-11-01T10:00:00Z",
  "2024-02-01T10:00:00Z",
  "2023-08-01T10:00:00Z",
  // Trending US clubs
  "2022-09-01T10:00:00Z", // Pawn Chess Club
  "2023-03-01T10:00:00Z", // Club Chess NYC
  "1915-01-01T10:00:00Z", // Marshall Chess Club
  "2008-08-01T10:00:00Z", // Saint Louis Chess Club
  "2014-06-01T10:00:00Z", // Charlotte Chess Center
];

const SEED_TOURNAMENTS: Omit<ClubTournament, "clubId">[][] = [
  // London Chess Club
  [
    { tournamentId: "lcc-spring-2026", name: "Spring Open 2026", date: "2026-04-12", format: "Swiss", playerCount: 0, rounds: 7, status: "upcoming" },
    { tournamentId: "lcc-winter-2025", name: "Winter Classic 2025", date: "2025-12-14", format: "Swiss", playerCount: 48, rounds: 7, status: "completed", winnerName: "Liam Foster" },
    { tournamentId: "lcc-autumn-2025", name: "Autumn Rapid 2025", date: "2025-10-05", format: "Swiss", playerCount: 32, rounds: 5, status: "completed", winnerName: "Sophie Clarke" },
    { tournamentId: "lcc-summer-2025", name: "Summer Blitz 2025", date: "2025-07-20", format: "Swiss", playerCount: 24, rounds: 5, status: "completed", winnerName: "James Whitmore" },
  ],
  // NYC Chess Collective
  [
    { tournamentId: "nyc-april-2026", name: "Brooklyn Blitz April", date: "2026-04-05", format: "Swiss", playerCount: 0, rounds: 5, status: "upcoming" },
    { tournamentId: "nyc-march-2026", name: "Manhattan Open March", date: "2026-03-01", format: "Swiss", playerCount: 28, rounds: 5, status: "completed", winnerName: "Maria Santos" },
  ],
  // Stanford Chess Team
  [
    { tournamentId: "stanford-collegiate-2026", name: "Bay Area Collegiate Open 2026", date: "2026-05-10", format: "Swiss", playerCount: 0, rounds: 6, status: "upcoming" },
    { tournamentId: "stanford-fall-2025", name: "Fall Invitational 2025", date: "2025-11-08", format: "Round Robin", playerCount: 12, rounds: 11, status: "completed", winnerName: "Alex Chen" },
  ],
  // Berlin Schachclub
  [
    { tournamentId: "berlin-open-2026", name: "Berlin Open 2026", date: "2026-06-20", format: "Swiss", playerCount: 0, rounds: 9, status: "upcoming" },
    { tournamentId: "berlin-rapid-2026", name: "Rapid Championship 2026", date: "2026-02-15", format: "Swiss", playerCount: 64, rounds: 7, status: "completed", winnerName: "Klaus Müller" },
    { tournamentId: "berlin-blitz-2025", name: "Blitz Night December", date: "2025-12-20", format: "Swiss", playerCount: 40, rounds: 5, status: "completed", winnerName: "Ingrid Bauer" },
  ],
  // Tokyo Chess Society
  [
    { tournamentId: "tokyo-spring-2026", name: "Spring Rapid 2026", date: "2026-04-18", format: "Swiss", playerCount: 0, rounds: 5, status: "upcoming" },
    { tournamentId: "tokyo-winter-2025", name: "Winter Open 2025", date: "2025-12-07", format: "Swiss", playerCount: 22, rounds: 5, status: "completed", winnerName: "Yuki Tanaka" },
  ],
  // Mumbai Chess Academy
  [
    { tournamentId: "mumbai-open-2026", name: "Mumbai FIDE Open 2026", date: "2026-03-22", format: "Swiss", playerCount: 80, rounds: 9, status: "active" },
    { tournamentId: "mumbai-youth-2025", name: "Youth Championship 2025", date: "2025-11-30", format: "Swiss", playerCount: 48, rounds: 7, status: "completed", winnerName: "Arjun Mehta" },
    { tournamentId: "mumbai-rapid-2025", name: "Academy Rapid Cup", date: "2025-09-14", format: "Swiss", playerCount: 36, rounds: 6, status: "completed", winnerName: "Priya Sharma" },
  ],
  // Pawn Chess Club
  [
    { tournamentId: "pawn-speed-dating-apr-2026", name: "Speed Dating Chess Night April", date: "2026-04-04", format: "Swiss", playerCount: 0, rounds: 8, status: "upcoming" },
    { tournamentId: "pawn-speed-dating-mar-2026", name: "Speed Dating Chess Night March", date: "2026-03-07", format: "Swiss", playerCount: 42, rounds: 8, status: "completed", winnerName: "Ismu Isamu" },
    { tournamentId: "pawn-blitz-feb-2026", name: "Pawn Blitz February", date: "2026-02-14", format: "Swiss", playerCount: 38, rounds: 5, status: "completed", winnerName: "Simone N." },
  ],
  // Club Chess NYC
  [
    { tournamentId: "clubchess-monroe-apr-2026", name: "Chess Night at The Monroe — April", date: "2026-04-09", format: "Swiss", playerCount: 0, rounds: 5, status: "upcoming" },
    { tournamentId: "clubchess-tawny-mar-2026", name: "Tawny NYC Residency March", date: "2026-03-05", format: "Swiss", playerCount: 56, rounds: 5, status: "completed", winnerName: "Luke Quietman" },
    { tournamentId: "clubchess-beimax-2026", name: "Beimax x Club Chess Collab", date: "2026-02-22", format: "Swiss", playerCount: 30, rounds: 4, status: "completed", winnerName: "Corrine C." },
  ],
  // Marshall Chess Club
  [
    { tournamentId: "marshall-open-apr-2026", name: "Marshall Open April 2026", date: "2026-04-20", format: "Swiss", playerCount: 0, rounds: 7, status: "upcoming" },
    { tournamentId: "marshall-rapid-mar-2026", name: "Marshall Rapid March", date: "2026-03-15", format: "Swiss", playerCount: 48, rounds: 6, status: "completed", winnerName: "FM David Brodsky" },
    { tournamentId: "marshall-blitz-2026", name: "Winter Blitz Championship", date: "2026-01-18", format: "Swiss", playerCount: 64, rounds: 7, status: "completed", winnerName: "GM Aleksandr Lenderman" },
    { tournamentId: "marshall-simul-2025", name: "GM Simultaneous Exhibition", date: "2025-12-07", format: "Round Robin", playerCount: 20, rounds: 1, status: "completed", winnerName: "GM Hikaru Nakamura" },
  ],
  // Saint Louis Chess Club
  [
    { tournamentId: "stlcc-us-champ-2025", name: "2025 U.S. Championship", date: "2025-10-05", format: "Round Robin", playerCount: 12, rounds: 11, status: "completed", winnerName: "GM Fabiano Caruana" },
    { tournamentId: "stlcc-sinquefield-2025", name: "Sinquefield Cup 2025", date: "2025-08-31", format: "Round Robin", playerCount: 10, rounds: 9, status: "completed", winnerName: "GM Magnus Carlsen" },
    { tournamentId: "stlcc-spring-open-2026", name: "Spring Open 2026", date: "2026-04-12", format: "Swiss", playerCount: 0, rounds: 9, status: "upcoming" },
    { tournamentId: "stlcc-rapid-2026", name: "Club Rapid Championship 2026", date: "2026-03-08", format: "Swiss", playerCount: 72, rounds: 7, status: "completed", winnerName: "IM Joshua Ruiz" },
  ],
  // Charlotte Chess Center
  [
    { tournamentId: "ccc-sunday-quads-apr-2026", name: "Sunday Action Quads April", date: "2026-04-06", format: "Swiss", playerCount: 0, rounds: 3, status: "upcoming" },
    { tournamentId: "ccc-adult-casual-apr-2026", name: "Monday Adult Casual April", date: "2026-04-07", format: "Swiss", playerCount: 0, rounds: 4, status: "upcoming" },
    { tournamentId: "ccc-open-2026", name: "CCC Spring Open 2026", date: "2026-03-29", format: "Swiss", playerCount: 88, rounds: 6, status: "completed", winnerName: "FM Eric Yuhan Li" },
    { tournamentId: "ccc-youth-2025", name: "Youth Championship 2025", date: "2025-11-23", format: "Swiss", playerCount: 64, rounds: 6, status: "completed", winnerName: "Aiden Park" },
  ],
];

const SEED_KEY = "otb-clubs-seeded-v2";

/** Seed mock clubs into localStorage if not already done. */
export function seedClubsIfEmpty(): void {
  try {
    if (localStorage.getItem(SEED_KEY)) return;
    const existingClubs = loadClubs();
    if (existingClubs.length > 0) {
      localStorage.setItem(SEED_KEY, "1");
      return;
    }

    const clubs: Club[] = SEED_CLUBS.map((c, i) => ({
      ...c,
      id: `seed-club-${i + 1}`,
      slug: slugify(c.name),
      memberCount: SEED_MEMBER_COUNTS[i],
      tournamentCount: SEED_TOURNAMENT_COUNTS[i],
      followerCount: 0,
      foundedAt: SEED_FOUNDED_DATES[i],
    }));
    saveClubs(clubs);

    const allMembers: ClubMember[] = [];
    clubs.forEach((club, i) => {
      SEED_MEMBERS_PER_CLUB[i].forEach((m) => {
        allMembers.push({ ...m, clubId: club.id });
      });
    });
    saveMembers(allMembers);

    const allTournaments: ClubTournament[] = [];
    clubs.forEach((club, i) => {
      SEED_TOURNAMENTS[i].forEach((t) => {
        allTournaments.push({ ...t, clubId: club.id });
      });
    });
    saveClubTournaments(allTournaments);

    localStorage.setItem(SEED_KEY, "1");
  } catch { /* ignore */ }
}

// ── Demo member seeder ────────────────────────────────────────────────────────
// Real chess.com profiles fetched 2026-03-23. Avatars are served through the
// /api/avatar-proxy endpoint to avoid CORS issues in canvas-based exports.

const DEMO_CHESS_PLAYERS: Array<{
  userId: string;
  displayName: string;
  chesscomUsername: string;
  avatarUrl: string | null;
  title: string | null;
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
  country: string | null;
}> = [
  { userId: "demo_magnuscarlsen", displayName: "Magnus Carlsen", chesscomUsername: "magnuscarlsen", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/3889224.121e2094.200x200o.361c2f8a59c2.jpg", title: "GM", rapid: 2941, blitz: 3365, bullet: 3208, country: "NO" },
  { userId: "demo_hikaru", displayName: "Hikaru Nakamura", chesscomUsername: "hikaru", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png", title: "GM", rapid: 2839, blitz: 3400, bullet: 3299, country: "US" },
  { userId: "demo_nemsko", displayName: "Nemo Zhou", chesscomUsername: "nemsko", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/37482410.707242c2.200x200o.926c591d80d8.png", title: "WGM", rapid: 2114, blitz: 2282, bullet: 2591, country: "FI" },
  { userId: "demo_alexandrabotez", displayName: "Alexandra Botez", chesscomUsername: "alexandrabotez", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/28583276.401697ff.200x200o.152b758db93a.jpg", title: "WFM", rapid: 2320, blitz: 2255, bullet: 2271, country: "US" },
  { userId: "demo_fabianocaruana", displayName: "Fabiano Caruana", chesscomUsername: "fabianocaruana", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/11177810.9dfc8d31.200x200o.9a9eccebc07c.png", title: "GM", rapid: 2766, blitz: 3213, bullet: 3117, country: "US" },
  { userId: "demo_firouzja2003", displayName: "Alireza Firouzja", chesscomUsername: "firouzja2003", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/42022994.2c7a0722.200x200o.3088f5180d8d.jpg", title: "GM", rapid: 2844, blitz: 3277, bullet: 3301, country: "FR" },
  { userId: "demo_gmwso", displayName: "Wesley So", chesscomUsername: "gmwso", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/30366824.22d6b1f8.200x200o.bf8ce3f933fc.jpg", title: "GM", rapid: 2799, blitz: 3240, bullet: 3140, country: "US" },
  { userId: "demo_gukeshdommaraju", displayName: "Gukesh D", chesscomUsername: "gukeshdommaraju", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/40996222.a634fe54.200x200o.391c8e0a4b0b.jpeg", title: "GM", rapid: 2709, blitz: 3080, bullet: 3075, country: "IN" },
  { userId: "demo_annacramling", displayName: "Anna Cramling", chesscomUsername: "annacramling", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/70349336.09d03b0c.200x200o.a5160d80bcc3.jpg", title: "WFM", rapid: 2278, blitz: 2352, bullet: 2300, country: "SE" },
  { userId: "demo_rpragchess", displayName: "Praggnanandhaa R", chesscomUsername: "rpragchess", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/28692936.02da0bac.200x200o.d0b1b8f66ac2.jpg", title: "GM", rapid: 2711, blitz: 3278, bullet: 3201, country: "IN" },
  { userId: "demo_lordillidan", displayName: "Richard Rapport", chesscomUsername: "lordillidan", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/33637219.19524502.200x200o.91796e352906.jpeg", title: "GM", rapid: 2744, blitz: 3033, bullet: 3047, country: "HU" },
  { userId: "demo_ghandeevam2003", displayName: "Arjun Erigaisi", chesscomUsername: "ghandeevam2003", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/20718020.b93b0dad.200x200o.ce63c2b5ea24.jpeg", title: "GM", rapid: 2802, blitz: 3248, bullet: 3208, country: "IN" },
  { userId: "demo_gothamchess", displayName: "Levy Rozman", chesscomUsername: "gothamchess", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/33945736.eb0c3771.200x200o.cf06060d2143.png", title: "IM", rapid: 2453, blitz: 2998, bullet: 2961, country: "ES" },
  { userId: "demo_alexbanzea", displayName: "Alexandru Banzea", chesscomUsername: "alex_banzea", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/15671802.ae871a55.200x200o.e9db1df56a80.jpg", title: "IM", rapid: 2044, blitz: 2534, bullet: 2503, country: "RO" },
  { userId: "demo_gmcanty", displayName: "James Canty", chesscomUsername: "gmcanty", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/17123334.6c6fa923.200x200o.c744c8640149.jpeg", title: "FM", rapid: 2457, blitz: 2636, bullet: 2736, country: "US" },
  { userId: "demo_dinabelenkaya", displayName: "Dina Belenkaya", chesscomUsername: "dinabelenkaya", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/43773514.c36a7d0a.200x200o.efe9bb1e5cb9.jpg", title: "WGM", rapid: 2059, blitz: 2600, bullet: 2243, country: "FR" },
  { userId: "demo_pircuhset", displayName: "Adrian", chesscomUsername: "pircuhset", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/301889135.727553a0.200x200o.e4008c567009.jpg", title: null, rapid: 896, blitz: 1143, bullet: 702, country: "US" },
  { userId: "demo_arnoldadri", displayName: "Arnold", chesscomUsername: "arnoldadri", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/313129343.40b21d18.200x200o.cf9b1bc77ae5.png", title: null, rapid: 1520, blitz: 1212, bullet: 1026, country: "US" },
];

/**
 * Seed the 18 demo chess.com players as members of a given club.
 * Safe to call multiple times — skips players already in the club.
 * Returns the number of newly added members.
 */
export function seedDemoMembersToClub(clubId: string): number {
  const members = loadMembers();
  const newMembers: ClubMember[] = [];

  // Staggered join dates over the last 18 months for realism
  const now = Date.now();
  const msPerDay = 86_400_000;

  DEMO_CHESS_PLAYERS.forEach((p, i) => {
    if (members.some((m) => m.clubId === clubId && m.userId === p.userId)) return;
    const daysAgo = Math.round((i / DEMO_CHESS_PLAYERS.length) * 540);
    const joinedAt = new Date(now - daysAgo * msPerDay).toISOString();
    const elo = p.rapid ?? p.blitz ?? p.bullet ?? 1200;
    const tournamentsPlayed = elo >= 2700 ? 12 + (i % 8) : elo >= 2000 ? 5 + (i % 7) : 2 + (i % 4);
    const bestFinish = elo >= 2700 ? 1 + (i % 3) : elo >= 2000 ? 2 + (i % 4) : 3 + (i % 6);

    newMembers.push({
      clubId,
      userId: p.userId,
      displayName: p.displayName,
      chesscomUsername: p.chesscomUsername,
      lichessUsername: null,
      avatarUrl: p.avatarUrl,
      role: "member",
      joinedAt,
      tournamentsPlayed,
      bestFinish,
    });
  });

  if (newMembers.length === 0) return 0;

  saveMembers([...members, ...newMembers]);

  // Update memberCount
  const clubs = loadClubs();
  const totalForClub = [...members, ...newMembers].filter((m) => m.clubId === clubId).length;
  saveClubs(clubs.map((c) => c.id === clubId ? { ...c, memberCount: totalForClub } : c));

  return newMembers.length;
}
