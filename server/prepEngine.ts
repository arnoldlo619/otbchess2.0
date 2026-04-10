/**
 * Matchup Prep Engine
 *
 * Fetches a chess.com player's recent games, classifies openings,
 * computes play-style statistics, and generates strategic preparation lines.
 *
 * Architecture:
 *   1. fetchPlayerGames() — pulls recent games from chess.com archives API
 *   2. classifyOpening()  — maps first N moves to a named opening via ECO-lite table
 *   3. analyzePlayStyle() — aggregates stats: opening repertoire, color preference,
 *                           endgame tendencies, tactical patterns
 *   4. generatePrepLines()— suggests counter-openings based on opponent weaknesses
 *   5. buildPrepReport()  — orchestrates the full pipeline into a PrepReport
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: "rapid" | "blitz" | "bullet" | "daily";
  rated: boolean;
  rules: string;
  end_time: number;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export interface OpeningInfo {
  eco: string;
  name: string;
  moves: string;
}

export interface OpeningStat {
  name: string;
  eco: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  /** The move sequence for this opening */
  moves: string;
}

export interface PlayStyleProfile {
  username: string;
  gamesAnalyzed: number;
  rating: { rapid: number | null; blitz: number | null; bullet: number | null };
  /** Overall W/D/L */
  overall: { wins: number; draws: number; losses: number; winRate: number };
  /** As white */
  asWhite: { wins: number; draws: number; losses: number; winRate: number; games: number };
  /** As black */
  asBlack: { wins: number; draws: number; losses: number; winRate: number; games: number };
  /** Top openings as white */
  whiteOpenings: OpeningStat[];
  /** Top openings as black */
  blackOpenings: OpeningStat[];
  /** How games end */
  endgameProfile: {
    checkmates: number;
    resignations: number;
    timeouts: number;
    draws: number;
    total: number;
  };
  /** First-move preferences */
  firstMoveAsWhite: { move: string; count: number; pct: number }[];
  /** Average game length (in full moves) */
  avgGameLength: number;
}

export interface PrepLine {
  /** The suggested opening/defense name */
  name: string;
  /** ECO code */
  eco: string;
  /** Move sequence */
  moves: string;
  /** Why this line is recommended */
  rationale: string;
  /** Confidence: how strong the recommendation is */
  confidence: "high" | "medium" | "low";
  /** Whether this is a main line or a surprise weapon */
  lineType?: "main" | "surprise";
}

export interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  /** Key insights as short sentences */
  insights: string[];
  generatedAt: string;
}

// ─── ECO Opening Book (compact) ──────────────────────────────────────────────
// Maps normalized first-N-move sequences to opening names.
// We use a compact table covering the most common 80+ openings.

interface EcoEntry { eco: string; name: string; moves: string }

