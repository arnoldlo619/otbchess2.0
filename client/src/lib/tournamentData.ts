/*
 * OTB Chess — Tournament Mock Data
 * 18 real chess.com players, 5-round Swiss
 * Rounds 1–4 completed, Round 5 in progress
 */

export type Result = "1-0" | "0-1" | "½-½" | "*";

export interface Player {
  id: string;
  name: string;
  username: string;
  /** Active ELO used for pairings (rapid or blitz, depending on tournament ratingType) */
  elo: number;
  /** chess.com Rapid rating (stored separately so directors can switch rating type) */
  rapidElo?: number;
  /** chess.com Blitz rating (stored separately so directors can switch rating type) */
  blitzElo?: number;
  title?: "GM" | "IM" | "WGM" | "WIM" | "FM" | "WFM" | "CM" | "NM";
  country: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  buchholz: number;
  colorHistory: ("W" | "B")[];
  joinedAt?: number;
  platform?: "chesscom" | "lichess";
  avatarUrl?: string;
  flairEmoji?: string;
  phone?: string;
  email?: string;
}

export interface Game {
  id: string;
  round: number;
  board: number;
  whiteId: string;
  blackId: string;
  result: Result;
  duration?: string;
  gameIndex?: 0 | 1;
}

export interface Round {
  number: number;
  status: "completed" | "in_progress" | "upcoming";
  games: Game[];
}

export interface Tournament {
  id: string;
  name: string;
  format: "Swiss";
  rounds: number;
  timeControl: string;
  venue: string;
  date: string;
  status: "in_progress";
  currentRound: number;
  players: Player[];
  roundData: Round[];
}

// ─── Players ──────────────────────────────────────────────────────────────────
const PLAYERS: Player[] = [
  { id: "p1",  name: "Magnus Carlsen",      username: "Magnuscarlsen",   platform: "chesscom", elo: 2882, title: "GM",  country: "NO", points: 4.0, wins: 4, draws: 0, losses: 0, buchholz: 12.0, colorHistory: ["W","B","W","W"] },
  { id: "p2",  name: "Hikaru Nakamura",     username: "Hikaru",          platform: "chesscom", elo: 2794, title: "GM",  country: "US", points: 3.5, wins: 3, draws: 1, losses: 0, buchholz: 11.5, colorHistory: ["B","W","B","W"] },
  { id: "p3",  name: "Fabiano Caruana",     username: "Fabianocaruana",  platform: "chesscom", elo: 2786, title: "GM",  country: "US", points: 3.5, wins: 3, draws: 1, losses: 0, buchholz: 11.0, colorHistory: ["W","B","W","B"] },
  { id: "p4",  name: "Alireza Firouzja",    username: "Firouzja2003",    platform: "chesscom", elo: 2760, title: "GM",  country: "FR", points: 3.0, wins: 3, draws: 0, losses: 1, buchholz: 10.5, colorHistory: ["B","W","B","W"] },
  { id: "p5",  name: "Gukesh D.",           username: "GukeshDommaraju", platform: "chesscom", elo: 2758, title: "GM",  country: "IN", points: 3.0, wins: 3, draws: 0, losses: 1, buchholz: 10.0, colorHistory: ["W","B","W","B"] },
  { id: "p6",  name: "R. Praggnanandhaa",   username: "rpragchess",      platform: "chesscom", elo: 2747, title: "GM",  country: "IN", points: 3.0, wins: 2, draws: 2, losses: 0, buchholz: 10.5, colorHistory: ["B","W","B","W"] },
  { id: "p7",  name: "Wesley So",           username: "GMWSO",           platform: "chesscom", elo: 2720, title: "GM",  country: "US", points: 2.5, wins: 2, draws: 1, losses: 1, buchholz: 9.5,  colorHistory: ["W","B","W","B"] },
  { id: "p8",  name: "Levy Rozman",         username: "Gothamchess",     platform: "chesscom", elo: 2700, title: "IM",  country: "US", points: 2.5, wins: 2, draws: 1, losses: 1, buchholz: 9.0,  colorHistory: ["B","W","B","W"] },
  { id: "p9",  name: "Arjun Erigaisi",      username: "GHANDEEVAM2003",  platform: "chesscom", elo: 2695, title: "GM",  country: "IN", points: 2.5, wins: 2, draws: 1, losses: 1, buchholz: 8.5,  colorHistory: ["W","B","W","B"] },
  { id: "p10", name: "Alex Banzea",         username: "Alex_Banzea",     platform: "chesscom", elo: 2650, title: "GM",  country: "RO", points: 2.0, wins: 2, draws: 0, losses: 2, buchholz: 8.0,  colorHistory: ["B","W","B","W"] },
  { id: "p11", name: "Canty",               username: "GMCANTY",         platform: "chesscom", elo: 2630, title: "GM",  country: "AU", points: 2.0, wins: 2, draws: 0, losses: 2, buchholz: 7.5,  colorHistory: ["W","B","W","B"] },
  { id: "p12", name: "Alexandra Botez",     username: "Alexandrabotez",  platform: "chesscom", elo: 1900, title: "WFM", country: "CA", points: 2.0, wins: 1, draws: 2, losses: 1, buchholz: 8.0,  colorHistory: ["B","W","B","W"] },
  { id: "p13", name: "Anna Cramling",       username: "Annacramling",    platform: "chesscom", elo: 2200, title: "WIM", country: "SE", points: 2.0, wins: 2, draws: 0, losses: 2, buchholz: 7.0,  colorHistory: ["W","B","W","B"] },
  { id: "p14", name: "Dina Belenkaya",      username: "DinaBelenkaya",   platform: "chesscom", elo: 2370, title: "WGM", country: "RU", points: 1.5, wins: 1, draws: 1, losses: 2, buchholz: 7.5,  colorHistory: ["B","W","B","W"] },
  { id: "p15", name: "Nemo",                username: "Nemsko",          platform: "chesscom", elo: 2100, title: "WFM", country: "CA", points: 1.5, wins: 1, draws: 1, losses: 2, buchholz: 7.0,  colorHistory: ["W","B","W","B"] },
  { id: "p16", name: "Illidan",             username: "Lordillidan",     platform: "chesscom", elo: 2580, title: "GM",  country: "MM", points: 1.0, wins: 1, draws: 0, losses: 3, buchholz: 6.5,  colorHistory: ["B","W","B","W"] },
  { id: "p17", name: "Pircuhset",           username: "Pircuhset",       platform: "chesscom", elo: 2450, title: "FM",  country: "ID", points: 1.0, wins: 1, draws: 0, losses: 3, buchholz: 6.0,  colorHistory: ["W","B","W","B"] },
  { id: "p18", name: "Arnold Adri",         username: "Arnoldadri",      platform: "chesscom", elo: 2320, title: "FM",  country: "ID", points: 0.5, wins: 0, draws: 1, losses: 3, buchholz: 5.5,  colorHistory: ["B","W","B","W"] },
];

