/*
 * OTB Chess — Tournament Mock Data
 * Simulates a live 8-player Swiss tournament (4 rounds)
 * Round 4 is "in progress" to demonstrate the live state
 */

export type Result = "1-0" | "0-1" | "½-½" | "*";

export interface Player {
  id: string;
  name: string;
  username: string;
  elo: number;
  title?: "GM" | "IM" | "FM" | "CM" | "NM";
  country: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  buchholz: number;
  colorHistory: ("W" | "B")[];
}

export interface Game {
  id: string;
  round: number;
  board: number;
  whiteId: string;
  blackId: string;
  result: Result;
  duration?: string; // e.g. "42 moves"
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

// ─── Players ─────────────────────────────────────────────────────────────────
const PLAYERS: Player[] = [
  { id: "p1", name: "Magnus Eriksson",  username: "magnuserik",  elo: 2241, title: "FM", country: "SE", points: 3.5, wins: 3, draws: 1, losses: 0, buchholz: 8.0, colorHistory: ["W","B","W"] },
  { id: "p2", name: "Aisha Okonkwo",    username: "aishachess",  elo: 2108, title: "NM", country: "NG", points: 2.5, wins: 2, draws: 1, losses: 1, buchholz: 7.0, colorHistory: ["B","W","B"] },
  { id: "p3", name: "Rafael Montoya",   username: "rafaelotb",   elo: 1987,              country: "MX", points: 2.5, wins: 2, draws: 1, losses: 1, buchholz: 6.5, colorHistory: ["W","B","W"] },
  { id: "p4", name: "Yuki Tanaka",      username: "yukichess",   elo: 1954,              country: "JP", points: 2.0, wins: 2, draws: 0, losses: 1, buchholz: 6.0, colorHistory: ["B","W","B"] },
  { id: "p5", name: "Dmitri Volkov",    username: "dmitrivolkov",elo: 1923,              country: "RU", points: 1.5, wins: 1, draws: 1, losses: 2, buchholz: 5.5, colorHistory: ["W","B","B"] },
  { id: "p6", name: "Priya Sharma",     username: "priyachess",  elo: 1876,              country: "IN", points: 1.5, wins: 1, draws: 1, losses: 2, buchholz: 5.0, colorHistory: ["B","W","W"] },
  { id: "p7", name: "James O'Brien",    username: "jamesobrien", elo: 1812,              country: "IE", points: 1.0, wins: 1, draws: 0, losses: 3, buchholz: 4.5, colorHistory: ["W","B","W"] },
  { id: "p8", name: "Lena Hoffmann",    username: "lenahoff",    elo: 1754,              country: "DE", points: 0.5, wins: 0, draws: 1, losses: 3, buchholz: 3.5, colorHistory: ["B","W","B"] },
];

// ─── Round Data ───────────────────────────────────────────────────────────────
const ROUNDS: Round[] = [
  {
    number: 1,
    status: "completed",
    games: [
      { id: "g1",  round: 1, board: 1, whiteId: "p1", blackId: "p2", result: "1-0",  duration: "38 moves" },
      { id: "g2",  round: 1, board: 2, whiteId: "p3", blackId: "p4", result: "½-½",  duration: "52 moves" },
      { id: "g3",  round: 1, board: 3, whiteId: "p5", blackId: "p6", result: "0-1",  duration: "29 moves" },
      { id: "g4",  round: 1, board: 4, whiteId: "p7", blackId: "p8", result: "1-0",  duration: "44 moves" },
    ],
  },
  {
    number: 2,
    status: "completed",
    games: [
      { id: "g5",  round: 2, board: 1, whiteId: "p1", blackId: "p3", result: "1-0",  duration: "61 moves" },
      { id: "g6",  round: 2, board: 2, whiteId: "p4", blackId: "p2", result: "0-1",  duration: "33 moves" },
      { id: "g7",  round: 2, board: 3, whiteId: "p6", blackId: "p7", result: "½-½",  duration: "47 moves" },
      { id: "g8",  round: 2, board: 4, whiteId: "p8", blackId: "p5", result: "0-1",  duration: "25 moves" },
    ],
  },
  {
    number: 3,
    status: "completed",
    games: [
      { id: "g9",  round: 3, board: 1, whiteId: "p2", blackId: "p1", result: "½-½",  duration: "72 moves" },
      { id: "g10", round: 3, board: 2, whiteId: "p3", blackId: "p4", result: "1-0",  duration: "41 moves" },
      { id: "g11", round: 3, board: 3, whiteId: "p5", blackId: "p7", result: "1-0",  duration: "36 moves" },
      { id: "g12", round: 3, board: 4, whiteId: "p8", blackId: "p6", result: "½-½",  duration: "58 moves" },
    ],
  },
  {
    number: 4,
    status: "in_progress",
    games: [
      { id: "g13", round: 4, board: 1, whiteId: "p1", blackId: "p3", result: "*" },
      { id: "g14", round: 4, board: 2, whiteId: "p2", blackId: "p4", result: "*" },
      { id: "g15", round: 4, board: 3, whiteId: "p5", blackId: "p6", result: "*" },
      { id: "g16", round: 4, board: 4, whiteId: "p7", blackId: "p8", result: "*" },
    ],
  },
];

// ─── Tournament ───────────────────────────────────────────────────────────────
export const DEMO_TOURNAMENT: Tournament = {
  id: "otb-demo-2026",
  name: "NYC Chess Society — Spring Open 2026",
  format: "Swiss",
  rounds: 5,
  timeControl: "90+30",
  venue: "The Marshall Chess Club, New York",
  date: "Feb 21, 2026",
  status: "in_progress",
  currentRound: 4,
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
  SE: "🇸🇪", NG: "🇳🇬", MX: "🇲🇽", JP: "🇯🇵",
  RU: "🇷🇺", IN: "🇮🇳", IE: "🇮🇪", DE: "🇩🇪",
};
