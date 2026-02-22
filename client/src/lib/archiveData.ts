// OTB Chess — Tournament Archive Mock Data
// Design: Apple-minimalist, chess.com green/white, Clash Display + Inter

export type TitleBadge = "GM" | "IM" | "FM" | "NM" | "CM" | null;
export type TournamentFormat = "Swiss" | "Round Robin" | "Elimination";
export type TournamentStatus = "completed" | "ongoing" | "upcoming";

export interface ArchivePlayer {
  id: string;
  name: string;
  username: string;
  elo: number;
  title: TitleBadge;
  country: string;
  countryCode: string;
  score: number;
  buchholz: number;
  wins: number;
  draws: number;
  losses: number;
  rank: number;
  performanceRating: number;
}

export interface ArchiveTournament {
  id: string;
  name: string;
  slug: string;
  club: string;
  venue: string;
  city: string;
  date: string;
  endDate: string;
  format: TournamentFormat;
  rounds: number;
  timeControl: string;
  ratingSystem: "chess.com" | "Lichess" | "FIDE" | "Unrated";
  status: TournamentStatus;
  playerCount: number;
  standings: ArchivePlayer[];
  tags: string[];
  description: string;
  avgElo: number;
  topElo: number;
}

// ── Archive Data ─────────────────────────────────────────────────────────────