// ─── Round Data ───────────────────────────────────────────────────────────────
const ROUNDS: Round[] = [
  {
    number: 1,
    status: "completed",
    games: [
      { id: "r1g1", round: 1, board: 1, whiteId: "p1",  blackId: "p18", result: "1-0",  duration: "38 moves" },
      { id: "r1g2", round: 1, board: 2, whiteId: "p17", blackId: "p2",  result: "0-1",  duration: "41 moves" },
      { id: "r1g3", round: 1, board: 3, whiteId: "p3",  blackId: "p16", result: "1-0",  duration: "29 moves" },
      { id: "r1g4", round: 1, board: 4, whiteId: "p15", blackId: "p4",  result: "0-1",  duration: "55 moves" },
      { id: "r1g5", round: 1, board: 5, whiteId: "p5",  blackId: "p14", result: "1-0",  duration: "33 moves" },
      { id: "r1g6", round: 1, board: 6, whiteId: "p13", blackId: "p6",  result: "½-½",  duration: "62 moves" },
      { id: "r1g7", round: 1, board: 7, whiteId: "p7",  blackId: "p12", result: "1-0",  duration: "47 moves" },
      { id: "r1g8", round: 1, board: 8, whiteId: "p11", blackId: "p8",  result: "0-1",  duration: "36 moves" },
      { id: "r1g9", round: 1, board: 9, whiteId: "p9",  blackId: "p10", result: "½-½",  duration: "58 moves" },
    ],
  },
  {
    number: 2,
    status: "completed",
    games: [
      { id: "r2g1", round: 2, board: 1, whiteId: "p2",  blackId: "p1",  result: "½-½",  duration: "72 moves" },
      { id: "r2g2", round: 2, board: 2, whiteId: "p4",  blackId: "p3",  result: "1-0",  duration: "44 moves" },
      { id: "r2g3", round: 2, board: 3, whiteId: "p6",  blackId: "p5",  result: "½-½",  duration: "51 moves" },
      { id: "r2g4", round: 2, board: 4, whiteId: "p8",  blackId: "p7",  result: "½-½",  duration: "39 moves" },
      { id: "r2g5", round: 2, board: 5, whiteId: "p9",  blackId: "p10", result: "1-0",  duration: "28 moves" },
      { id: "r2g6", round: 2, board: 6, whiteId: "p11", blackId: "p12", result: "0-1",  duration: "43 moves" },
      { id: "r2g7", round: 2, board: 7, whiteId: "p13", blackId: "p14", result: "1-0",  duration: "35 moves" },
      { id: "r2g8", round: 2, board: 8, whiteId: "p15", blackId: "p16", result: "1-0",  duration: "61 moves" },
      { id: "r2g9", round: 2, board: 9, whiteId: "p17", blackId: "p18", result: "1-0",  duration: "22 moves" },
    ],
  },
  {
    number: 3,
    status: "completed",
    games: [
      { id: "r3g1", round: 3, board: 1, whiteId: "p1",  blackId: "p6",  result: "1-0",  duration: "45 moves" },
      { id: "r3g2", round: 3, board: 2, whiteId: "p3",  blackId: "p2",  result: "½-½",  duration: "68 moves" },
      { id: "r3g3", round: 3, board: 3, whiteId: "p4",  blackId: "p5",  result: "0-1",  duration: "53 moves" },
      { id: "r3g4", round: 3, board: 4, whiteId: "p7",  blackId: "p9",  result: "1-0",  duration: "31 moves" },
      { id: "r3g5", round: 3, board: 5, whiteId: "p8",  blackId: "p12", result: "1-0",  duration: "40 moves" },
      { id: "r3g6", round: 3, board: 6, whiteId: "p10", blackId: "p11", result: "0-1",  duration: "27 moves" },
      { id: "r3g7", round: 3, board: 7, whiteId: "p13", blackId: "p15", result: "0-1",  duration: "49 moves" },
      { id: "r3g8", round: 3, board: 8, whiteId: "p14", blackId: "p16", result: "1-0",  duration: "37 moves" },
      { id: "r3g9", round: 3, board: 9, whiteId: "p18", blackId: "p17", result: "½-½",  duration: "55 moves" },
    ],
  },
  {
    number: 4,
    status: "completed",
    games: [
      { id: "r4g1", round: 4, board: 1, whiteId: "p1",  blackId: "p3",  result: "1-0",  duration: "57 moves" },
      { id: "r4g2", round: 4, board: 2, whiteId: "p2",  blackId: "p5",  result: "1-0",  duration: "44 moves" },
      { id: "r4g3", round: 4, board: 3, whiteId: "p6",  blackId: "p4",  result: "½-½",  duration: "71 moves" },
      { id: "r4g4", round: 4, board: 4, whiteId: "p7",  blackId: "p8",  result: "0-1",  duration: "33 moves" },
      { id: "r4g5", round: 4, board: 5, whiteId: "p9",  blackId: "p14", result: "1-0",  duration: "26 moves" },
      { id: "r4g6", round: 4, board: 6, whiteId: "p11", blackId: "p13", result: "1-0",  duration: "42 moves" },
      { id: "r4g7", round: 4, board: 7, whiteId: "p12", blackId: "p10", result: "½-½",  duration: "60 moves" },
      { id: "r4g8", round: 4, board: 8, whiteId: "p15", blackId: "p18", result: "0-1",  duration: "38 moves" },
      { id: "r4g9", round: 4, board: 9, whiteId: "p16", blackId: "p17", result: "0-1",  duration: "29 moves" },
    ],
  },
  {
    // Round 5 — in progress
    number: 5,
    status: "in_progress",
    games: [
      { id: "r5g1", round: 5, board: 1, whiteId: "p2",  blackId: "p1",  result: "*" },
      { id: "r5g2", round: 5, board: 2, whiteId: "p3",  blackId: "p6",  result: "*" },
      { id: "r5g3", round: 5, board: 3, whiteId: "p5",  blackId: "p4",  result: "*" },
      { id: "r5g4", round: 5, board: 4, whiteId: "p8",  blackId: "p9",  result: "*" },
      { id: "r5g5", round: 5, board: 5, whiteId: "p7",  blackId: "p11", result: "*" },
      { id: "r5g6", round: 5, board: 6, whiteId: "p12", blackId: "p13", result: "*" },
      { id: "r5g7", round: 5, board: 7, whiteId: "p10", blackId: "p14", result: "*" },
      { id: "r5g8", round: 5, board: 8, whiteId: "p18", blackId: "p15", result: "*" },
      { id: "r5g9", round: 5, board: 9, whiteId: "p17", blackId: "p16", result: "*" },
    ],
  },
];

