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
];

const SEED_MEMBER_COUNTS = [142, 89, 34, 218, 67, 156];
const SEED_TOURNAMENT_COUNTS = [24, 18, 9, 31, 12, 22];
const SEED_FOUNDED_DATES = [
  "2024-01-15T10:00:00Z",
  "2024-06-01T10:00:00Z",
  "2024-09-01T10:00:00Z",
  "2023-11-01T10:00:00Z",
  "2024-02-01T10:00:00Z",
  "2023-08-01T10:00:00Z",
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
];

const SEED_KEY = "otb-clubs-seeded-v1";

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