const ECO_BOOK: EcoEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME A — Flank Openings, Irregular, Dutch, Benoni, Indian (non-1.e4)
  // ═══════════════════════════════════════════════════════════════════════════

  // A00 — Irregular / Uncommon
  { eco: "A00", name: "Grob Attack", moves: "1.g4" },
  { eco: "A00", name: "Sokolsky Opening", moves: "1.b4" },
  { eco: "A00", name: "Van't Kruijs Opening", moves: "1.e3" },
  { eco: "A00", name: "Saragossa Opening", moves: "1.c3" },
  { eco: "A00", name: "Mieses Opening", moves: "1.d3" },
  { eco: "A01", name: "Larsen's Opening", moves: "1.b3" },
  { eco: "A02", name: "Bird's Opening", moves: "1.f4" },
  { eco: "A03", name: "Bird's Opening: Dutch Variation", moves: "1.f4 d5" },

  // A04–A09 — Reti / King's Indian Attack
  { eco: "A04", name: "Reti Opening", moves: "1.Nf3 d5 2.c4" },
  { eco: "A05", name: "Reti Opening", moves: "1.Nf3 Nf6" },
  { eco: "A07", name: "King's Indian Attack", moves: "1.Nf3 d5 2.g3" },
  { eco: "A08", name: "King's Indian Attack", moves: "1.Nf3 d5 2.g3 c5 3.Bg2" },
  { eco: "A09", name: "Reti: Advance Variation", moves: "1.Nf3 d5 2.c4 d4" },

  // A10–A39 — English Opening
  { eco: "A10", name: "English Opening", moves: "1.c4" },
  { eco: "A13", name: "English: Agincourt Defense", moves: "1.c4 e6" },
  { eco: "A15", name: "English: Anglo-Indian", moves: "1.c4 Nf6 2.Nf3" },
  { eco: "A16", name: "English: Anglo-Indian", moves: "1.c4 Nf6" },
  { eco: "A17", name: "English: Hedgehog", moves: "1.c4 Nf6 2.Nc3 e6" },
  { eco: "A20", name: "English: Reversed Sicilian", moves: "1.c4 e5" },
  { eco: "A22", name: "English: Bremen System", moves: "1.c4 e5 2.Nc3 Nf6" },
  { eco: "A25", name: "English: Closed", moves: "1.c4 e5 2.Nc3 Nc6" },
  { eco: "A30", name: "English: Symmetrical", moves: "1.c4 c5" },
  { eco: "A34", name: "English: Symmetrical", moves: "1.c4 c5 2.Nc3" },
  { eco: "A36", name: "English: Ultra-Symmetrical", moves: "1.c4 c5 2.Nc3 Nc6 3.g3" },

  // A40–A49 — Queen's Pawn misc, Torre, Trompowsky
  { eco: "A41", name: "Queen's Pawn: Wade Defense", moves: "1.d4 d6" },
  { eco: "A43", name: "Old Benoni", moves: "1.d4 c5" },
  { eco: "A45", name: "Trompowsky Attack", moves: "1.d4 Nf6 2.Bg5" },
  { eco: "A46", name: "Torre Attack", moves: "1.d4 Nf6 2.Nf3 e6 3.Bg5" },
  { eco: "A46", name: "Colle System", moves: "1.d4 Nf6 2.Nf3 e6 3.e3" },
  { eco: "A47", name: "Queen's Indian: Marienbad System", moves: "1.d4 Nf6 2.Nf3 b6" },
  { eco: "A48", name: "London System", moves: "1.d4 Nf6 2.Nf3 g6 3.Bf4" },

  // A50–A79 — Indian / Benoni / Benko
  { eco: "A50", name: "Indian Defense", moves: "1.d4 Nf6" },
  { eco: "A51", name: "Budapest Gambit", moves: "1.d4 Nf6 2.c4 e5" },
  { eco: "A52", name: "Budapest Gambit: Adler Variation", moves: "1.d4 Nf6 2.c4 e5 3.dxe5 Ng4" },
  { eco: "A53", name: "Old Indian Defense", moves: "1.d4 Nf6 2.c4 d6" },
  { eco: "A56", name: "Benoni Defense", moves: "1.d4 Nf6 2.c4 c5" },
  { eco: "A57", name: "Benko Gambit", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5" },
  { eco: "A58", name: "Benko Gambit Accepted", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5 4.cxb5 a6" },
  { eco: "A60", name: "Modern Benoni", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6" },
  { eco: "A61", name: "Modern Benoni: Fianchetto", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6 7.g3" },
  { eco: "A65", name: "Czech Benoni", moves: "1.d4 Nf6 2.c4 c5 3.d5 e5" },
  { eco: "A70", name: "Modern Benoni: Classical", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4" },

  // A80–A99 — Dutch Defense
  { eco: "A80", name: "Dutch Defense", moves: "1.d4 f5" },
  { eco: "A81", name: "Dutch Defense", moves: "1.d4 f5 2.g3" },
  { eco: "A83", name: "Dutch: Staunton Gambit", moves: "1.d4 f5 2.e4" },
  { eco: "A85", name: "Dutch: Classical", moves: "1.d4 f5 2.c4 Nf6 3.Nc3" },
  { eco: "A87", name: "Dutch: Leningrad", moves: "1.d4 f5 2.c4 Nf6 3.g3 g6" },
  { eco: "A90", name: "Dutch: Stonewall", moves: "1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2 d5" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME B — Semi-Open Games (1.e4, Black plays other than 1...e5)
  // ═══════════════════════════════════════════════════════════════════════════

  // B00 — King's Pawn misc
  { eco: "B00", name: "King's Pawn Opening", moves: "1.e4" },
  { eco: "B00", name: "Nimzowitsch Defense", moves: "1.e4 Nc6" },
  { eco: "B00", name: "Owen's Defense", moves: "1.e4 b6" },
  { eco: "B00", name: "St. George Defense", moves: "1.e4 a6" },

  // B01 — Scandinavian
  { eco: "B01", name: "Scandinavian Defense", moves: "1.e4 d5" },
  { eco: "B01", name: "Scandinavian: Mieses-Kotrč", moves: "1.e4 d5 2.exd5 Qxd5" },
  { eco: "B01", name: "Scandinavian: Modern", moves: "1.e4 d5 2.exd5 Nf6" },

  // B02–B05 — Alekhine's Defense
  { eco: "B02", name: "Alekhine's Defense", moves: "1.e4 Nf6" },
  { eco: "B03", name: "Alekhine's Defense: Four Pawns Attack", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.c4 Nb6 5.f4" },
  { eco: "B04", name: "Alekhine's Defense: Modern", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3" },
  { eco: "B05", name: "Alekhine's Defense: Modern, Main Line", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 Bg4" },

  // B06–B09 — Modern / Pirc
  { eco: "B06", name: "Modern Defense", moves: "1.e4 g6" },
  { eco: "B07", name: "Pirc Defense", moves: "1.e4 d6 2.d4 Nf6" },
  { eco: "B08", name: "Pirc: Classical", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3" },
  { eco: "B09", name: "Pirc: Austrian Attack", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4" },

  // B10–B19 — Caro-Kann
  { eco: "B10", name: "Caro-Kann Defense", moves: "1.e4 c6" },
  { eco: "B11", name: "Caro-Kann: Two Knights", moves: "1.e4 c6 2.Nc3 d5 3.Nf3" },
  { eco: "B12", name: "Caro-Kann: Advance Variation", moves: "1.e4 c6 2.d4 d5 3.e5" },
  { eco: "B13", name: "Caro-Kann: Exchange Variation", moves: "1.e4 c6 2.d4 d5 3.exd5 cxd5" },
  { eco: "B14", name: "Caro-Kann: Panov-Botvinnik Attack", moves: "1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4" },
  { eco: "B15", name: "Caro-Kann: Classical", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5" },
  { eco: "B17", name: "Caro-Kann: Steinitz Variation", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7" },
  { eco: "B18", name: "Caro-Kann: Classical, Main Line", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6" },

  // B20–B99 — Sicilian Defense
  { eco: "B20", name: "Sicilian Defense", moves: "1.e4 c5" },
  { eco: "B21", name: "Sicilian: Smith-Morra Gambit", moves: "1.e4 c5 2.d4 cxd4 3.c3" },
  { eco: "B22", name: "Sicilian: Alapin Variation", moves: "1.e4 c5 2.c3" },
  { eco: "B23", name: "Sicilian: Closed", moves: "1.e4 c5 2.Nc3" },
  { eco: "B23", name: "Sicilian: Grand Prix Attack", moves: "1.e4 c5 2.Nc3 Nc6 3.f4" },
  { eco: "B27", name: "Sicilian: Hyper-Accelerated Dragon", moves: "1.e4 c5 2.Nf3 g6" },
  { eco: "B30", name: "Sicilian: Old Sicilian", moves: "1.e4 c5 2.Nf3 Nc6" },
  { eco: "B32", name: "Sicilian: Open", moves: "1.e4 c5 2.Nf3 Nc6 3.d4" },
  { eco: "B33", name: "Sicilian: Sveshnikov", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5" },
  { eco: "B34", name: "Sicilian: Accelerated Dragon", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6" },
  { eco: "B36", name: "Sicilian: Maroczy Bind", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4" },
  { eco: "B40", name: "Sicilian: Kan Variation", moves: "1.e4 c5 2.Nf3 e6" },
  { eco: "B41", name: "Sicilian: Kan, Maroczy Bind", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.c4" },
  { eco: "B44", name: "Sicilian: Taimanov", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6" },
  { eco: "B50", name: "Sicilian: Modern Variation", moves: "1.e4 c5 2.Nf3 d6" },
  { eco: "B54", name: "Sicilian: Open, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4" },
  { eco: "B56", name: "Sicilian: Classical", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6" },
  { eco: "B60", name: "Sicilian: Najdorf", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6" },
  { eco: "B66", name: "Sicilian: Richter-Rauzer", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Bg5" },
  { eco: "B70", name: "Sicilian: Dragon", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6" },
  { eco: "B76", name: "Sicilian: Dragon, Yugoslav Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3" },
  { eco: "B80", name: "Sicilian: Scheveningen", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6" },
  { eco: "B90", name: "Sicilian: Najdorf, English Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3" },
  { eco: "B96", name: "Sicilian: Najdorf, Poisoned Pawn", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME C — French Defense & Open Games (1.e4 e5)
  // ═══════════════════════════════════════════════════════════════════════════

  // C00–C19 — French Defense
  { eco: "C00", name: "French Defense", moves: "1.e4 e6" },
  { eco: "C01", name: "French: Exchange Variation", moves: "1.e4 e6 2.d4 d5 3.exd5" },
  { eco: "C02", name: "French: Advance Variation", moves: "1.e4 e6 2.d4 d5 3.e5" },
  { eco: "C03", name: "French: Tarrasch Variation", moves: "1.e4 e6 2.d4 d5 3.Nd2" },
  { eco: "C06", name: "French: Classical", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6" },
  { eco: "C10", name: "French: Rubinstein Variation", moves: "1.e4 e6 2.d4 d5 3.Nc3 dxe4" },
  { eco: "C11", name: "French: Winawer", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4" },
  { eco: "C15", name: "French: Winawer, Main Line", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5" },
  { eco: "C18", name: "French: Winawer, Poisoned Pawn", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Qc7" },

  // C20–C29 — Open Game misc
  { eco: "C20", name: "King's Pawn Game", moves: "1.e4 e5" },
  { eco: "C21", name: "Center Game", moves: "1.e4 e5 2.d4 exd4 3.Qxd4" },
  { eco: "C21", name: "Danish Gambit", moves: "1.e4 e5 2.d4 exd4 3.c3" },
  { eco: "C23", name: "Bishop's Opening", moves: "1.e4 e5 2.Bc4" },
  { eco: "C25", name: "Vienna Game", moves: "1.e4 e5 2.Nc3" },
  { eco: "C26", name: "Vienna: Falkbeer Variation", moves: "1.e4 e5 2.Nc3 Nf6" },
  { eco: "C29", name: "Vienna Gambit", moves: "1.e4 e5 2.Nc3 Nf6 3.f4" },

  // C30–C39 — King's Gambit
  { eco: "C30", name: "King's Gambit", moves: "1.e4 e5 2.f4" },
  { eco: "C33", name: "King's Gambit Accepted", moves: "1.e4 e5 2.f4 exf4" },
  { eco: "C36", name: "King's Gambit: Abbazia Defense", moves: "1.e4 e5 2.f4 exf4 3.Nf3 d5" },
  { eco: "C30", name: "King's Gambit Declined", moves: "1.e4 e5 2.f4 Bc5" },

  // C40–C49 — Open Game: Petrov, Philidor, Scotch, Four Knights
  { eco: "C40", name: "Latvian Gambit", moves: "1.e4 e5 2.Nf3 f5" },
  { eco: "C41", name: "Philidor Defense", moves: "1.e4 e5 2.Nf3 d6" },
  { eco: "C42", name: "Petrov's Defense", moves: "1.e4 e5 2.Nf3 Nf6" },
  { eco: "C43", name: "Petrov: Steinitz Attack", moves: "1.e4 e5 2.Nf3 Nf6 3.d4" },
  { eco: "C44", name: "Scotch Game", moves: "1.e4 e5 2.Nf3 Nc6 3.d4" },
  { eco: "C45", name: "Scotch Game: Classical", moves: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4" },
  { eco: "C46", name: "Three Knights Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3" },
  { eco: "C47", name: "Four Knights Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6" },
  { eco: "C48", name: "Four Knights: Spanish", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6 4.Bb5" },
  { eco: "C49", name: "Four Knights: Symmetrical", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6 4.Bb5 Bb4" },

  // C50–C59 — Italian Game / Two Knights
  { eco: "C50", name: "Italian Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4" },
  { eco: "C50", name: "Giuoco Piano", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5" },
  { eco: "C51", name: "Evans Gambit", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4" },
  { eco: "C53", name: "Giuoco Piano: Main Line", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3" },
  { eco: "C55", name: "Two Knights Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6" },
  { eco: "C57", name: "Two Knights: Fried Liver Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5" },
  { eco: "C58", name: "Two Knights: Max Lange Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4" },

  // C60–C99 — Ruy Lopez
  { eco: "C60", name: "Ruy Lopez", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" },
  { eco: "C62", name: "Ruy Lopez: Old Steinitz Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 d6" },
  { eco: "C63", name: "Ruy Lopez: Schliemann Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5" },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6" },
  { eco: "C67", name: "Ruy Lopez: Berlin, Rio de Janeiro", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4" },
  { eco: "C68", name: "Ruy Lopez: Exchange Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6" },
  { eco: "C70", name: "Ruy Lopez: Morphy Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6" },
  { eco: "C78", name: "Ruy Lopez: Archangel", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O b5" },
  { eco: "C80", name: "Ruy Lopez: Open Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4" },
  { eco: "C84", name: "Ruy Lopez: Closed", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7" },
  { eco: "C88", name: "Ruy Lopez: Closed, Anti-Marshall", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.a4" },
  { eco: "C89", name: "Ruy Lopez: Marshall Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5" },
  { eco: "C92", name: "Ruy Lopez: Zaitsev System", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Bb7" },
  { eco: "C95", name: "Ruy Lopez: Breyer Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME D — Queen's Gambit & Slav
  // ═══════════════════════════════════════════════════════════════════════════

  { eco: "D00", name: "Queen's Pawn Game", moves: "1.d4 d5" },
  { eco: "D00", name: "Blackmar-Diemer Gambit", moves: "1.d4 d5 2.e4" },
  { eco: "D00", name: "London System", moves: "1.d4 d5 2.Bf4" },
  { eco: "D00", name: "London System", moves: "1.d4 Nf6 2.Bf4" },
  { eco: "D01", name: "Veresov Attack", moves: "1.d4 d5 2.Nc3 Nf6 3.Bg5" },
  { eco: "D02", name: "Queen's Pawn: Symmetrical", moves: "1.d4 d5 2.Nf3 Nf6" },
  { eco: "D04", name: "Colle System", moves: "1.d4 d5 2.Nf3 Nf6 3.e3" },
  { eco: "D05", name: "Colle: Zukertort Variation", moves: "1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3" },
  { eco: "D06", name: "Queen's Gambit", moves: "1.d4 d5 2.c4" },
  { eco: "D07", name: "Chigorin Defense", moves: "1.d4 d5 2.c4 Nc6" },
  { eco: "D08", name: "QGD: Albin Counter-Gambit", moves: "1.d4 d5 2.c4 e5" },
  { eco: "D10", name: "Slav Defense", moves: "1.d4 d5 2.c4 c6" },
  { eco: "D11", name: "Slav: Modern", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6" },
  { eco: "D15", name: "Slav: Geller Gambit", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4" },
  { eco: "D17", name: "Slav: Czech Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5" },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: "1.d4 d5 2.c4 dxc4" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: "1.d4 d5 2.c4 e6" },
  { eco: "D31", name: "QGD: Semi-Tarrasch", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5" },
  { eco: "D32", name: "QGD: Tarrasch Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 c5" },
  { eco: "D35", name: "QGD: Exchange Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5" },
  { eco: "D37", name: "QGD: Classical", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Be7" },
  { eco: "D38", name: "QGD: Ragozin Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Bb4" },
  { eco: "D43", name: "Semi-Slav Defense", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6" },
  { eco: "D44", name: "Semi-Slav: Botvinnik System", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.Bg5 dxc4" },
  { eco: "D45", name: "Semi-Slav: Meran Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7" },

  // D50–D69 — QGD: Orthodox / Tartakower
  { eco: "D50", name: "QGD: Orthodox", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5" },
  { eco: "D53", name: "QGD: Lasker Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Ne4" },
  { eco: "D58", name: "QGD: Tartakower", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6" },

  // D70–D99 — Grünfeld Defense
  { eco: "D70", name: "Grünfeld Defense", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5" },
  { eco: "D76", name: "Grünfeld: Russian System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.e3" },
  { eco: "D80", name: "Grünfeld: Stockholm Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Bg5" },
  { eco: "D85", name: "Grünfeld: Exchange Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5" },
  { eco: "D90", name: "Grünfeld: Three Knights", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3" },
  { eco: "D97", name: "Grünfeld: Russian, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME E — Indian Defenses (1.d4 Nf6)
  // ═══════════════════════════════════════════════════════════════════════════

  // E00–E09 — Catalan
  { eco: "E00", name: "Catalan Opening", moves: "1.d4 Nf6 2.c4 e6 3.g3" },
  { eco: "E01", name: "Catalan: Closed", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2" },
  { eco: "E04", name: "Catalan: Open", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4" },

  // E10–E19 — Queen's Indian / Bogo-Indian
  { eco: "E10", name: "Queen's Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6" },
  { eco: "E11", name: "Bogo-Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+" },
  { eco: "E12", name: "Queen's Indian: Petrosian System", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.a3" },
  { eco: "E15", name: "Queen's Indian: Fianchetto", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3" },
  { eco: "E17", name: "Queen's Indian: Classical", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Be7" },

  // E20–E59 — Nimzo-Indian
  { eco: "E20", name: "Nimzo-Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4" },
  { eco: "E21", name: "Nimzo-Indian: Three Knights", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Nf3" },
  { eco: "E24", name: "Nimzo-Indian: Samisch", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3" },
  { eco: "E32", name: "Nimzo-Indian: Classical", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2" },
  { eco: "E41", name: "Nimzo-Indian: Hübner", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5" },
  { eco: "E46", name: "Nimzo-Indian: Reshevsky", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O" },
  { eco: "E53", name: "Nimzo-Indian: Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Bd3 d5" },

  // E60–E99 — King's Indian Defense
  { eco: "E60", name: "King's Indian Defense", moves: "1.d4 Nf6 2.c4 g6" },
  { eco: "E62", name: "King's Indian: Fianchetto", moves: "1.d4 Nf6 2.c4 g6 3.g3" },
  { eco: "E67", name: "King's Indian: Fianchetto, Classical", moves: "1.d4 Nf6 2.c4 g6 3.g3 Bg7 4.Bg2 O-O 5.Nc3 d6 6.Nf3" },
  { eco: "E70", name: "King's Indian: Classical", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2" },
  { eco: "E73", name: "King's Indian: Averbakh", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Be2 O-O 6.Bg5" },
  { eco: "E76", name: "King's Indian: Four Pawns Attack", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4" },
  { eco: "E80", name: "King's Indian: Sämisch", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3" },
  { eco: "E85", name: "King's Indian: Sämisch, Orthodox", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5" },
  { eco: "E90", name: "King's Indian: Classical, Main", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3" },
  { eco: "E92", name: "King's Indian: Petrosian System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.d5" },
  { eco: "E97", name: "King's Indian: Mar del Plata", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6" },
  { eco: "E99", name: "King's Indian: Mar del Plata, Main", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7" },
];

// Sort by move length descending so longest (most specific) match wins
const ECO_SORTED = [...ECO_BOOK].sort((a, b) => b.moves.length - a.moves.length);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CC_HEADERS = {
  "User-Agent": "OTBChess/1.0 (https://chessotb.club; matchup prep engine)",
  "Accept": "application/json",
};

/**
 * Extract the first N full-moves from a PGN string (just the move text, no headers).
 */
export function extractMoves(pgn: string, maxFullMoves = 10): string {
  // Strip PGN headers (lines starting with [)
  const moveText = pgn
    .replace(/\[.*?\]\s*/g, "")
    .replace(/\{[^}]*\}/g, "")  // strip comments
    .replace(/\d+\.\.\./g, "")  // strip "..." continuation
    .replace(/\s+/g, " ")
    .trim();

  // Parse move pairs: "1.e4 e5 2.Nf3 Nc6 ..."
  const tokens = moveText.split(/\s+/);
  const moves: string[] = [];
  let fullMoveCount = 0;

  for (const token of tokens) {
    // Skip result tokens
    if (["1-0", "0-1", "1/2-1/2", "*"].includes(token)) break;
    // Skip move numbers like "1." "2."
    if (/^\d+\./.test(token)) {
      const moveAfterNum = token.replace(/^\d+\./, "");
      if (moveAfterNum) {
        moves.push(moveAfterNum);
        fullMoveCount++;
      }
      continue;
    }
    moves.push(token);
    // Every second move completes a full move
    if (moves.length % 2 === 0) fullMoveCount++;
    if (fullMoveCount >= maxFullMoves) break;
  }

  // Reconstruct with move numbers
  const result: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    if (i + 1 < moves.length) {
      result.push(`${num}.${moves[i]} ${moves[i + 1]}`);
    } else {
      result.push(`${num}.${moves[i]}`);
    }
  }
  return result.join(" ");
}

/**
 * Classify an opening from a PGN's first moves.
 * Returns the most specific matching ECO entry.
 */
export function classifyOpening(pgn: string): OpeningInfo {
  const normalized = extractMoves(pgn, 10);

  for (const entry of ECO_SORTED) {
    if (normalized.startsWith(entry.moves) || normalized === entry.moves) {
      return { eco: entry.eco, name: entry.name, moves: entry.moves };
    }
  }

  // Fallback: extract first move
  const firstMove = normalized.split(" ")[0] || "Unknown";
  return { eco: "A00", name: `Unclassified (${firstMove})`, moves: firstMove };
}

/**
 * Determine the result for a given username from a chess.com game object.
 */
export function getResult(game: ChessComGame, username: string): "win" | "draw" | "loss" {
  const u = username.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === u;
  const side = isWhite ? game.white : game.black;
  const res = side.result;
  if (res === "win") return "win";
  if (["agreed", "stalemate", "repetition", "insufficient", "50move", "timevsinsufficient"].includes(res)) return "draw";
  return "loss";
}

/**
 * Determine how a game ended.
 */
export function getEndType(game: ChessComGame, username: string): "checkmate" | "resignation" | "timeout" | "draw" | "other" {
  const u = username.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === u;
  const mySide = isWhite ? game.white : game.black;
  const oppSide = isWhite ? game.black : game.white;

  if (mySide.result === "win") {
    if (oppSide.result === "checkmated") return "checkmate";
    if (oppSide.result === "resigned") return "resignation";
    if (oppSide.result === "timeout") return "timeout";
    return "other";
  }
  if (["agreed", "stalemate", "repetition", "insufficient", "50move", "timevsinsufficient"].includes(mySide.result)) return "draw";
  if (mySide.result === "checkmated") return "checkmate";
  if (mySide.result === "resigned") return "resignation";
  if (mySide.result === "timeout") return "timeout";
  return "other";
}

/**
 * Count full moves in a PGN.
 */
export function countMoves(pgn: string): number {
  const moveText = pgn.replace(/\[.*?\]\s*/g, "").replace(/\{[^}]*\}/g, "").trim();
  const moveNumbers = moveText.match(/\d+\./g);
  if (!moveNumbers) return 0;
  // The highest move number is the game length
  const nums = moveNumbers.map((m) => parseInt(m));
  return Math.max(...nums, 0);
}

// ─── Chess.com API Fetchers ──────────────────────────────────────────────────

/**
 * Fetch recent games for a chess.com player.
 * Walks the archives API backwards, collecting up to `maxGames` rated standard games.
 */
export async function fetchPlayerGames(
  username: string,
  maxGames = 50,
  timeClasses: string[] = ["rapid", "blitz", "bullet"]
): Promise<ChessComGame[]> {
  const u = username.toLowerCase().trim();
  const base = "https://api.chess.com/pub/player";

  // Fetch archive list
  const archivesRes = await fetch(`${base}/${u}/games/archives`, { headers: CC_HEADERS });
  if (!archivesRes.ok) {
    throw new Error(`chess.com archives error: ${archivesRes.status}`);
  }
  const archivesData = (await archivesRes.json()) as { archives?: string[] };
  const archives = archivesData.archives ?? [];

  const games: ChessComGame[] = [];

  // Walk backwards (newest first), fetch up to 3 months max to stay fast
  const maxMonths = Math.min(archives.length, 3);
  for (let i = archives.length - 1; i >= archives.length - maxMonths && games.length < maxGames; i--) {
    if (i < 0) break;
    try {
      const monthRes = await fetch(archives[i], { headers: CC_HEADERS });
      if (!monthRes.ok) continue;
      const monthData = (await monthRes.json()) as { games?: ChessComGame[] };
      const monthGames = monthData.games ?? [];

      // Process newest first within the month
      for (let j = monthGames.length - 1; j >= 0 && games.length < maxGames; j--) {
        const g = monthGames[j];
        if (!g.rated) continue;
        if (g.rules && g.rules !== "chess") continue;
        if (!timeClasses.includes(g.time_class)) continue;
        games.push(g);
      }
    } catch {
      // Skip failed month fetches
      continue;
    }
  }

  return games;
}

/**
 * Fetch player stats (ratings) from chess.com.
 */
export async function fetchPlayerStats(username: string): Promise<{
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
}> {
  const u = username.toLowerCase().trim();
  const res = await fetch(`https://api.chess.com/pub/player/${u}/stats`, { headers: CC_HEADERS });
  if (!res.ok) return { rapid: null, blitz: null, bullet: null };

  const data = (await res.json()) as Record<string, { last?: { rating?: number } }>;
  return {
    rapid: data.chess_rapid?.last?.rating ?? null,
    blitz: data.chess_blitz?.last?.rating ?? null,
    bullet: data.chess_bullet?.last?.rating ?? null,
  };
}

// ─── Analysis Engine ─────────────────────────────────────────────────────────

/**
 * Analyze a player's games and build a comprehensive play style profile.
 */
export function analyzePlayStyle(
  username: string,
  games: ChessComGame[],
  ratings: { rapid: number | null; blitz: number | null; bullet: number | null }
): PlayStyleProfile {
  const u = username.toLowerCase();

  let wins = 0, draws = 0, losses = 0;
  let wWins = 0, wDraws = 0, wLosses = 0, wGames = 0;
  let bWins = 0, bDraws = 0, bLosses = 0, bGames = 0;
  let checkmates = 0, resignations = 0, timeouts = 0, drawEnds = 0;
  let totalMoves = 0;

  const whiteOpeningMap = new Map<string, { eco: string; moves: string; w: number; d: number; l: number }>();
  const blackOpeningMap = new Map<string, { eco: string; moves: string; w: number; d: number; l: number }>();
  const firstMoveMap = new Map<string, number>();

  for (const game of games) {
    const isWhite = game.white.username.toLowerCase() === u;
    const result = getResult(game, username);
    const endType = getEndType(game, username);
    const opening = classifyOpening(game.pgn || "");
    const moveCount = countMoves(game.pgn || "");

    // Overall
    if (result === "win") wins++;
    else if (result === "draw") draws++;
    else losses++;

    // By color
    if (isWhite) {
      wGames++;
      if (result === "win") wWins++;
      else if (result === "draw") wDraws++;
      else wLosses++;
    } else {
      bGames++;
      if (result === "win") bWins++;
      else if (result === "draw") bDraws++;
      else bLosses++;
    }

    // Endgame profile
    if (endType === "checkmate") checkmates++;
    else if (endType === "resignation") resignations++;
    else if (endType === "timeout") timeouts++;
    else if (endType === "draw") drawEnds++;

    // Opening tracking
    const openingMap = isWhite ? whiteOpeningMap : blackOpeningMap;
    const existing = openingMap.get(opening.name);
    if (existing) {
      if (result === "win") existing.w++;
      else if (result === "draw") existing.d++;
      else existing.l++;
    } else {
      openingMap.set(opening.name, {
        eco: opening.eco,
        moves: opening.moves,
        w: result === "win" ? 1 : 0,
        d: result === "draw" ? 1 : 0,
        l: result === "loss" ? 1 : 0,
      });
    }

    // First move as white
    if (isWhite && game.pgn) {
      const firstMove = extractFirstWhiteMove(game.pgn);
      if (firstMove) {
        firstMoveMap.set(firstMove, (firstMoveMap.get(firstMove) ?? 0) + 1);
      }
    }

    totalMoves += moveCount;
  }

  const total = games.length || 1;

  // Convert opening maps to sorted arrays
  const toOpeningStats = (map: Map<string, { eco: string; moves: string; w: number; d: number; l: number }>): OpeningStat[] => {
    return Array.from(map.entries())
      .map(([name, { eco, moves, w, d, l }]) => ({
        name,
        eco,
        count: w + d + l,
        wins: w,
        draws: d,
        losses: l,
        winRate: (w + d + l) > 0 ? Math.round((w / (w + d + l)) * 100) : 0,
        moves,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 openings
  };

  // First move stats
  const firstMoveStats = Array.from(firstMoveMap.entries())
    .map(([move, count]) => ({
      move,
      count,
      pct: Math.round((count / (wGames || 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    username,
    gamesAnalyzed: games.length,
    rating: ratings,
    overall: {
      wins,
      draws,
      losses,
      winRate: Math.round((wins / total) * 100),
    },
    asWhite: {
      wins: wWins,
      draws: wDraws,
      losses: wLosses,
      winRate: wGames > 0 ? Math.round((wWins / wGames) * 100) : 0,
      games: wGames,
    },
    asBlack: {
      wins: bWins,
      draws: bDraws,
      losses: bLosses,
      winRate: bGames > 0 ? Math.round((bWins / bGames) * 100) : 0,
      games: bGames,
    },
    whiteOpenings: toOpeningStats(whiteOpeningMap),
    blackOpenings: toOpeningStats(blackOpeningMap),
    endgameProfile: {
      checkmates,
      resignations,
      timeouts,
      draws: drawEnds,
      total: games.length,
    },
    firstMoveAsWhite: firstMoveStats,
    avgGameLength: games.length > 0 ? Math.round(totalMoves / games.length) : 0,
  };
}

function extractFirstWhiteMove(pgn: string): string | null {
  const moveText = pgn.replace(/\[.*?\]\s*/g, "").replace(/\{[^}]*\}/g, "").trim();
  const match = moveText.match(/1\.\s*(\S+)/);
  return match?.[1] ?? null;
}

// ─── Prep Line Generator ────────────────────────────────────────────────────

/** Counter-opening suggestions based on opponent weaknesses. */
const COUNTER_LINES: Record<string, PrepLine[]> = {
  // If opponent plays 1.e4 heavily
  "1.e4": [
    {
      name: "Sicilian: Najdorf",
      eco: "B60",
      moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
      rationale: "The Najdorf is the most theoretically rich response to 1.e4, offering dynamic counterplay and imbalanced positions that punish unprepared players.",
      confidence: "high",
    },
    {
      name: "Caro-Kann Defense",
      eco: "B10",
      moves: "1.e4 c6 2.d4 d5",
      rationale: "Solid and reliable — the Caro-Kann avoids sharp tactical lines and leads to positions where strategic understanding matters more than memorization.",
      confidence: "high",
    },
    {
      name: "French Defense: Winawer",
      eco: "C11",
      moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4",
      rationale: "The Winawer creates immediate tension and often leads to unbalanced pawn structures that favor the prepared player.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Alekhine's Defense",
      eco: "B02",
      moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 g6 5.Bc4 Nb6 6.Bb3",
      rationale: "Alekhine's Defense is a provocative surprise that invites White to overextend the center. Most 1.e4 players are uncomfortable when their central pawns become targets. The hypermodern counterplay is hard to handle without specific preparation.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.d4 heavily
  "1.d4": [
    {
      name: "King's Indian Defense",
      eco: "E60",
      moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6",
      rationale: "The King's Indian allows White to build a big center, then strikes back with ...e5 or ...c5. Excellent for players who like dynamic, attacking chess.",
      confidence: "high",
    },
    {
      name: "Nimzo-Indian Defense",
      eco: "E20",
      moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4",
      rationale: "The Nimzo-Indian is one of the most respected defenses against 1.d4, offering flexible pawn structures and piece activity.",
      confidence: "high",
    },
    {
      name: "Grunfeld Defense",
      eco: "D70",
      moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5",
      rationale: "The Grunfeld challenges White's center immediately, leading to open positions with dynamic piece play.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Budapest Gambit",
      eco: "A51",
      moves: "1.d4 Nf6 2.c4 e5 3.dxe5 Ng4 4.Nf3 Bc5 5.e3 Nc6",
      rationale: "The Budapest Gambit is a sharp and underestimated surprise against 1.d4. Black sacrifices a pawn for rapid development and active piece play. Most 1.d4 players have never studied this gambit and can quickly find themselves in a lost position.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.c4
  "1.c4": [
    {
      name: "Symmetrical English",
      eco: "A20",
      moves: "1.c4 e5",
      rationale: "Playing 1...e5 against the English seizes central space and often transposes into reversed Sicilian structures where Black has an extra tempo.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Agincourt Defense",
      eco: "A13",
      moves: "1.c4 e6 2.Nf3 d5 3.g3 Nf6 4.Bg2 Be7 5.O-O O-O 6.b3 c5",
      rationale: "The Agincourt Defense is a solid and flexible surprise — Black builds a compact structure and waits for White to commit before striking in the center with ...d5 and ...c5. English players who expect the Symmetrical or reversed Sicilian are often caught off guard by this patient approach.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Dutch vs English (1...f5)",
      eco: "A10",
      moves: "1.c4 f5 2.Nc3 Nf6 3.g3 g6 4.Bg2 Bg7 5.d3 O-O",
      rationale: "Playing the Dutch setup against 1.c4 is an aggressive surprise that denies White the typical English structures. Black aims for a Leningrad Dutch formation with kingside attacking chances, while White's c4 pawn is less useful than in a normal d4 game.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.Nf3
  "1.Nf3": [
    {
      name: "Queen's Pawn Response",
      eco: "A04",
      moves: "1.Nf3 d5 2.g3 Nf6 3.Bg2 e6",
      rationale: "Solid central control against the Reti. Keeps options open for various pawn structures.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Dutch vs Reti (1...f5)",
      eco: "A04",
      moves: "1.Nf3 f5 2.g3 Nf6 3.Bg2 g6 4.O-O Bg7 5.d3 O-O",
      rationale: "Playing 1...f5 against the Reti is a bold surprise that immediately signals aggressive intentions. Reti players who expect 1...d5 or 1...Nf6 are forced into unfamiliar territory. The Leningrad Dutch setup gives Black active kingside play.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: King's Indian vs Reti",
      eco: "A05",
      moves: "1.Nf3 Nf6 2.g3 g6 3.Bg2 Bg7 4.O-O O-O 5.d3 d6 6.e4 e5",
      rationale: "Mirroring the King's Indian setup against the Reti leads to a reversed King's Indian Attack where Black has a comfortable position. The solid ...d6/...e5 structure gives Black a strong center and the Reti player often doesn't know how to handle the reversed structure.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.b3 (Nimzo-Larsen Attack)
  "1.b3": [
    {
      name: "Central Counter: 1...e5",
      eco: "A01",
      moves: "1.b3 e5 2.Bb2 Nc6 3.e3 d5 4.Bb5 Bd6",
      rationale: "Seizing the center immediately with 1...e5 is the most principled reply. White's fianchettoed bishop on b2 bites on granite once you establish ...d5, and Black gets a comfortable classical setup with easy development.",
      confidence: "high",
    },
    {
      name: "Solid Setup: 1...d5",
      eco: "A01",
      moves: "1.b3 d5 2.Bb2 Nf6 3.e3 e6 4.Nf3 Be7 5.Be2 O-O",
      rationale: "A solid Queen's Gambit-style setup neutralizes the Nimzo-Larsen's pressure. Black completes development quickly and the b2-bishop has limited scope against a well-placed pawn on d5.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Queenside Fianchetto Mirror (1...b6)",
      eco: "A01",
      moves: "1.b3 b6 2.Bb2 Bb7 3.e3 e6 4.Nf3 Nf6 5.Be2 Be7 6.O-O O-O",
      rationale: "Mirroring White's own strategy with 1...b6 is a psychological surprise. Both sides fianchetto queenside bishops and the game becomes a battle of who can exploit the other's setup first. Nimzo-Larsen players rarely expect to face their own system.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.g3 (King's Fianchetto)
  "1.g3": [
    {
      name: "Central Grab: 1...d5 2...e5",
      eco: "A00",
      moves: "1.g3 d5 2.Bg2 e5 3.d3 Nf6 4.Nd2 Bc5",
      rationale: "Against the King's Fianchetto, occupying the center with both ...d5 and ...e5 gives Black a space advantage. White's setup is passive and Black can build a strong attack.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Reversed Grob (1...g5)",
      eco: "A00",
      moves: "1.g3 g5 2.Bg2 g4 3.h3 gxh3 4.Bxh3 d5 5.d4 Nc6",
      rationale: "Playing 1...g5 against the King's Fianchetto is an ultra-aggressive surprise that immediately destabilizes White's setup. While objectively risky, it forces the King's Fianchetto player completely out of their comfort zone and into chaotic positions.",
      confidence: "low",
    },
    {
      name: "Surprise Weapon: English Defense (1...b6)",
      eco: "A00",
      moves: "1.g3 b6 2.Bg2 Bb7 3.Nf3 e6 4.O-O Nf6 5.d3 Be7",
      rationale: "The English Defense (1...b6) against the King's Fianchetto is a solid hypermodern surprise. Black develops the bishop to b7 and fights for central control from the flanks. The resulting positions are rich and strategic, favoring the better-prepared player.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.f4 (Bird's Opening)
  "1.f4": [
    {
      name: "From's Gambit",
      eco: "A02",
      moves: "1.f4 e5 2.fxe5 d6 3.exd6 Bxd6",
      rationale: "From's Gambit is the sharpest and most dangerous reply to the Bird. Black sacrifices a pawn for rapid development and a direct attack on White's weakened kingside.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Dutch Reversed (1...f5)",
      eco: "A02",
      moves: "1.f4 f5 2.e3 Nf6 3.Nf3 e6 4.Be2 d5 5.O-O Bd6",
      rationale: "Playing 1...f5 against the Bird creates a double Dutch position where both sides have advanced their f-pawns. This leads to unusual, uncharted territory where Bird's Opening specialists have no theoretical advantage. Black builds a solid Stonewall-like structure.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Lasker's Defense (1...d5)",
      eco: "A03",
      moves: "1.f4 d5 2.Nf3 Nf6 3.e3 g6 4.Be2 Bg7 5.O-O O-O",
      rationale: "Lasker's Defense is a solid and principled reply that occupies the center and develops naturally. The fianchettoed bishop on g7 creates long-term pressure on White's queenside. Bird players who rely on From's Gambit being declined are often unprepared for this quiet approach.",
      confidence: "medium",
    },
  ],
};

/** Suggest counter-openings when you play white against this opponent's black repertoire.
 *  Each entry is [mainLine, surpriseWeapon] so the prep report always delivers two options.
 */
const WHITE_COUNTERS: Record<string, PrepLine[]> = {
  "Sicilian Defense": [
    {
      name: "Anti-Sicilian: Alapin (2.c3)",
      eco: "B22",
      moves: "1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4",
      rationale: "The Alapin avoids the main-line Sicilian theory and leads to positions where White gets a comfortable IQP game with clear plans.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Grand Prix Attack",
      eco: "B23",
      moves: "1.e4 c5 2.Nc3 Nc6 3.f4 g6 4.Nf3 Bg7 5.Bc4",
      rationale: "The Grand Prix Attack sidesteps all main-line Sicilian theory and launches an immediate kingside attack. Most Sicilian players are unprepared for this aggressive system.",
      confidence: "medium",
    },
  ],
  "French Defense": [
    {
      name: "French: Advance Variation",
      eco: "C02",
      moves: "1.e4 e6 2.d4 d5 3.e5 c5 4.c3",
      rationale: "The Advance locks the center and creates a space advantage. Many French players are less comfortable in closed positions.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: King's Indian Attack vs French",
      eco: "C00",
      moves: "1.e4 e6 2.d3 d5 3.Nd2 Nf6 4.Ngf3 c5 5.g3 Nc6 6.Bg2",
      rationale: "The KIA against the French is a positional surprise — White avoids all theoretical battles and builds a slow kingside attack. French specialists often don't know how to handle the reversed King's Indian structure.",
      confidence: "medium",
    },
  ],
  "Caro-Kann Defense": [
    {
      name: "Caro-Kann: Fantasy Variation",
      eco: "B12",
      moves: "1.e4 c6 2.d4 d5 3.f3",
      rationale: "The Fantasy Variation is aggressive and less common — many Caro-Kann players are unprepared for it, expecting the main lines.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Two Knights Attack",
      eco: "B11",
      moves: "1.e4 c6 2.Nc3 d5 3.Nf3 Bg4 4.h3 Bxf3 5.Qxf3",
      rationale: "The Two Knights sidesteps the main-line Caro-Kann and forces Black into unfamiliar territory. The bishop pair and queen activity give White dynamic compensation.",
      confidence: "medium",
    },
  ],
  "King's Indian Defense": [
    {
      name: "King's Indian: Samisch",
      eco: "E80",
      moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3",
      rationale: "The Samisch is a solid system against the King's Indian that restricts Black's typical kingside attack plans.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: London System vs KID",
      eco: "A48",
      moves: "1.d4 Nf6 2.Nf3 g6 3.Bf4 Bg7 4.e3 O-O 5.Be2 d6 6.O-O",
      rationale: "Playing the London against the King's Indian denies Black the sharp e4/e5 pawn battles they love. The solid London structure is hard to attack and many KID players are uncomfortable in quiet positional games.",
      confidence: "medium",
    },
  ],
  "Nimzo-Indian Defense": [
    {
      name: "Nimzo-Indian: Classical (4.Qc2)",
      eco: "E32",
      moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2",
      rationale: "4.Qc2 avoids doubled pawns and maintains a flexible pawn structure. White keeps the bishop pair potential.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Nimzo-Indian Leningrad (4.Bg5)",
      eco: "E30",
      moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Bg5 h6 5.Bh4 c5 6.d5",
      rationale: "4.Bg5 is a rare and aggressive surprise — White pins the knight and creates immediate tactical complications. Nimzo players expecting 4.e3 or 4.Qc2 are often caught off guard.",
      confidence: "medium",
    },
  ],
  "Modern Defense": [
    {
      name: "Modern Defense: Austrian Attack",
      eco: "B06",
      moves: "1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.f4 Nf6 5.Nf3",
      rationale: "The Austrian Attack is White's most aggressive and principled response to the Modern. The f4 pawn supports a central space advantage and prepares a kingside pawn storm before Black can complete development.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: 150 Attack vs Modern",
      eco: "B06",
      moves: "1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3 a6 5.Qd2 b5 6.f3",
      rationale: "The 150 Attack (named after its use against 150-rated club players) is a simple but devastating setup — White builds f3/g4/h4 and launches a direct kingside attack. Modern Defense players rarely prepare for this system.",
      confidence: "medium",
    },
  ],
  "Dutch Defense": [
    {
      name: "Dutch: Staunton Gambit",
      eco: "A83",
      moves: "1.d4 f5 2.e4 fxe4 3.Nc3 Nf6 4.Bg5 c6 5.f3",
      rationale: "The Staunton Gambit immediately challenges the Dutch's structural concessions. White sacrifices a pawn for rapid development and open lines, putting Dutch players on the defensive from move two.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Anti-Dutch 2.Bg5",
      eco: "A80",
      moves: "1.d4 f5 2.Bg5 h6 3.Bh4 g5 4.e4 gxh4 5.exf5",
      rationale: "2.Bg5 is a sharp and provocative surprise that forces Dutch players to weaken their kingside immediately. After 2...h6 3.Bh4 g5 4.e4, Black's position becomes structurally compromised before they've developed a single piece.",
      confidence: "medium",
    },
  ],
  "Benoni Defense": [
    {
      name: "Modern Benoni: Four Pawns Attack",
      eco: "A68",
      moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.f4",
      rationale: "The Four Pawns Attack is the most ambitious reply to the Benoni — White builds a massive pawn center and dares Black to find counterplay. Benoni players often prefer slower positional battles and can be overwhelmed by the sheer aggression.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Fianchetto vs Benoni",
      eco: "A62",
      moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6 7.g3 Bg7 8.Bg2",
      rationale: "The Fianchetto system against the Benoni is a positional surprise — White avoids the sharp Four Pawns lines and instead builds a solid structure. Benoni players who rely on tactical counterplay are often frustrated by this quiet approach.",
      confidence: "medium",
    },
  ],
  "Old Benoni": [
    {
      name: "Modern Benoni: Four Pawns Attack",
      eco: "A68",
      moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.f4",
      rationale: "The Four Pawns Attack creates maximum central tension against Benoni setups, giving White a space advantage and kingside attacking chances.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: Taimanov Attack vs Old Benoni",
      eco: "A43",
      moves: "1.d4 c5 2.d5 d6 3.e4 g6 4.Nc3 Bg7 5.f4 Nf6 6.Nf3",
      rationale: "The Taimanov Attack builds an aggressive pawn center immediately and prevents Black from establishing the standard Benoni counterplay. Many Old Benoni players are unfamiliar with this direct approach.",
      confidence: "medium",
    },
  ],
  "Pirc Defense": [
    {
      name: "Pirc: Austrian Attack",
      eco: "B09",
      moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4 Bg7 5.Nf3 O-O 6.Bd3",
      rationale: "The Austrian Attack is the most aggressive system against the Pirc. White builds a broad pawn center with e4+d4+f4 and launches a direct kingside attack before Black can generate counterplay.",
      confidence: "high",
    },
    {
      name: "Surprise Weapon: 150 Attack vs Pirc",
      eco: "B07",
      moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.g4",
      rationale: "The 150 Attack against the Pirc is a brutal kingside attack that bypasses all theory. White simply marches the g and h pawns forward. Pirc players who rely on the Austrian Attack being the main threat are completely unprepared.",
      confidence: "medium",
    },
  ],
  "Scandinavian Defense": [
    {
      name: "Scandinavian: Main Line (3.Nc3)",
      eco: "B01",
      moves: "1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5 6.Bc4",
      rationale: "Developing with Nc3 and Bc4 targets the exposed queen and creates immediate threats. Scandinavian players often struggle when White develops quickly and attacks the misplaced queen.",
      confidence: "medium",
    },
    {
      name: "Surprise Weapon: Icelandic Gambit Declined (2.Nf3)",
      eco: "B01",
      moves: "1.e4 d5 2.Nf3 dxe4 3.Ng5 Nf6 4.d3 exd3 5.Bxd3",
      rationale: "Playing 2.Nf3 instead of 2.exd5 is a positional surprise that avoids the main Scandinavian theory entirely. White develops naturally and recovers the pawn with active piece play, leaving Scandinavian specialists in unfamiliar territory.",
      confidence: "medium",
    },
  ],
};

/**
 * Generate preparation lines based on the opponent's play style profile.
 */
export function generatePrepLines(profile: PlayStyleProfile): PrepLine[] {
  const lines: PrepLine[] = [];

  // 1. Counter their most common first move as white
  if (profile.firstMoveAsWhite.length > 0) {
    const topMove = profile.firstMoveAsWhite[0].move;
    const moveKey = `1.${topMove}`;
    const counters = COUNTER_LINES[moveKey];
    if (counters) {
      // Add the top 2 counter-lines
      for (const counter of counters.slice(0, 2)) {
        lines.push({
          ...counter,
          rationale: `Opponent plays ${moveKey} in ${profile.firstMoveAsWhite[0].pct}% of white games. ${counter.rationale}`,
        });
      }
    }
  }

  // 2. Counter their most common black openings (when you play white)
  // WHITE_COUNTERS is now [mainLine, surpriseWeapon] per opening
  if (profile.blackOpenings.length > 0) {
    const topBlackOpening = profile.blackOpenings[0];
    const counterLines = WHITE_COUNTERS[topBlackOpening.name];
    if (counterLines && counterLines.length > 0) {
      for (const counter of counterLines) {
        lines.push({
          ...counter,
          rationale: `Opponent plays the ${topBlackOpening.name} in ${topBlackOpening.count} games (${topBlackOpening.winRate}% win rate). ${counter.rationale}`,
        });
      }
    }
  }

  // 3. Exploit weaknesses
  // If opponent loses more as black, suggest aggressive white openings
  if (profile.asBlack.winRate < 40 && profile.asBlack.games >= 5) {
    lines.push({
      name: "Aggressive 1.e4 Repertoire",
      eco: "C20",
      moves: "1.e4",
      rationale: `Opponent wins only ${profile.asBlack.winRate}% as Black — apply pressure with 1.e4 and aim for open, tactical positions.`,
      confidence: "high",
    });
  }

  // If opponent has high timeout rate, suggest complex positions
  if (profile.endgameProfile.total > 0) {
    const timeoutRate = Math.round((profile.endgameProfile.timeouts / profile.endgameProfile.total) * 100);
    if (timeoutRate > 20) {
      lines.push({
        name: "Complex Middlegame Strategy",
        eco: "---",
        moves: "Aim for positions with many pieces remaining",
        rationale: `Opponent loses on time in ${timeoutRate}% of games — steer toward complex positions with many calculation-heavy decisions.`,
        confidence: "medium",
      });
    }
  }

  // If opponent's average game is short, they may struggle in longer games
  if (profile.avgGameLength < 25 && profile.gamesAnalyzed >= 10) {
    lines.push({
      name: "Endgame Grind Strategy",
      eco: "---",
      moves: "Trade pieces, aim for technical endgames",
      rationale: `Opponent's average game length is ${profile.avgGameLength} moves — they prefer quick games. Slow the pace and aim for endgames where technique matters.`,
      confidence: "medium",
    });
  }

  // Auto-tag lineType based on name prefix, then deduplicate
  const tagged = lines.map((l) => ({
    ...l,
    lineType: (l.name.startsWith("Surprise Weapon:") ? "surprise" : "main") as "main" | "surprise",
  }));

  const seen = new Set<string>();
  return tagged.filter((l) => {
    if (seen.has(l.name)) return false;
    seen.add(l.name);
    return true;
  });
}

// ─── Insight Generator ──────────────────────────────────────────────────────

export function generateInsights(profile: PlayStyleProfile): string[] {
  const insights: string[] = [];

  // First move preference
  if (profile.firstMoveAsWhite.length > 0) {
    const top = profile.firstMoveAsWhite[0];
    insights.push(`Plays 1.${top.move} in ${top.pct}% of white games.`);
  }

  // Color preference
  if (profile.asWhite.winRate > profile.asBlack.winRate + 10) {
    insights.push(`Stronger as White (${profile.asWhite.winRate}% win rate vs ${profile.asBlack.winRate}% as Black).`);
  } else if (profile.asBlack.winRate > profile.asWhite.winRate + 10) {
    insights.push(`Stronger as Black (${profile.asBlack.winRate}% win rate vs ${profile.asWhite.winRate}% as White).`);
  }

  // Top white opening
  if (profile.whiteOpenings.length > 0) {
    const top = profile.whiteOpenings[0];
    insights.push(`Favorite white opening: ${top.name} (${top.count} games, ${top.winRate}% win rate).`);
  }

  // Top black opening
  if (profile.blackOpenings.length > 0) {
    const top = profile.blackOpenings[0];
    insights.push(`Favorite black defense: ${top.name} (${top.count} games, ${top.winRate}% win rate).`);
  }

  // Endgame style
  if (profile.endgameProfile.total > 0) {
    const { checkmates, resignations, timeouts, total } = profile.endgameProfile;
    const cmRate = Math.round((checkmates / total) * 100);
    const toRate = Math.round((timeouts / total) * 100);
    if (cmRate > 25) insights.push(`Tactical player — ${cmRate}% of games end in checkmate.`);
    if (toRate > 20) insights.push(`Time management weakness — ${toRate}% of games end on time.`);
    if (resignations > checkmates) insights.push("Tends to resign rather than play to checkmate.");
  }

  // Game length
  if (profile.avgGameLength > 0) {
    if (profile.avgGameLength < 25) {
      insights.push(`Prefers short games (avg ${profile.avgGameLength} moves).`);
    } else if (profile.avgGameLength > 40) {
      insights.push(`Comfortable in long games (avg ${profile.avgGameLength} moves).`);
    }
  }

  return insights.slice(0, 8); // Cap at 8 insights
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

/**
 * Build a complete matchup preparation report for a chess.com player.
 */
export async function buildPrepReport(
  username: string,
  maxGames = 50
): Promise<PrepReport> {
  // Fetch games and stats in parallel
  const [games, ratings] = await Promise.all([
    fetchPlayerGames(username, maxGames),
    fetchPlayerStats(username),
  ]);

  // Analyze play style
  const profile = analyzePlayStyle(username, games, ratings);

  // Generate prep lines and insights
  const prepLines = generatePrepLines(profile);
  const insights = generateInsights(profile);

  return {
    opponent: profile,
    prepLines,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