// ─── Tournament ───────────────────────────────────────────────────────────────
export const DEMO_TOURNAMENT: Tournament = {
  id: "otb-demo-2026",
  name: "OTB!! Open 2026",
  format: "Swiss",
  rounds: 5,
  timeControl: "90+30",
  venue: "The Marshall Chess Club, New York",
  date: "Mar 22, 2026",
  status: "in_progress",
  currentRound: 5,
  players: PLAYERS,
  roundData: ROUNDS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function getStandings(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.elo - a.elo;
  });
}

export function getResultLabel(result: Result, perspective: "white" | "black"): {
  label: string;
  color: string;
} {
  if (result === "*") return { label: "In Progress", color: "text-amber-500" };
  if (result === "½-½") return { label: "½", color: "text-blue-500" };
  if (perspective === "white") {
    return result === "1-0"
      ? { label: "Win", color: "text-emerald-600" }
      : { label: "Loss", color: "text-red-500" };
  } else {
    return result === "0-1"
      ? { label: "Win", color: "text-emerald-600" }
      : { label: "Loss", color: "text-red-500" };
  }
}

export const FLAG_EMOJI: Record<string, string> = {
  NO: "🇳🇴", US: "🇺🇸", FR: "🇫🇷", IN: "🇮🇳",
  CA: "🇨🇦", SE: "🇸🇪", RU: "🇷🇺", AU: "🇦🇺",
  RO: "🇷🇴", MM: "🇲🇲", ID: "🇮🇩", GB: "🇬🇧",
  DE: "🇩🇪", ES: "🇪🇸", AR: "🇦🇷", NG: "🇳🇬",
  MX: "🇲🇽", JP: "🇯🇵", IE: "🇮🇪",
};