export const ARCHIVE_TOURNAMENTS: ArchiveTournament[] = [
  {
    id: "arc-001",
    name: "Central Park Open 2026",
    slug: "central-park-open-2026",
    club: "Manhattan Chess Club",
    venue: "Central Park Pavilion",
    city: "New York, NY",
    date: "Jan 18, 2026",
    endDate: "Jan 18, 2026",
    format: "Swiss",
    rounds: 5,
    timeControl: "G/25+5",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 24,
    avgElo: 1487,
    topElo: 2241,
    tags: ["Open", "Rapid", "Rated"],
    description: "The flagship winter rapid open hosted by the Manhattan Chess Club in Central Park.",
    standings: [
      { id: "p1", name: "Magnus Eriksson", username: "magnuserik", elo: 2241, title: "FM", country: "Sweden", countryCode: "SE", score: 5.0, buchholz: 16.5, wins: 5, draws: 0, losses: 0, rank: 1, performanceRating: 2389 },
      { id: "p2", name: "Priya Nair", username: "priya_chess", elo: 1980, title: "NM", country: "India", countryCode: "IN", score: 4.0, buchholz: 15.0, wins: 4, draws: 0, losses: 1, rank: 2, performanceRating: 2102 },
      { id: "p3", name: "Carlos Mendez", username: "carlosmendez", elo: 1854, title: null, country: "Mexico", countryCode: "MX", score: 3.5, buchholz: 14.5, wins: 3, draws: 1, losses: 1, rank: 3, performanceRating: 1921 },
      { id: "p4", name: "Yuki Tanaka", username: "yukitanaka88", elo: 1743, title: null, country: "Japan", countryCode: "JP", score: 3.0, buchholz: 13.0, wins: 3, draws: 0, losses: 2, rank: 4, performanceRating: 1810 },
      { id: "p5", name: "Amara Osei", username: "amaraosei", elo: 1621, title: null, country: "Ghana", countryCode: "GH", score: 2.5, buchholz: 12.5, wins: 2, draws: 1, losses: 2, rank: 5, performanceRating: 1698 },
      { id: "p6", name: "Elena Volkov", username: "elenavolkov", elo: 1589, title: null, country: "Russia", countryCode: "RU", score: 2.0, buchholz: 11.0, wins: 2, draws: 0, losses: 3, rank: 6, performanceRating: 1612 },
    ],
  },
  {
    id: "arc-002",
    name: "Brooklyn Blitz Championship",
    slug: "brooklyn-blitz-2025",
    club: "Brooklyn Chess Society",
    venue: "DUMBO Arts Center",
    city: "Brooklyn, NY",
    date: "Dec 7, 2025",
    endDate: "Dec 7, 2025",
    format: "Swiss",
    rounds: 7,
    timeControl: "3+2 Blitz",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 32,
    avgElo: 1312,
    topElo: 1987,
    tags: ["Blitz", "Club Championship", "Rated"],
    description: "Annual blitz championship of the Brooklyn Chess Society. Fast-paced and competitive.",
    standings: [
      { id: "p7", name: "Jordan Kim", username: "jordankim_chess", elo: 1987, title: "NM", country: "USA", countryCode: "US", score: 6.5, buchholz: 22.0, wins: 6, draws: 1, losses: 0, rank: 1, performanceRating: 2134 },
      { id: "p8", name: "Fatima Al-Hassan", username: "fatimachess", elo: 1801, title: null, country: "UAE", countryCode: "AE", score: 6.0, buchholz: 21.5, wins: 6, draws: 0, losses: 1, rank: 2, performanceRating: 1978 },
      { id: "p9", name: "Dmitri Petrov", username: "dpetrov99", elo: 1756, title: null, country: "Bulgaria", countryCode: "BG", score: 5.5, buchholz: 20.0, wins: 5, draws: 1, losses: 1, rank: 3, performanceRating: 1843 },
      { id: "p10", name: "Sofia Reyes", username: "sofiachess", elo: 1634, title: null, country: "Spain", countryCode: "ES", score: 5.0, buchholz: 19.5, wins: 5, draws: 0, losses: 2, rank: 4, performanceRating: 1712 },
      { id: "p11", name: "Kwame Asante", username: "kwameasante", elo: 1498, title: null, country: "Ghana", countryCode: "GH", score: 4.5, buchholz: 18.0, wins: 4, draws: 1, losses: 2, rank: 5, performanceRating: 1589 },
      { id: "p12", name: "Mei Lin", username: "meilinchess", elo: 1423, title: null, country: "China", countryCode: "CN", score: 4.0, buchholz: 17.0, wins: 4, draws: 0, losses: 3, rank: 6, performanceRating: 1501 },
    ],
  },
  {
    id: "arc-003",
    name: "Queens Invitational Classic",
    slug: "queens-invitational-2025",
    club: "Queens Chess Guild",
    venue: "Flushing Library",
    city: "Queens, NY",
    date: "Nov 15, 2025",
    endDate: "Nov 15, 2025",
    format: "Round Robin",
    rounds: 6,
    timeControl: "G/60+10",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 7,
    avgElo: 1876,
    topElo: 2198,
    tags: ["Invitational", "Classical", "Closed"],
    description: "An elite invitational round-robin for top-rated players in the Queens Chess Guild.",
    standings: [
      { id: "p13", name: "Arjun Sharma", username: "arjunsharma_gm", elo: 2198, title: "IM", country: "India", countryCode: "IN", score: 5.0, buchholz: 0, wins: 5, draws: 0, losses: 1, rank: 1, performanceRating: 2287 },
      { id: "p14", name: "Natalia Kozlov", username: "nataliakozlov", elo: 2087, title: "FM", country: "Ukraine", countryCode: "UA", score: 4.5, buchholz: 0, wins: 4, draws: 1, losses: 1, rank: 2, performanceRating: 2156 },
      { id: "p15", name: "Ben Okafor", username: "benokafor", elo: 1934, title: "NM", country: "Nigeria", countryCode: "NG", score: 3.5, buchholz: 0, wins: 3, draws: 1, losses: 2, rank: 3, performanceRating: 1998 },
      { id: "p16", name: "Lena Fischer", username: "lenafischer", elo: 1876, title: null, country: "Germany", countryCode: "DE", score: 3.0, buchholz: 0, wins: 3, draws: 0, losses: 3, rank: 4, performanceRating: 1901 },
      { id: "p17", name: "Tomás Novak", username: "tomasnovak", elo: 1812, title: null, country: "Czech Republic", countryCode: "CZ", score: 2.5, buchholz: 0, wins: 2, draws: 1, losses: 3, rank: 5, performanceRating: 1834 },
      { id: "p18", name: "Aiko Yamamoto", username: "aikoyamamoto", elo: 1743, title: null, country: "Japan", countryCode: "JP", score: 1.5, buchholz: 0, wins: 1, draws: 1, losses: 4, rank: 6, performanceRating: 1712 },
    ],
  },
  {
    id: "arc-004",
    name: "Harlem Chess Festival Open",
    slug: "harlem-chess-festival-2025",
    club: "Harlem Chess Academy",
    venue: "Marcus Garvey Park",
    city: "New York, NY",
    date: "Sep 20, 2025",
    endDate: "Sep 21, 2025",
    format: "Swiss",
    rounds: 6,
    timeControl: "G/30+5",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 48,
    avgElo: 1198,
    topElo: 1923,
    tags: ["Open", "Rapid", "Community", "Multi-day"],
    description: "A community festival tournament open to all skill levels. Largest OTB event of the fall season.",
    standings: [
      { id: "p19", name: "Marcus Webb", username: "marcuswebb", elo: 1923, title: "NM", country: "USA", countryCode: "US", score: 6.0, buchholz: 19.0, wins: 6, draws: 0, losses: 0, rank: 1, performanceRating: 2089 },
      { id: "p20", name: "Zara Ahmed", username: "zaraahmed_chess", elo: 1745, title: null, country: "Pakistan", countryCode: "PK", score: 5.0, buchholz: 17.5, wins: 5, draws: 0, losses: 1, rank: 2, performanceRating: 1867 },
      { id: "p21", name: "Leo Fontaine", username: "leofontaine", elo: 1612, title: null, country: "France", countryCode: "FR", score: 4.5, buchholz: 16.0, wins: 4, draws: 1, losses: 1, rank: 3, performanceRating: 1723 },
      { id: "p22", name: "Riya Patel", username: "riyapatel", elo: 1534, title: null, country: "India", countryCode: "IN", score: 4.0, buchholz: 15.5, wins: 4, draws: 0, losses: 2, rank: 4, performanceRating: 1645 },
      { id: "p23", name: "Oluwaseun Adeyemi", username: "seunchess", elo: 1421, title: null, country: "Nigeria", countryCode: "NG", score: 3.5, buchholz: 14.0, wins: 3, draws: 1, losses: 2, rank: 5, performanceRating: 1534 },
      { id: "p24", name: "Hana Müller", username: "hanamuller", elo: 1389, title: null, country: "Austria", countryCode: "AT", score: 3.0, buchholz: 13.5, wins: 3, draws: 0, losses: 3, rank: 6, performanceRating: 1456 },
    ],
  },
  {
    id: "arc-005",
    name: "Bronx Summer Rapid",
    slug: "bronx-summer-rapid-2025",
    club: "Bronx Chess Club",
    venue: "Pelham Bay Park Rec Center",
    city: "Bronx, NY",
    date: "Jul 12, 2025",
    endDate: "Jul 12, 2025",
    format: "Swiss",
    rounds: 5,
    timeControl: "G/15+10",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 18,
    avgElo: 1356,
    topElo: 1789,
    tags: ["Rapid", "Summer", "Casual"],
    description: "A casual summer rapid to kick off the Bronx Chess Club's outdoor season.",
    standings: [
      { id: "p25", name: "Isabelle Laurent", username: "isabellelaurent", elo: 1789, title: null, country: "France", countryCode: "FR", score: 5.0, buchholz: 14.0, wins: 5, draws: 0, losses: 0, rank: 1, performanceRating: 1934 },
      { id: "p26", name: "Tariq Hassan", username: "tariqhassan", elo: 1654, title: null, country: "Egypt", countryCode: "EG", score: 4.0, buchholz: 12.5, wins: 4, draws: 0, losses: 1, rank: 2, performanceRating: 1756 },
      { id: "p27", name: "Chloe Park", username: "chloepark_chess", elo: 1543, title: null, country: "South Korea", countryCode: "KR", score: 3.5, buchholz: 11.5, wins: 3, draws: 1, losses: 1, rank: 3, performanceRating: 1634 },
      { id: "p28", name: "Emeka Obi", username: "emekaobi", elo: 1412, title: null, country: "Nigeria", countryCode: "NG", score: 3.0, buchholz: 10.5, wins: 3, draws: 0, losses: 2, rank: 4, performanceRating: 1489 },
      { id: "p29", name: "Nadia Popescu", username: "nadiapopescu", elo: 1321, title: null, country: "Romania", countryCode: "RO", score: 2.5, buchholz: 9.5, wins: 2, draws: 1, losses: 2, rank: 5, performanceRating: 1398 },
      { id: "p30", name: "Sven Larsson", username: "svenlarsson", elo: 1287, title: null, country: "Sweden", countryCode: "SE", score: 2.0, buchholz: 9.0, wins: 2, draws: 0, losses: 3, rank: 6, performanceRating: 1345 },
    ],
  },
  {
    id: "arc-006",
    name: "Staten Island Club Championship",
    slug: "staten-island-championship-2025",
    club: "Staten Island Chess League",
    venue: "Snug Harbor Cultural Center",
    city: "Staten Island, NY",
    date: "May 3, 2025",
    endDate: "May 3, 2025",
    format: "Swiss",
    rounds: 5,
    timeControl: "G/45+5",
    ratingSystem: "chess.com",
    status: "completed",
    playerCount: 14,
    avgElo: 1445,
    topElo: 1876,
    tags: ["Club Championship", "Rapid", "Rated"],
    description: "The annual Staten Island Chess League club championship.",
    standings: [
      { id: "p31", name: "Viktor Sorokin", username: "viktorsorokin", elo: 1876, title: null, country: "Russia", countryCode: "RU", score: 5.0, buchholz: 13.5, wins: 5, draws: 0, losses: 0, rank: 1, performanceRating: 2012 },
      { id: "p32", name: "Amelia Chen", username: "ameliachen", elo: 1712, title: null, country: "USA", countryCode: "US", score: 4.0, buchholz: 12.0, wins: 4, draws: 0, losses: 1, rank: 2, performanceRating: 1823 },
      { id: "p33", name: "Rashid Okonkwo", username: "rashidokonkwo", elo: 1634, title: null, country: "Nigeria", countryCode: "NG", score: 3.5, buchholz: 11.5, wins: 3, draws: 1, losses: 1, rank: 3, performanceRating: 1712 },
      { id: "p34", name: "Ingrid Holm", username: "ingridholm", elo: 1521, title: null, country: "Norway", countryCode: "NO", score: 3.0, buchholz: 10.5, wins: 3, draws: 0, losses: 2, rank: 4, performanceRating: 1589 },
      { id: "p35", name: "Darius Blackwood", username: "dariusblackwood", elo: 1456, title: null, country: "USA", countryCode: "US", score: 2.5, buchholz: 9.5, wins: 2, draws: 1, losses: 2, rank: 5, performanceRating: 1512 },
      { id: "p36", name: "Yuna Kim", username: "yunakimchess", elo: 1389, title: null, country: "South Korea", countryCode: "KR", score: 2.0, buchholz: 9.0, wins: 2, draws: 0, losses: 3, rank: 6, performanceRating: 1423 },
    ],
  },
];

export const ARCHIVE_STATS = {
  totalTournaments: ARCHIVE_TOURNAMENTS.length,
  totalPlayers: ARCHIVE_TOURNAMENTS.reduce((sum, t) => sum + t.playerCount, 0),
  totalGames: ARCHIVE_TOURNAMENTS.reduce((sum, t) => sum + Math.floor(t.playerCount * t.rounds / 2), 0),
  totalClubs: new Set(ARCHIVE_TOURNAMENTS.map((t) => t.club)).size,
};
