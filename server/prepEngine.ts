/**
 * Matchup Prep Engine — v2
 *
 * Fetches a chess.com player's recent games, classifies openings,
 * computes play-style statistics, and generates strategic preparation lines.
 *
 * Architecture:
 *   1. fetchPlayerGames()   — pulls recent games from chess.com archives API (100 games, 6 months)
 *   2. classifyOpening()    — maps first N moves to a named opening via 350+ ECO table
 *   3. analyzePlayStyle()   — aggregates stats: opening repertoire, color preference,
 *                             endgame tendencies, tactical patterns, time-control breakdown,
 *                             move-order tree, weakness scores
 *   4. generatePrepLines()  — suggests counter-openings based on opponent weaknesses
 *   5. buildPrepReport()    — orchestrates the full pipeline into a PrepReport
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
  /** How exploitable this opening is (0–100). High = low win rate + high frequency. */
  weaknessScore: number;
}

export interface TimeControlSplit {
  rapid: { games: number; winRate: number };
  blitz: { games: number; winRate: number };
  bullet: { games: number; winRate: number };
}

export interface MoveOrderNode {
  move: string;
  count: number;
  pct: number;
  children?: MoveOrderNode[];
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
  /** First-move preferences as white */
  firstMoveAsWhite: { move: string; count: number; pct: number }[];
  /** Second-move tree as white (after first move) */
  secondMoveTree: MoveOrderNode[];
  /** Average game length (in full moves) */
  avgGameLength: number;
  /** Win rate by time control */
  timeControlSplit: TimeControlSplit;
  /** Top openings broken down by time control */
  whiteOpeningsByTimeControl: { rapid: OpeningStat[]; blitz: OpeningStat[]; bullet: OpeningStat[] };
  blackOpeningsByTimeControl: { rapid: OpeningStat[]; blitz: OpeningStat[]; bullet: OpeningStat[] };
  /** Dominant time control (most games) */
  dominantTimeControl: "rapid" | "blitz" | "bullet" | "mixed";
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
  /** The specific weakness this line exploits */
  exploits?: string;
}

export interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  /** Key insights as short sentences */
  insights: string[];
  generatedAt: string;
}

// ─── ECO Opening Book (expanded — 350+ entries) ──────────────────────────────
// Maps normalized first-N-move sequences to opening names.
// Sorted by move length descending so longest (most specific) match wins.

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
  { eco: "A00", name: "Ware Opening", moves: "1.a4" },
  { eco: "A00", name: "Clemenz Opening", moves: "1.h3" },
  { eco: "A00", name: "Anderssen's Opening", moves: "1.a3" },
  { eco: "A01", name: "Larsen's Opening", moves: "1.b3" },
  { eco: "A01", name: "Larsen's Opening: Classical", moves: "1.b3 d5 2.Bb2 c5 3.e3 Nc6 4.Nf3" },
  { eco: "A02", name: "Bird's Opening", moves: "1.f4" },
  { eco: "A02", name: "Bird's Opening: From's Gambit", moves: "1.f4 e5 2.fxe5 d6" },
  { eco: "A03", name: "Bird's Opening: Dutch Variation", moves: "1.f4 d5" },
  { eco: "A03", name: "Bird's Opening: Lasker Variation", moves: "1.f4 d5 2.Nf3 Nf6 3.e3" },

  // A04–A09 — Reti / King's Indian Attack
  { eco: "A04", name: "Reti Opening", moves: "1.Nf3 d5 2.c4" },
  { eco: "A04", name: "Reti: King's Indian Attack", moves: "1.Nf3 d5 2.g3 Nf6 3.Bg2 e6 4.O-O Be7 5.d3" },
  { eco: "A05", name: "Reti Opening", moves: "1.Nf3 Nf6" },
  { eco: "A05", name: "Reti: Symmetrical", moves: "1.Nf3 Nf6 2.g3 g6 3.Bg2 Bg7 4.O-O O-O" },
  { eco: "A07", name: "King's Indian Attack", moves: "1.Nf3 d5 2.g3" },
  { eco: "A07", name: "King's Indian Attack: Keres Variation", moves: "1.Nf3 d5 2.g3 c5 3.Bg2 Nc6 4.O-O e6 5.d3" },
  { eco: "A08", name: "King's Indian Attack", moves: "1.Nf3 d5 2.g3 c5 3.Bg2" },
  { eco: "A09", name: "Reti: Advance Variation", moves: "1.Nf3 d5 2.c4 d4" },

  // A10–A39 — English Opening
  { eco: "A10", name: "English Opening", moves: "1.c4" },
  { eco: "A10", name: "English: Anglo-Dutch", moves: "1.c4 f5" },
  { eco: "A13", name: "English: Agincourt Defense", moves: "1.c4 e6" },
  { eco: "A13", name: "English: Agincourt, Catalan Defense", moves: "1.c4 e6 2.Nf3 d5 3.g3" },
  { eco: "A14", name: "English: Neo-Catalan Declined", moves: "1.c4 e6 2.Nf3 d5 3.g3 Nf6 4.Bg2 Be7 5.O-O O-O 6.b3" },
  { eco: "A15", name: "English: Anglo-Indian", moves: "1.c4 Nf6 2.Nf3" },
  { eco: "A16", name: "English: Anglo-Indian", moves: "1.c4 Nf6" },
  { eco: "A17", name: "English: Hedgehog", moves: "1.c4 Nf6 2.Nc3 e6" },
  { eco: "A17", name: "English: Hedgehog Defense", moves: "1.c4 Nf6 2.Nc3 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Be7 6.O-O O-O" },
  { eco: "A20", name: "English: Reversed Sicilian", moves: "1.c4 e5" },
  { eco: "A21", name: "English: Kramnik-Shirov Attack", moves: "1.c4 e5 2.Nc3 Bb4" },
  { eco: "A22", name: "English: Bremen System", moves: "1.c4 e5 2.Nc3 Nf6" },
  { eco: "A22", name: "English: Bremen, Smyslov System", moves: "1.c4 e5 2.Nc3 Nf6 3.g3 Bb4" },
  { eco: "A25", name: "English: Closed", moves: "1.c4 e5 2.Nc3 Nc6" },
  { eco: "A25", name: "English: Closed, Taimanov Variation", moves: "1.c4 e5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.e3 d6 6.Nge2" },
  { eco: "A26", name: "English: Closed, Botvinnik System", moves: "1.c4 e5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.e4" },
  { eco: "A29", name: "English: Four Knights", moves: "1.c4 e5 2.Nc3 Nf6 3.Nf3 Nc6" },
  { eco: "A30", name: "English: Symmetrical", moves: "1.c4 c5" },
  { eco: "A31", name: "English: Symmetrical, Benoni", moves: "1.c4 c5 2.Nf3 Nf6 3.d4" },
  { eco: "A34", name: "English: Symmetrical", moves: "1.c4 c5 2.Nc3" },
  { eco: "A35", name: "English: Symmetrical, Four Knights", moves: "1.c4 c5 2.Nc3 Nc6 3.Nf3 Nf6" },
  { eco: "A36", name: "English: Ultra-Symmetrical", moves: "1.c4 c5 2.Nc3 Nc6 3.g3" },
  { eco: "A37", name: "English: Symmetrical, Fianchetto", moves: "1.c4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.Nf3" },
  { eco: "A38", name: "English: Symmetrical, Main Line", moves: "1.c4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.Nf3 Nf6 6.O-O O-O" },

  // A40–A49 — Queen's Pawn misc, Torre, Trompowsky
  { eco: "A40", name: "Queen's Pawn Opening", moves: "1.d4 e6" },
  { eco: "A40", name: "Modern Defense: Averbakh", moves: "1.d4 g6" },
  { eco: "A41", name: "Queen's Pawn: Wade Defense", moves: "1.d4 d6" },
  { eco: "A41", name: "Queen's Pawn: Rat Defense", moves: "1.d4 d6 2.Nf3 g6 3.c4 Bg7" },
  { eco: "A43", name: "Old Benoni", moves: "1.d4 c5" },
  { eco: "A44", name: "Old Benoni: Czech Benoni", moves: "1.d4 c5 2.d5 e5" },
  { eco: "A45", name: "Trompowsky Attack", moves: "1.d4 Nf6 2.Bg5" },
  { eco: "A45", name: "Trompowsky: Raptor Variation", moves: "1.d4 Nf6 2.Bg5 Ne4 3.Bf4 c5 4.f3 Qa5+" },
  { eco: "A46", name: "Torre Attack", moves: "1.d4 Nf6 2.Nf3 e6 3.Bg5" },
  { eco: "A46", name: "Colle System", moves: "1.d4 Nf6 2.Nf3 e6 3.e3" },
  { eco: "A47", name: "Queen's Indian: Marienbad System", moves: "1.d4 Nf6 2.Nf3 b6" },
  { eco: "A48", name: "London System", moves: "1.d4 Nf6 2.Nf3 g6 3.Bf4" },
  { eco: "A48", name: "London System: Main Line", moves: "1.d4 d5 2.Nf3 Nf6 3.Bf4 e6 4.e3 Bd6 5.Bg3 O-O 6.Nbd2 c5" },

  // A50–A79 — Indian / Benoni / Benko
  { eco: "A50", name: "Indian Defense", moves: "1.d4 Nf6" },
  { eco: "A51", name: "Budapest Gambit", moves: "1.d4 Nf6 2.c4 e5" },
  { eco: "A52", name: "Budapest Gambit: Adler Variation", moves: "1.d4 Nf6 2.c4 e5 3.dxe5 Ng4" },
  { eco: "A53", name: "Old Indian Defense", moves: "1.d4 Nf6 2.c4 d6" },
  { eco: "A54", name: "Old Indian: Ukrainian Variation", moves: "1.d4 Nf6 2.c4 d6 3.Nc3 e5 4.Nf3 Nbd7" },
  { eco: "A55", name: "Old Indian: Main Line", moves: "1.d4 Nf6 2.c4 d6 3.Nc3 e5 4.Nf3 Nbd7 5.e4 Be7 6.Be2 O-O" },
  { eco: "A56", name: "Benoni Defense", moves: "1.d4 Nf6 2.c4 c5" },
  { eco: "A57", name: "Benko Gambit", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5" },
  { eco: "A58", name: "Benko Gambit Accepted", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5 4.cxb5 a6" },
  { eco: "A59", name: "Benko Gambit: Main Line", moves: "1.d4 Nf6 2.c4 c5 3.d5 b5 4.cxb5 a6 5.bxa6 Bxa6 6.Nc3 g6" },
  { eco: "A60", name: "Modern Benoni", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6" },
  { eco: "A61", name: "Modern Benoni: Fianchetto", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6 7.g3" },
  { eco: "A62", name: "Modern Benoni: Fianchetto, Main Line", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6 7.g3 Bg7 8.Bg2 O-O 9.O-O" },
  { eco: "A65", name: "Czech Benoni", moves: "1.d4 Nf6 2.c4 c5 3.d5 e5" },
  { eco: "A70", name: "Modern Benoni: Classical", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4" },
  { eco: "A71", name: "Modern Benoni: Classical, Taimanov", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.f4" },
  { eco: "A75", name: "Modern Benoni: Classical, 9.O-O", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.Nf3 Bg7 8.Be2 O-O 9.O-O" },
  { eco: "A78", name: "Modern Benoni: Classical, 9.O-O a6", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.Nf3 Bg7 8.Be2 O-O 9.O-O a6" },

  // A80–A99 — Dutch Defense
  { eco: "A80", name: "Dutch Defense", moves: "1.d4 f5" },
  { eco: "A81", name: "Dutch Defense", moves: "1.d4 f5 2.g3" },
  { eco: "A83", name: "Dutch: Staunton Gambit", moves: "1.d4 f5 2.e4" },
  { eco: "A84", name: "Dutch Defense", moves: "1.d4 f5 2.c4 Nf6" },
  { eco: "A85", name: "Dutch: Classical", moves: "1.d4 f5 2.c4 Nf6 3.Nc3" },
  { eco: "A86", name: "Dutch: Leningrad", moves: "1.d4 f5 2.c4 Nf6 3.g3 g6 4.Bg2 Bg7" },
  { eco: "A87", name: "Dutch: Leningrad", moves: "1.d4 f5 2.c4 Nf6 3.g3 g6" },
  { eco: "A88", name: "Dutch: Leningrad, Main Line", moves: "1.d4 f5 2.c4 Nf6 3.g3 g6 4.Bg2 Bg7 5.Nf3 O-O 6.O-O d6 7.Nc3 c6" },
  { eco: "A90", name: "Dutch: Stonewall", moves: "1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2 d5" },
  { eco: "A91", name: "Dutch: Classical, Nimzowitsch", moves: "1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2 Be7 5.Nf3 O-O 6.O-O d5" },
  { eco: "A92", name: "Dutch: Classical, Main Line", moves: "1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2 Be7 5.Nf3 O-O 6.O-O d6" },
  { eco: "A96", name: "Dutch: Classical, Ilyin-Zhenevsky", moves: "1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2 Be7 5.Nf3 O-O 6.O-O d6 7.Nc3 Qe8" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME B — Semi-Open Games (1.e4, Black plays other than 1...e5)
  // ═══════════════════════════════════════════════════════════════════════════

  // B00 — King's Pawn misc
  { eco: "B00", name: "King's Pawn Opening", moves: "1.e4" },
  { eco: "B00", name: "Nimzowitsch Defense", moves: "1.e4 Nc6" },
  { eco: "B00", name: "Owen's Defense", moves: "1.e4 b6" },
  { eco: "B00", name: "St. George Defense", moves: "1.e4 a6" },
  { eco: "B00", name: "Borg Defense", moves: "1.e4 g5" },

  // B01 — Scandinavian
  { eco: "B01", name: "Scandinavian Defense", moves: "1.e4 d5" },
  { eco: "B01", name: "Scandinavian: Mieses-Kotrč", moves: "1.e4 d5 2.exd5 Qxd5" },
  { eco: "B01", name: "Scandinavian: Modern", moves: "1.e4 d5 2.exd5 Nf6" },
  { eco: "B01", name: "Scandinavian: Icelandic Gambit", moves: "1.e4 d5 2.exd5 Nf6 3.c4 e6" },
  { eco: "B01", name: "Scandinavian: Portuguese Gambit", moves: "1.e4 d5 2.exd5 Nf6 3.d4 Bg4" },

  // B02–B05 — Alekhine's Defense
  { eco: "B02", name: "Alekhine's Defense", moves: "1.e4 Nf6" },
  { eco: "B03", name: "Alekhine's Defense: Four Pawns Attack", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.c4 Nb6 5.f4" },
  { eco: "B04", name: "Alekhine's Defense: Modern", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3" },
  { eco: "B05", name: "Alekhine's Defense: Modern, Main Line", moves: "1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 Bg4" },

  // B06–B09 — Modern / Pirc
  { eco: "B06", name: "Modern Defense", moves: "1.e4 g6" },
  { eco: "B06", name: "Modern Defense: Robatsch", moves: "1.e4 g6 2.d4 Bg7 3.Nc3 d6" },
  { eco: "B07", name: "Pirc Defense", moves: "1.e4 d6 2.d4 Nf6" },
  { eco: "B07", name: "Pirc Defense: 150 Attack", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2" },
  { eco: "B08", name: "Pirc: Classical", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3" },
  { eco: "B09", name: "Pirc: Austrian Attack", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4" },
  { eco: "B09", name: "Pirc: Austrian Attack, Main Line", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4 Bg7 5.Nf3 O-O 6.Bd3" },

  // B10–B19 — Caro-Kann
  { eco: "B10", name: "Caro-Kann Defense", moves: "1.e4 c6" },
  { eco: "B11", name: "Caro-Kann: Two Knights", moves: "1.e4 c6 2.Nc3 d5 3.Nf3" },
  { eco: "B12", name: "Caro-Kann: Advance Variation", moves: "1.e4 c6 2.d4 d5 3.e5" },
  { eco: "B12", name: "Caro-Kann: Advance, Short Variation", moves: "1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.Be2 Nd7 6.O-O" },
  { eco: "B13", name: "Caro-Kann: Exchange Variation", moves: "1.e4 c6 2.d4 d5 3.exd5 cxd5" },
  { eco: "B14", name: "Caro-Kann: Panov-Botvinnik Attack", moves: "1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4" },
  { eco: "B15", name: "Caro-Kann: Classical", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5" },
  { eco: "B17", name: "Caro-Kann: Steinitz Variation", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7" },
  { eco: "B18", name: "Caro-Kann: Classical, Main Line", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6" },
  { eco: "B19", name: "Caro-Kann: Classical, Spassky Variation", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3" },

  // B20–B99 — Sicilian Defense
  { eco: "B20", name: "Sicilian Defense", moves: "1.e4 c5" },
  { eco: "B21", name: "Sicilian: Smith-Morra Gambit", moves: "1.e4 c5 2.d4 cxd4 3.c3" },
  { eco: "B21", name: "Sicilian: Smith-Morra Accepted", moves: "1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3" },
  { eco: "B22", name: "Sicilian: Alapin Variation", moves: "1.e4 c5 2.c3" },
  { eco: "B22", name: "Sicilian: Alapin, Main Line", moves: "1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3" },
  { eco: "B23", name: "Sicilian: Closed", moves: "1.e4 c5 2.Nc3" },
  { eco: "B23", name: "Sicilian: Grand Prix Attack", moves: "1.e4 c5 2.Nc3 Nc6 3.f4" },
  { eco: "B23", name: "Sicilian: Grand Prix, Schofman Variation", moves: "1.e4 c5 2.Nc3 Nc6 3.f4 g6 4.Nf3 Bg7 5.Bc4" },
  { eco: "B24", name: "Sicilian: Closed, Keres Variation", moves: "1.e4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.Be3" },
  { eco: "B25", name: "Sicilian: Closed, Main Line", moves: "1.e4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.Be3 e5" },
  { eco: "B27", name: "Sicilian: Hyper-Accelerated Dragon", moves: "1.e4 c5 2.Nf3 g6" },
  { eco: "B28", name: "Sicilian: O'Kelly Variation", moves: "1.e4 c5 2.Nf3 a6" },
  { eco: "B29", name: "Sicilian: Nimzowitsch Variation", moves: "1.e4 c5 2.Nf3 Nf6" },
  { eco: "B30", name: "Sicilian: Old Sicilian", moves: "1.e4 c5 2.Nf3 Nc6" },
  { eco: "B32", name: "Sicilian: Open", moves: "1.e4 c5 2.Nf3 Nc6 3.d4" },
  { eco: "B33", name: "Sicilian: Sveshnikov", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5" },
  { eco: "B33", name: "Sicilian: Sveshnikov, Main Line", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3" },
  { eco: "B34", name: "Sicilian: Accelerated Dragon", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6" },
  { eco: "B35", name: "Sicilian: Accelerated Dragon, Modern", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.Nc3 Bg7 6.Be3 Nf6 7.Bc4" },
  { eco: "B36", name: "Sicilian: Maroczy Bind", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4" },
  { eco: "B40", name: "Sicilian: Kan Variation", moves: "1.e4 c5 2.Nf3 e6" },
  { eco: "B41", name: "Sicilian: Kan, Maroczy Bind", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.c4" },
  { eco: "B42", name: "Sicilian: Kan, Polugaevsky Variation", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Bd3" },
  { eco: "B43", name: "Sicilian: Kan, 5.Nc3", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Nc3" },
  { eco: "B44", name: "Sicilian: Taimanov", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6" },
  { eco: "B45", name: "Sicilian: Taimanov, American Attack", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3" },
  { eco: "B46", name: "Sicilian: Taimanov Variation", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 a6" },
  { eco: "B47", name: "Sicilian: Taimanov, Bastrikov Variation", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7" },
  { eco: "B48", name: "Sicilian: Taimanov, Main Line", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7 6.Be3" },
  { eco: "B50", name: "Sicilian Defense", moves: "1.e4 c5 2.Nf3 d6" },
  { eco: "B51", name: "Sicilian: Moscow Variation", moves: "1.e4 c5 2.Nf3 d6 3.Bb5+" },
  { eco: "B52", name: "Sicilian: Moscow Variation, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.Bb5+ Bd7 4.Bxd7+ Qxd7 5.O-O Nc6 6.c3" },
  { eco: "B54", name: "Sicilian: Open, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4" },
  { eco: "B56", name: "Sicilian: Classical", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6" },
  { eco: "B57", name: "Sicilian: Classical, Magnus Smith Trap", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Bc4 g6" },
  { eco: "B58", name: "Sicilian: Classical, Boleslavsky Variation", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Be2 e5" },
  { eco: "B60", name: "Sicilian: Najdorf", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6" },
  { eco: "B62", name: "Sicilian: Najdorf, Richter-Rauzer", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.Qd2" },
  { eco: "B63", name: "Sicilian: Richter-Rauzer, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Bg5 e6 7.Qd2 Be7 8.O-O-O O-O" },
  { eco: "B66", name: "Sicilian: Richter-Rauzer", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Bg5" },
  { eco: "B67", name: "Sicilian: Richter-Rauzer, 7...a6", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Bg5 e6 7.Qd2 a6" },
  { eco: "B70", name: "Sicilian: Dragon", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6" },
  { eco: "B72", name: "Sicilian: Dragon, Classical", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be2" },
  { eco: "B73", name: "Sicilian: Dragon, Classical, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be2 Bg7 7.O-O O-O" },
  { eco: "B76", name: "Sicilian: Dragon, Yugoslav Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3" },
  { eco: "B77", name: "Sicilian: Dragon, Yugoslav Attack, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.O-O-O" },
  { eco: "B78", name: "Sicilian: Dragon, Yugoslav, 9.Bc4", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.Bc4" },
  { eco: "B80", name: "Sicilian: Scheveningen", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6" },
  { eco: "B81", name: "Sicilian: Scheveningen, Keres Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.g4" },
  { eco: "B82", name: "Sicilian: Scheveningen, 6.f4", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.f4" },
  { eco: "B83", name: "Sicilian: Scheveningen, Modern", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Be2" },
  { eco: "B84", name: "Sicilian: Scheveningen, Classical", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Be2 a6" },
  { eco: "B85", name: "Sicilian: Scheveningen, Classical, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Be2 a6 7.O-O Qc7 8.f4" },
  { eco: "B86", name: "Sicilian: Sozin Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Bc4" },
  { eco: "B87", name: "Sicilian: Sozin with ...a6 and ...b5", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Bc4 a6 7.Bb3 b5" },
  { eco: "B88", name: "Sicilian: Sozin, Fischer Variation", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Bc4 Nc6" },
  { eco: "B90", name: "Sicilian: Najdorf, English Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3" },
  { eco: "B91", name: "Sicilian: Najdorf, Zagreb Variation", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.g3" },
  { eco: "B92", name: "Sicilian: Najdorf, Opocensky Variation", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2" },
  { eco: "B93", name: "Sicilian: Najdorf, 6.f4", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.f4" },
  { eco: "B94", name: "Sicilian: Najdorf, 6.Bg5", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5" },
  { eco: "B95", name: "Sicilian: Najdorf, 6.Bg5 e6", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6" },
  { eco: "B96", name: "Sicilian: Najdorf, Poisoned Pawn", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Qb6" },
  { eco: "B97", name: "Sicilian: Najdorf, Poisoned Pawn Accepted", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Qb6 8.Qd2 Qxb2" },
  { eco: "B98", name: "Sicilian: Najdorf, Browne Variation", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Be7 8.Qf3 Qc7" },
  { eco: "B99", name: "Sicilian: Najdorf, Main Line", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Be7 8.Qf3 Qc7 9.O-O-O Nbd7" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME C — French Defense & Open Games (1.e4 e5)
  // ═══════════════════════════════════════════════════════════════════════════

  // C00–C19 — French Defense
  { eco: "C00", name: "French Defense", moves: "1.e4 e6" },
  { eco: "C01", name: "French: Exchange Variation", moves: "1.e4 e6 2.d4 d5 3.exd5" },
  { eco: "C02", name: "French: Advance Variation", moves: "1.e4 e6 2.d4 d5 3.e5" },
  { eco: "C02", name: "French: Advance, Wade Variation", moves: "1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Bd7" },
  { eco: "C03", name: "French: Tarrasch Variation", moves: "1.e4 e6 2.d4 d5 3.Nd2" },
  { eco: "C05", name: "French: Tarrasch, Closed", moves: "1.e4 e6 2.d4 d5 3.Nd2 Nf6 4.e5 Nfd7 5.Bd3 c5 6.c3 Nc6 7.Ne2" },
  { eco: "C06", name: "French: Classical", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6" },
  { eco: "C07", name: "French: Tarrasch, Open", moves: "1.e4 e6 2.d4 d5 3.Nd2 c5 4.exd5" },
  { eco: "C08", name: "French: Tarrasch, Open, 4.exd5 exd5", moves: "1.e4 e6 2.d4 d5 3.Nd2 c5 4.exd5 exd5 5.Ngf3 Nc6" },
  { eco: "C09", name: "French: Tarrasch, Open, Main Line", moves: "1.e4 e6 2.d4 d5 3.Nd2 c5 4.exd5 exd5 5.Ngf3 Nc6 6.Bb5" },
  { eco: "C10", name: "French: Rubinstein Variation", moves: "1.e4 e6 2.d4 d5 3.Nc3 dxe4" },
  { eco: "C11", name: "French: Winawer", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4" },
  { eco: "C12", name: "French: MacCutcheon Variation", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Bb4" },
  { eco: "C13", name: "French: Classical, Richter Attack", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7 6.h4" },
  { eco: "C14", name: "French: Classical, Steinitz Variation", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7 6.Bxe7 Qxe7" },
  { eco: "C15", name: "French: Winawer, Main Line", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5" },
  { eco: "C16", name: "French: Winawer, Advance", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 b6" },
  { eco: "C17", name: "French: Winawer, Advance, 5.a3", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3" },
  { eco: "C18", name: "French: Winawer, Poisoned Pawn", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Qc7" },
  { eco: "C19", name: "French: Winawer, Advance, 6...Ne7", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7 7.Qg4" },

  // C20–C29 — Open Game misc
  { eco: "C20", name: "King's Pawn Game", moves: "1.e4 e5" },
  { eco: "C21", name: "Center Game", moves: "1.e4 e5 2.d4 exd4 3.Qxd4" },
  { eco: "C21", name: "Danish Gambit", moves: "1.e4 e5 2.d4 exd4 3.c3" },
  { eco: "C22", name: "Center Game: Paulsen Attack", moves: "1.e4 e5 2.d4 exd4 3.Qxd4 Nc6 4.Qe3" },
  { eco: "C23", name: "Bishop's Opening", moves: "1.e4 e5 2.Bc4" },
  { eco: "C24", name: "Bishop's Opening: Berlin Defense", moves: "1.e4 e5 2.Bc4 Nf6" },
  { eco: "C25", name: "Vienna Game", moves: "1.e4 e5 2.Nc3" },
  { eco: "C26", name: "Vienna: Falkbeer Variation", moves: "1.e4 e5 2.Nc3 Nf6" },
  { eco: "C27", name: "Vienna Game: Frankenstein-Dracula", moves: "1.e4 e5 2.Nc3 Nf6 3.Bc4 Nxe4" },
  { eco: "C28", name: "Vienna Game: Vienna Gambit", moves: "1.e4 e5 2.Nc3 Nc6 3.Bc4 Bc5 4.f4" },
  { eco: "C29", name: "Vienna Gambit", moves: "1.e4 e5 2.Nc3 Nf6 3.f4" },

  // C30–C39 — King's Gambit
  { eco: "C30", name: "King's Gambit", moves: "1.e4 e5 2.f4" },
  { eco: "C30", name: "King's Gambit Declined", moves: "1.e4 e5 2.f4 Bc5" },
  { eco: "C31", name: "King's Gambit: Falkbeer Counter-Gambit", moves: "1.e4 e5 2.f4 d5" },
  { eco: "C33", name: "King's Gambit Accepted", moves: "1.e4 e5 2.f4 exf4" },
  { eco: "C34", name: "King's Gambit: Fischer Defense", moves: "1.e4 e5 2.f4 exf4 3.Nf3 d6" },
  { eco: "C35", name: "King's Gambit: Cunningham Defense", moves: "1.e4 e5 2.f4 exf4 3.Nf3 Be7" },
  { eco: "C36", name: "King's Gambit: Abbazia Defense", moves: "1.e4 e5 2.f4 exf4 3.Nf3 d5" },
  { eco: "C37", name: "King's Gambit: Muzio Gambit", moves: "1.e4 e5 2.f4 exf4 3.Nf3 g5 4.Bc4 g4 5.O-O" },
  { eco: "C38", name: "King's Gambit: Hanstein Gambit", moves: "1.e4 e5 2.f4 exf4 3.Nf3 g5 4.Bc4 Bg7" },
  { eco: "C39", name: "King's Gambit: Kieseritzky Gambit", moves: "1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5" },

  // C40–C49 — Open Game: Petrov, Philidor, Scotch, Four Knights
  { eco: "C40", name: "Latvian Gambit", moves: "1.e4 e5 2.Nf3 f5" },
  { eco: "C41", name: "Philidor Defense", moves: "1.e4 e5 2.Nf3 d6" },
  { eco: "C41", name: "Philidor: Hanham Variation", moves: "1.e4 e5 2.Nf3 d6 3.d4 Nd7" },
  { eco: "C42", name: "Petrov's Defense", moves: "1.e4 e5 2.Nf3 Nf6" },
  { eco: "C42", name: "Petrov: Classical Attack", moves: "1.e4 e5 2.Nf3 Nf6 3.Nxe5 d6 4.Nf3 Nxe4 5.d4 d5 6.Bd3" },
  { eco: "C43", name: "Petrov: Steinitz Attack", moves: "1.e4 e5 2.Nf3 Nf6 3.d4" },
  { eco: "C44", name: "Scotch Game", moves: "1.e4 e5 2.Nf3 Nc6 3.d4" },
  { eco: "C45", name: "Scotch Game: Classical", moves: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4" },
  { eco: "C45", name: "Scotch Game: Mieses Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4" },
  { eco: "C46", name: "Three Knights Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3" },
  { eco: "C47", name: "Four Knights Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6" },
  { eco: "C48", name: "Four Knights: Spanish", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6 4.Bb5" },
  { eco: "C49", name: "Four Knights: Symmetrical", moves: "1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6 4.Bb5 Bb4" },

  // C50–C59 — Italian Game / Two Knights
  { eco: "C50", name: "Italian Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4" },
  { eco: "C50", name: "Giuoco Piano", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5" },
  { eco: "C51", name: "Evans Gambit", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4" },
  { eco: "C52", name: "Evans Gambit: Accepted", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4" },
  { eco: "C53", name: "Giuoco Piano: Main Line", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3" },
  { eco: "C54", name: "Giuoco Piano: Greco Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+" },
  { eco: "C55", name: "Two Knights Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6" },
  { eco: "C56", name: "Two Knights: Perreux Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4 exd4 5.O-O" },
  { eco: "C57", name: "Two Knights: Fried Liver Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5" },
  { eco: "C58", name: "Two Knights: Max Lange Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4" },
  { eco: "C59", name: "Two Knights: Main Line", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Be2 h6 9.Nf3" },

  // C60–C99 — Ruy Lopez
  { eco: "C60", name: "Ruy Lopez", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" },
  { eco: "C61", name: "Ruy Lopez: Bird's Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nd4" },
  { eco: "C62", name: "Ruy Lopez: Old Steinitz Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 d6" },
  { eco: "C63", name: "Ruy Lopez: Schliemann Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5" },
  { eco: "C64", name: "Ruy Lopez: Classical Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Bc5" },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6" },
  { eco: "C66", name: "Ruy Lopez: Berlin, Improved Steinitz", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O d6" },
  { eco: "C67", name: "Ruy Lopez: Berlin, Rio de Janeiro", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4" },
  { eco: "C68", name: "Ruy Lopez: Exchange Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6" },
  { eco: "C69", name: "Ruy Lopez: Exchange, Gligoric Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.O-O f6" },
  { eco: "C70", name: "Ruy Lopez: Morphy Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6" },
  { eco: "C71", name: "Ruy Lopez: Modern Steinitz", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6" },
  { eco: "C72", name: "Ruy Lopez: Modern Steinitz, 5.O-O", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.O-O" },
  { eco: "C73", name: "Ruy Lopez: Modern Steinitz, Richter Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.Bxc6+" },
  { eco: "C74", name: "Ruy Lopez: Modern Steinitz, Siesta Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.c3 f5" },
  { eco: "C75", name: "Ruy Lopez: Modern Steinitz, 5.c3", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.c3 Bd7" },
  { eco: "C76", name: "Ruy Lopez: Modern Steinitz, Fianchetto", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.c3 g6" },
  { eco: "C77", name: "Ruy Lopez: Morphy Defense, Anderssen Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.d3" },
  { eco: "C78", name: "Ruy Lopez: Archangel", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O b5" },
  { eco: "C79", name: "Ruy Lopez: Steinitz Defense Deferred", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O d6" },
  { eco: "C80", name: "Ruy Lopez: Open Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4" },
  { eco: "C81", name: "Ruy Lopez: Open, Howell Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.Qe2" },
  { eco: "C82", name: "Ruy Lopez: Open, Berlin Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.c3" },
  { eco: "C83", name: "Ruy Lopez: Open, Classical Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.c3 Bc5" },
  { eco: "C84", name: "Ruy Lopez: Closed", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7" },
  { eco: "C85", name: "Ruy Lopez: Closed, Exchange Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Bxc6" },
  { eco: "C86", name: "Ruy Lopez: Worrall Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Qe2" },
  { eco: "C87", name: "Ruy Lopez: Closed, Averbakh Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 d6" },
  { eco: "C88", name: "Ruy Lopez: Closed, Anti-Marshall", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.a4" },
  { eco: "C89", name: "Ruy Lopez: Marshall Attack", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5" },
  { eco: "C90", name: "Ruy Lopez: Closed, Pilnik Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O" },
  { eco: "C91", name: "Ruy Lopez: Closed, Bogoljubow Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.d4" },
  { eco: "C92", name: "Ruy Lopez: Zaitsev System", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Bb7" },
  { eco: "C93", name: "Ruy Lopez: Smyslov Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 h6" },
  { eco: "C94", name: "Ruy Lopez: Morphy Defense, Breyer Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nd7" },
  { eco: "C95", name: "Ruy Lopez: Breyer Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8" },
  { eco: "C96", name: "Ruy Lopez: Closed, Chigorin Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5" },
  { eco: "C97", name: "Ruy Lopez: Closed, Chigorin, Main Line", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4" },
  { eco: "C98", name: "Ruy Lopez: Closed, Chigorin, 12.Nbd2", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2" },
  { eco: "C99", name: "Ruy Lopez: Closed, Chigorin, 12.Nbd2 cxd4", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 cxd4 13.cxd4" },

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
  { eco: "D09", name: "QGD: Albin Counter-Gambit, Fianchetto", moves: "1.d4 d5 2.c4 e5 3.dxe5 d4 4.Nf3 Nc6 5.g3" },
  { eco: "D10", name: "Slav Defense", moves: "1.d4 d5 2.c4 c6" },
  { eco: "D11", name: "Slav: Modern", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6" },
  { eco: "D12", name: "Slav: London System", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.e3 Bf5" },
  { eco: "D13", name: "Slav: Exchange Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.cxd5 cxd5" },
  { eco: "D14", name: "Slav: Exchange, Symmetrical", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.cxd5 cxd5 5.Nc3 Nc6 6.Bf4 Bf5" },
  { eco: "D15", name: "Slav: Geller Gambit", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4" },
  { eco: "D16", name: "Slav: Smyslov Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Na6" },
  { eco: "D17", name: "Slav: Czech Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5" },
  { eco: "D18", name: "Slav: Czech, Main Line", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5 6.e3 e6 7.Bxc4 Bb4" },
  { eco: "D19", name: "Slav: Czech, Dutch Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5 6.e3 e6 7.Bxc4 Bb4 8.O-O O-O 9.Qe2" },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: "1.d4 d5 2.c4 dxc4" },
  { eco: "D21", name: "QGA: Alekhine Defense", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 a6" },
  { eco: "D22", name: "QGA: Alekhine Defense, Alatortsev Variation", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 a6 4.e3 Bg4" },
  { eco: "D23", name: "QGA: 3.Nf3", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6" },
  { eco: "D24", name: "QGA: Accelerated Slav", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.Nc3" },
  { eco: "D25", name: "QGA: Janowski-Larsen Variation", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 Bg4" },
  { eco: "D26", name: "QGA: Classical Variation", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6" },
  { eco: "D27", name: "QGA: Classical, 6.O-O", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O" },
  { eco: "D28", name: "QGA: Classical, Main Line", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O a6" },
  { eco: "D29", name: "QGA: Classical, 8.Qe2", moves: "1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O a6 7.Bb3 b5 8.Qe2" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: "1.d4 d5 2.c4 e6" },
  { eco: "D31", name: "QGD: Semi-Tarrasch", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5" },
  { eco: "D32", name: "QGD: Tarrasch Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 c5" },
  { eco: "D33", name: "QGD: Tarrasch, Schlechter-Rubinstein", moves: "1.d4 d5 2.c4 e6 3.Nc3 c5 4.cxd5 exd5 5.Nf3 Nc6 6.g3" },
  { eco: "D34", name: "QGD: Tarrasch, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 c5 4.cxd5 exd5 5.Nf3 Nc6 6.g3 Nf6 7.Bg2 Be7 8.O-O O-O" },
  { eco: "D35", name: "QGD: Exchange Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5" },
  { eco: "D36", name: "QGD: Exchange, Positional Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 c6 6.Qc2 Be7 7.e3 Nbd7 8.Bd3 O-O 9.Nge2" },
  { eco: "D37", name: "QGD: Classical", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Be7" },
  { eco: "D38", name: "QGD: Ragozin Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Bb4" },
  { eco: "D39", name: "QGD: Ragozin, Vienna Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Bb4 5.Bg5 dxc4 6.e4 b5 7.e5 h6 8.Bh4 g5 9.Nxg5 hxg5 10.Bxg5 Nbd7" },
  { eco: "D40", name: "QGD: Semi-Tarrasch, 4.e3", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5 5.e3" },
  { eco: "D41", name: "QGD: Semi-Tarrasch, 5.cxd5", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5 5.cxd5 Nxd5" },
  { eco: "D42", name: "QGD: Semi-Tarrasch, 7.Bd3", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 c5 5.cxd5 Nxd5 6.e3 Nc6 7.Bd3" },
  { eco: "D43", name: "Semi-Slav Defense", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6" },
  { eco: "D44", name: "Semi-Slav: Botvinnik System", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.Bg5 dxc4" },
  { eco: "D45", name: "Semi-Slav: Meran Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7" },
  { eco: "D46", name: "Semi-Slav: Main Line", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3" },
  { eco: "D47", name: "Semi-Slav: Bishop's Attack", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4" },
  { eco: "D48", name: "Semi-Slav: Meran, Main Line", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 8.Bd3" },
  { eco: "D49", name: "Semi-Slav: Meran, Blumenfeld Variation", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 8.Bd3 a6 9.e4 c5 10.e5 cxd4 11.Nxb5" },

  // D50–D69 — QGD: Orthodox / Tartakower
  { eco: "D50", name: "QGD: Orthodox", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5" },
  { eco: "D51", name: "QGD: Manhattan Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7" },
  { eco: "D52", name: "QGD: Cambridge Springs", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.e3 c6 6.Nf3 Qa5" },
  { eco: "D53", name: "QGD: Lasker Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Ne4" },
  { eco: "D54", name: "QGD: Anti-Neo-Orthodox Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Qc2 c5" },
  { eco: "D55", name: "QGD: Neo-Orthodox Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6" },
  { eco: "D56", name: "QGD: Lasker Defense, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Ne4 7.Bxe7 Qxe7 8.cxd5 Nxc3 9.bxc3 exd5" },
  { eco: "D57", name: "QGD: Lasker Defense, Bernstein Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Ne4 7.Bxe7 Qxe7 8.cxd5 Nxc3 9.bxc3 exd5 10.Qb3" },
  { eco: "D58", name: "QGD: Tartakower", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6" },
  { eco: "D59", name: "QGD: Tartakower, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6 8.cxd5 Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5" },
  { eco: "D60", name: "QGD: Orthodox, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7" },
  { eco: "D61", name: "QGD: Orthodox, Rubinstein Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Qc2 c5" },
  { eco: "D62", name: "QGD: Orthodox, Rubinstein, Fianchetto", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Qc2 c5 8.cxd5 Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5 11.Rc1 Ne6 12.g3" },
  { eco: "D63", name: "QGD: Orthodox, 7.Rc1", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1" },
  { eco: "D64", name: "QGD: Orthodox, Capablanca System", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3" },
  { eco: "D65", name: "QGD: Orthodox, Capablanca, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5" },
  { eco: "D66", name: "QGD: Orthodox, Bd3 Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 a6" },
  { eco: "D67", name: "QGD: Orthodox, Bd3, Capablanca Freeing Maneuver", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 10.Bxe7 Qxe7 11.O-O Nxc3 12.Rxc3 e5" },
  { eco: "D69", name: "QGD: Orthodox, Classical, Main Line", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 10.Bxe7 Qxe7 11.O-O Nxc3 12.Rxc3 e5 13.dxe5 Nxe5 14.Nxe5 Qxe5" },

  // D70–D99 — Grünfeld Defense
  { eco: "D70", name: "Grünfeld Defense", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5" },
  { eco: "D71", name: "Grünfeld: Russian Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3" },
  { eco: "D72", name: "Grünfeld: Russian, Prins Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Nf3 O-O 8.Be2 c5 9.O-O Nc6 10.Be3" },
  { eco: "D73", name: "Grünfeld: Neo-Grünfeld", moves: "1.d4 Nf6 2.c4 g6 3.g3 d5" },
  { eco: "D74", name: "Grünfeld: Neo-Grünfeld, 6.cxd5", moves: "1.d4 Nf6 2.c4 g6 3.g3 d5 4.Bg2 Bg7 5.Nf3 O-O 6.cxd5 Nxd5" },
  { eco: "D75", name: "Grünfeld: Neo-Grünfeld, 6.cxd5 Nxd5 7.O-O", moves: "1.d4 Nf6 2.c4 g6 3.g3 d5 4.Bg2 Bg7 5.Nf3 O-O 6.cxd5 Nxd5 7.O-O" },
  { eco: "D76", name: "Grünfeld: Russian System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.e3" },
  { eco: "D77", name: "Grünfeld: Three Knights, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nf3 Bg7 4.g3 d5 5.Bg2 O-O 6.O-O dxc4" },
  { eco: "D78", name: "Grünfeld: Neo-Grünfeld, 6.O-O c6", moves: "1.d4 Nf6 2.c4 g6 3.g3 d5 4.Bg2 Bg7 5.Nf3 O-O 6.O-O c6" },
  { eco: "D79", name: "Grünfeld: Neo-Grünfeld, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.g3 d5 4.Bg2 Bg7 5.Nf3 O-O 6.O-O c6 7.cxd5 cxd5 8.Ne5" },
  { eco: "D80", name: "Grünfeld: Stockholm Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Bg5" },
  { eco: "D81", name: "Grünfeld: Russian Variation, Accelerated", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Qb3" },
  { eco: "D82", name: "Grünfeld: 4.Bf4", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Bf4" },
  { eco: "D83", name: "Grünfeld: Accelerated Russian", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Bf4 Bg7 5.e3 O-O 6.Qb3" },
  { eco: "D84", name: "Grünfeld: Accelerated Russian, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Bf4 Bg7 5.e3 O-O 6.Qb3 dxc4 7.Bxc4 c5 8.d5" },
  { eco: "D85", name: "Grünfeld: Exchange Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5" },
  { eco: "D86", name: "Grünfeld: Exchange, Classical Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Bc4 O-O 8.Ne2" },
  { eco: "D87", name: "Grünfeld: Exchange, Spassky Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Bc4 O-O 8.Be3 c5 9.Ne2" },
  { eco: "D88", name: "Grünfeld: Spassky, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Bc4 O-O 8.Be3 c5 9.Ne2 Nc6 10.O-O" },
  { eco: "D89", name: "Grünfeld: Spassky, Main Line, 13.Bd3", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Bc4 O-O 8.Be3 c5 9.Ne2 Nc6 10.O-O Bg4 11.f3 Na5 12.Bxf7+ Rxf7 13.fxg4 Rxf1+ 14.Kxf1" },
  { eco: "D90", name: "Grünfeld: Three Knights", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3" },
  { eco: "D91", name: "Grünfeld: Three Knights, Petrosian System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Bg5" },
  { eco: "D92", name: "Grünfeld: 5.Bf4", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Bf4" },
  { eco: "D93", name: "Grünfeld: 5.Bf4 O-O", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Bf4 O-O 6.Rc1" },
  { eco: "D94", name: "Grünfeld: Closed Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.e3 O-O 6.Bd3" },
  { eco: "D95", name: "Grünfeld: Closed, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.e3 O-O 6.Bd3 c5 7.O-O" },
  { eco: "D96", name: "Grünfeld: Russian Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3 dxc4 6.Qxc4" },
  { eco: "D97", name: "Grünfeld: Russian, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3 dxc4 6.Qxc4 O-O 7.e4 a6 8.e5 b5 9.Qb3 Nfd7 10.e6" },
  { eco: "D98", name: "Grünfeld: Russian, Smyslov Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3 dxc4 6.Qxc4 O-O 7.e4 Bg4" },
  { eco: "D99", name: "Grünfeld: Russian, Main Line, 9.Rc1", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3 dxc4 6.Qxc4 O-O 7.e4 a6 8.e5 b5 9.Qb3 Nfd7 10.e6 fxe6 11.Ng5 Nf6 12.Nxe6 Qd7 13.Nxf8 Rxf8 14.Be2 Bb7 15.O-O Nbd7 16.Bg5 Rc8 17.Rc1" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME E — Indian Defenses (1.d4 Nf6)
  // ═══════════════════════════════════════════════════════════════════════════

  // E00–E09 — Catalan
  { eco: "E00", name: "Catalan Opening", moves: "1.d4 Nf6 2.c4 e6 3.g3" },
  { eco: "E01", name: "Catalan: Closed", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2" },
  { eco: "E02", name: "Catalan: Open, 5.Qa4", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 5.Qa4+" },
  { eco: "E03", name: "Catalan: Open, Alekhine Variation", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 5.Qa4+ Nbd7 6.Qxc4 a6 7.Qd3" },
  { eco: "E04", name: "Catalan: Open", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4" },
  { eco: "E05", name: "Catalan: Open, Classical Line", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 5.Nf3 Be7 6.O-O O-O 7.Qc2" },
  { eco: "E06", name: "Catalan: Closed, 5.Nf3", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3" },
  { eco: "E07", name: "Catalan: Closed, 6.O-O", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O" },
  { eco: "E08", name: "Catalan: Closed, 7.Qc2", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O Nbd7 7.Qc2" },
  { eco: "E09", name: "Catalan: Closed, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O Nbd7 7.Qc2 c6 8.Nbd2" },

  // E10–E19 — Queen's Indian / Bogo-Indian
  { eco: "E10", name: "Queen's Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6" },
  { eco: "E11", name: "Bogo-Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+" },
  { eco: "E12", name: "Queen's Indian: Petrosian System", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.a3" },
  { eco: "E13", name: "Queen's Indian: Petrosian, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.a3 Bb7 5.Nc3 d5 6.cxd5 Nxd5 7.Qc2" },
  { eco: "E14", name: "Queen's Indian: 4.e3", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.e3 Bb7 5.Bd3 d5" },
  { eco: "E15", name: "Queen's Indian: Fianchetto", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3" },
  { eco: "E16", name: "Queen's Indian: Capablanca Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Bb4+" },
  { eco: "E17", name: "Queen's Indian: Classical", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Be7" },
  { eco: "E18", name: "Queen's Indian: Classical, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Be7 6.O-O O-O 7.Nc3 Ne4" },
  { eco: "E19", name: "Queen's Indian: Classical, 10.Qxc3", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 5.Bg2 Be7 6.O-O O-O 7.Nc3 Ne4 8.Qc2 Nxc3 9.Qxc3 f5 10.b3 Bf6 11.Bb2" },

  // E20–E59 — Nimzo-Indian
  { eco: "E20", name: "Nimzo-Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4" },
  { eco: "E21", name: "Nimzo-Indian: Three Knights", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Nf3" },
  { eco: "E22", name: "Nimzo-Indian: Spielmann Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qb3" },
  { eco: "E23", name: "Nimzo-Indian: Spielmann, 4...c5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qb3 c5 5.dxc5 Nc6" },
  { eco: "E24", name: "Nimzo-Indian: Samisch", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3" },
  { eco: "E25", name: "Nimzo-Indian: Samisch, Keres Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3 c5 6.f3 d5 7.cxd5 Nxd5" },
  { eco: "E26", name: "Nimzo-Indian: Samisch, 4.a3 Bxc3+ 5.bxc3 c5 6.e3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3 c5 6.e3" },
  { eco: "E27", name: "Nimzo-Indian: Samisch, 5...O-O", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3 O-O" },
  { eco: "E28", name: "Nimzo-Indian: Samisch, 6.e3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3 O-O 6.e3" },
  { eco: "E29", name: "Nimzo-Indian: Samisch, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3 O-O 6.e3 c5 7.Bd3 Nc6 8.Ne2 b6" },
  { eco: "E30", name: "Nimzo-Indian: Leningrad Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Bg5" },
  { eco: "E31", name: "Nimzo-Indian: Leningrad, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Bg5 h6 5.Bh4 c5 6.d5 d6 7.e3 Bxc3+ 8.bxc3 e5" },
  { eco: "E32", name: "Nimzo-Indian: Classical", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2" },
  { eco: "E33", name: "Nimzo-Indian: Classical, Milner-Barry Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 Nc6" },
  { eco: "E34", name: "Nimzo-Indian: Classical, Noa Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 d5" },
  { eco: "E35", name: "Nimzo-Indian: Classical, Noa, 5.cxd5 exd5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 d5 5.cxd5 exd5 6.Bg5 h6 7.Bh4" },
  { eco: "E36", name: "Nimzo-Indian: Classical, Noa, 5.a3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 d5 5.a3 Bxc3+ 6.Qxc3" },
  { eco: "E37", name: "Nimzo-Indian: Classical, Noa, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 d5 5.a3 Bxc3+ 6.Qxc3 Ne4 7.Qc2 Nc6 8.e3 e5" },
  { eco: "E38", name: "Nimzo-Indian: Classical, 4...c5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 c5" },
  { eco: "E39", name: "Nimzo-Indian: Classical, Pirc Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 c5 5.dxc5 O-O 6.a3 Bxc5 7.Nf3 Nc6 8.Bg5" },
  { eco: "E40", name: "Nimzo-Indian: 4.e3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3" },
  { eco: "E41", name: "Nimzo-Indian: Hübner", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5" },
  { eco: "E42", name: "Nimzo-Indian: 4.e3 c5, 5.Ne2", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5 5.Ne2" },
  { eco: "E43", name: "Nimzo-Indian: Fischer Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 b6" },
  { eco: "E44", name: "Nimzo-Indian: Fischer, 5.Ne2 Ba6", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 b6 5.Ne2 Ba6" },
  { eco: "E45", name: "Nimzo-Indian: 4.e3 b6, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 b6 5.Ne2 Ba6 6.a3 Bxc3+ 7.Nxc3" },
  { eco: "E46", name: "Nimzo-Indian: Reshevsky", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O" },
  { eco: "E47", name: "Nimzo-Indian: 4.e3 O-O, 5.Bd3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Bd3" },
  { eco: "E48", name: "Nimzo-Indian: 4.e3 O-O, 5.Bd3 d5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Bd3 d5" },
  { eco: "E49", name: "Nimzo-Indian: 4.e3 O-O, 5.Bd3 d5 6.a3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Bd3 d5 6.a3 Bxc3+ 7.bxc3 c5" },
  { eco: "E50", name: "Nimzo-Indian: 4.e3 O-O, 5.Nf3", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3" },
  { eco: "E51", name: "Nimzo-Indian: 4.e3 O-O, 5.Nf3 d5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5" },
  { eco: "E52", name: "Nimzo-Indian: 4.e3, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 c5" },
  { eco: "E53", name: "Nimzo-Indian: 4.e3, Keres Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 c5 7.O-O Nc6" },
  { eco: "E54", name: "Nimzo-Indian: 4.e3, Gligoric System", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 c5 7.O-O cxd4 8.exd4" },
  { eco: "E55", name: "Nimzo-Indian: 4.e3, Gligoric, Bronstein Variation", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 c5 7.O-O cxd4 8.exd4 dxc4 9.Bxc4" },
  { eco: "E56", name: "Nimzo-Indian: 4.e3, Main Line", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 Nc6" },
  { eco: "E57", name: "Nimzo-Indian: 4.e3, Main Line, 8.cxd5", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 Nc6 7.O-O cxd4 8.exd4" },
  { eco: "E58", name: "Nimzo-Indian: 4.e3, Main Line, 8.Bxc4", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 Nc6 7.O-O dxc4 8.Bxc4" },
  { eco: "E59", name: "Nimzo-Indian: 4.e3, Main Line, 9.O-O", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nf3 d5 6.Bd3 Nc6 7.O-O dxc4 8.Bxc4 cxd4 9.exd4" },

  // E60–E99 — King's Indian Defense
  { eco: "E60", name: "King's Indian Defense", moves: "1.d4 Nf6 2.c4 g6" },
  { eco: "E61", name: "King's Indian: Three Pawns Attack", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4" },
  { eco: "E62", name: "King's Indian: Fianchetto", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3" },
  { eco: "E63", name: "King's Indian: Fianchetto, Panno Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 Nc6 7.O-O a6" },
  { eco: "E64", name: "King's Indian: Fianchetto, Yugoslav", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 c5" },
  { eco: "E65", name: "King's Indian: Fianchetto, Yugoslav, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 c5 7.O-O Nc6 8.d5 Na5" },
  { eco: "E66", name: "King's Indian: Fianchetto, Sämisch Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 c5 7.O-O Nc6 8.d5 Ne5" },
  { eco: "E67", name: "King's Indian: Fianchetto, Classical", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 Nbd7 7.O-O e5" },
  { eco: "E68", name: "King's Indian: Fianchetto, Classical, 8.e4", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 Nbd7 7.O-O e5 8.e4" },
  { eco: "E69", name: "King's Indian: Fianchetto, Classical, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 O-O 5.g3 d6 6.Bg2 Nbd7 7.O-O e5 8.e4 c6 9.h3" },
  { eco: "E70", name: "King's Indian: 4.e4", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4" },
  { eco: "E71", name: "King's Indian: Makogonov System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.h3" },
  { eco: "E72", name: "King's Indian: Averbakh System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Be2 O-O 6.Bg5" },
  { eco: "E73", name: "King's Indian: Averbakh, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Be2 O-O 6.Bg5 c5" },
  { eco: "E74", name: "King's Indian: Averbakh, 6...c5 7.d5", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Be2 O-O 6.Bg5 c5 7.d5" },
  { eco: "E75", name: "King's Indian: Averbakh, Main Line, 7...a6", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Be2 O-O 6.Bg5 c5 7.d5 a6" },
  { eco: "E76", name: "King's Indian: Four Pawns Attack", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4" },
  { eco: "E77", name: "King's Indian: Four Pawns Attack, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4 O-O 6.Nf3" },
  { eco: "E78", name: "King's Indian: Four Pawns Attack, 6.Be2", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4 O-O 6.Be2" },
  { eco: "E79", name: "King's Indian: Four Pawns Attack, 6.Be2 c5", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f4 O-O 6.Be2 c5 7.d5" },
  { eco: "E80", name: "King's Indian: Sämisch Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3" },
  { eco: "E81", name: "King's Indian: Sämisch, 5...O-O", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3" },
  { eco: "E82", name: "King's Indian: Sämisch, Double Fianchetto", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 b6" },
  { eco: "E83", name: "King's Indian: Sämisch, Panno Formation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 Nc6" },
  { eco: "E84", name: "King's Indian: Sämisch, Panno Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 Nc6 7.Nge2 a6 8.Qd2 Rb8" },
  { eco: "E85", name: "King's Indian: Sämisch, Orthodox Variation", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5 7.Nge2" },
  { eco: "E86", name: "King's Indian: Sämisch, Orthodox, 7.d5 c6", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5 7.d5 c6" },
  { eco: "E87", name: "King's Indian: Sämisch, Orthodox, 7.d5 Nh5", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5 7.d5 Nh5" },
  { eco: "E88", name: "King's Indian: Sämisch, Orthodox, 7.d5 c6 8.Nge2", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5 7.d5 c6 8.Nge2" },
  { eco: "E89", name: "King's Indian: Sämisch, Orthodox, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5 7.d5 c6 8.Nge2 cxd5 9.cxd5" },
  { eco: "E90", name: "King's Indian: 5.Nf3", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3" },
  { eco: "E91", name: "King's Indian: Classical, 6.Be2", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 Nc6" },
  { eco: "E92", name: "King's Indian: Classical, 6.Be2 e5", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5" },
  { eco: "E93", name: "King's Indian: Petrosian System", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.d5" },
  { eco: "E94", name: "King's Indian: Classical, 7.O-O", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O" },
  { eco: "E95", name: "King's Indian: Classical, 7.O-O Nbd7", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nbd7 8.Re1" },
  { eco: "E96", name: "King's Indian: Classical, 7.O-O Nbd7 8.Re1 c6", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nbd7 8.Re1 c6 9.Bf1" },
  { eco: "E97", name: "King's Indian: Orthodox, Aronin-Taimanov", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7" },
  { eco: "E98", name: "King's Indian: Orthodox, Taimanov, 9.Ne1", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.Ne1 Nd7 10.Be3 f5" },
  { eco: "E99", name: "King's Indian: Orthodox, Taimanov, Main Line", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.Ne1 Nd7 10.Be3 f5 11.f3 f4 12.Bf2 g5" },
];

// Pre-sort ECO book: longest move sequences first (most specific match wins)
const SORTED_ECO = [...ECO_BOOK].sort((a, b) => b.moves.length - a.moves.length);

// ─── Counter-Lines Database (sub-variation aware) ─────────────────────────────
// Maps opponent opening patterns to recommended counter-lines.
// Matched in order — first match wins.

interface CounterLine {
  /** Substring to match in the opponent's opening name (case-insensitive) */
  matchPattern: string;
  line: PrepLine;
}

const COUNTER_LINES_AS_WHITE: CounterLine[] = [
  // Against Sicilian sub-variations
  {
    matchPattern: "sicilian: najdorf",
    line: { eco: "B90", name: "English Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3", rationale: "The English Attack is the most principled response to the Najdorf. White builds a kingside attack with f3-g4 while Black's queenside play is slower.", confidence: "high", lineType: "main", exploits: "Najdorf's slow queenside counterplay" },
  },
  {
    matchPattern: "sicilian: dragon",
    line: { eco: "B76", name: "Yugoslav Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.Bc4", rationale: "The Yugoslav Attack creates a direct kingside assault with opposite-side castling. White's attack is typically faster than Black's queenside counterplay.", confidence: "high", lineType: "main", exploits: "Dragon's slow queenside counterplay" },
  },
  {
    matchPattern: "sicilian: scheveningen",
    line: { eco: "B81", name: "Keres Attack", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.g4", rationale: "The Keres Attack prevents Black from completing development and forces immediate tactical complications.", confidence: "high", lineType: "main", exploits: "Scheveningen's slow development" },
  },
  {
    matchPattern: "sicilian: sveshnikov",
    line: { eco: "B33", name: "Sicilian: Sveshnikov, 9.Nd5", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5 9.Nd5", rationale: "The critical 9.Nd5 forces Black into a complex endgame where White exploits the d5 outpost and Black's weakened d6 pawn.", confidence: "high", lineType: "main", exploits: "Weak d6 pawn and d5 outpost" },
  },
  {
    matchPattern: "sicilian: taimanov",
    line: { eco: "B48", name: "Sicilian: Taimanov, English Attack", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7 6.Be3 a6 7.Qd2 Nf6 8.O-O-O", rationale: "White builds a strong center and launches a kingside attack. The Taimanov is less dynamic than the Najdorf, giving White more time to organize.", confidence: "high", lineType: "main", exploits: "Taimanov's passive queen placement" },
  },
  {
    matchPattern: "sicilian: accelerated dragon",
    line: { eco: "B36", name: "Maroczy Bind", moves: "1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4", rationale: "The Maroczy Bind restricts Black's d5 break, creating long-term positional pressure. Black's fianchettoed bishop is limited.", confidence: "high", lineType: "main", exploits: "Lack of d5 counterplay" },
  },
  {
    matchPattern: "sicilian: kan",
    line: { eco: "B43", name: "Sicilian: Kan, 5.Nc3", moves: "1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Nc3 Qc7 6.Bd3 Nf6 7.O-O Nc6 8.Nxc6 bxc6 9.e5", rationale: "White advances e5 to cramp Black's position. The Kan's flexibility becomes a weakness as Black lacks a clear plan.", confidence: "medium", lineType: "main", exploits: "Kan's lack of central presence" },
  },
  {
    matchPattern: "sicilian: alapin",
    line: { eco: "B22", name: "Alapin: 2.c3", moves: "1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3 e6 6.Be3 cxd4 7.cxd4", rationale: "The Alapin avoids the Open Sicilian entirely and leads to a solid IQP position. Excellent choice against Sicilian specialists.", confidence: "high", lineType: "surprise", exploits: "Sicilian specialist's preparation" },
  },
  {
    matchPattern: "sicilian",
    line: { eco: "B22", name: "Alapin Variation", moves: "1.e4 c5 2.c3", rationale: "The Alapin sidesteps Sicilian theory and leads to solid positions. Effective surprise weapon against Sicilian players.", confidence: "medium", lineType: "surprise", exploits: "Deep Sicilian preparation" },
  },
  // Against French Defense
  {
    matchPattern: "french: winawer",
    line: { eco: "C18", name: "French: Winawer, Poisoned Pawn", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Qc7 7.Qg4", rationale: "The Poisoned Pawn variation creates maximum complications. White's initiative compensates for the structural weaknesses.", confidence: "medium", lineType: "main", exploits: "Winawer's structural weaknesses" },
  },
  {
    matchPattern: "french: advance",
    line: { eco: "C02", name: "French: Advance, 5.Nf3", moves: "1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.a3", rationale: "The Advance Variation gives White a space advantage. The 5.Nf3 line is solid and avoids the sharp 5.f4 lines.", confidence: "high", lineType: "main", exploits: "French's passive bishop" },
  },
  {
    matchPattern: "french",
    line: { eco: "C02", name: "French: Advance Variation", moves: "1.e4 e6 2.d4 d5 3.e5", rationale: "The Advance Variation gives White a space advantage and avoids the Exchange Variation's drawish tendencies.", confidence: "high", lineType: "main", exploits: "French's passive light-squared bishop" },
  },
  // Against Caro-Kann
  {
    matchPattern: "caro-kann: advance",
    line: { eco: "B12", name: "Caro-Kann: Advance, Short Variation", moves: "1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.Be2 Nd7 6.O-O", rationale: "The Short Variation is the modern approach. White builds a solid position and prepares c4 to challenge Black's pawn chain.", confidence: "high", lineType: "main", exploits: "Caro-Kann's passive bishop" },
  },
  {
    matchPattern: "caro-kann",
    line: { eco: "B12", name: "Caro-Kann: Advance Variation", moves: "1.e4 c6 2.d4 d5 3.e5", rationale: "The Advance Variation avoids the Classical Caro-Kann and creates a French-like structure where White has more space.", confidence: "high", lineType: "main", exploits: "Caro-Kann's slow development" },
  },
  // Against Pirc/Modern
  {
    matchPattern: "pirc",
    line: { eco: "B09", name: "Pirc: Austrian Attack", moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4", rationale: "The Austrian Attack is the most aggressive response to the Pirc. White builds a strong pawn center and launches a kingside attack.", confidence: "high", lineType: "main", exploits: "Pirc's slow development" },
  },
  {
    matchPattern: "modern",
    line: { eco: "B06", name: "Modern Defense: 150 Attack", moves: "1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3 a6 5.Qd2 b5 6.f3", rationale: "The 150 Attack is a direct response to the Modern. White builds a strong center and prepares a kingside attack.", confidence: "medium", lineType: "main", exploits: "Modern's slow counterplay" },
  },
  // Against Scandinavian
  {
    matchPattern: "scandinavian",
    line: { eco: "B01", name: "Scandinavian: 3.Nf3", moves: "1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5 6.Bc4", rationale: "White develops naturally and exploits the time Black spent moving the queen. The bishop on c4 targets f7.", confidence: "high", lineType: "main", exploits: "Scandinavian's early queen development" },
  },
];

const COUNTER_LINES_AS_BLACK: CounterLine[] = [
  // Against 1.e4
  {
    matchPattern: "ruy lopez: closed",
    line: { eco: "C95", name: "Ruy Lopez: Breyer Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8", rationale: "The Breyer is the most solid response to the Ruy Lopez. Black reroutes the knight to d7 to support the center.", confidence: "high", lineType: "main", exploits: "Ruy Lopez's slow queenside expansion" },
  },
  {
    matchPattern: "ruy lopez",
    line: { eco: "C65", name: "Berlin Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6", rationale: "The Berlin is the most solid response to the Ruy Lopez. The resulting endgame is slightly better for Black due to the bishop pair.", confidence: "high", lineType: "main", exploits: "Ruy Lopez's kingside pressure" },
  },
  {
    matchPattern: "italian",
    line: { eco: "C54", name: "Giuoco Piano: Classical", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+", rationale: "The Classical Giuoco Piano gives Black active piece play. The bishop check on b4 disrupts White's center.", confidence: "high", lineType: "main", exploits: "Italian's overextended center" },
  },
  {
    matchPattern: "scotch",
    line: { eco: "C45", name: "Scotch: Mieses Variation", moves: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Ba6", rationale: "The Mieses Variation gives Black active counterplay. The bishop on a6 targets White's c4 pawn.", confidence: "medium", lineType: "main", exploits: "Scotch's weakened d4 square" },
  },
  {
    matchPattern: "king's gambit",
    line: { eco: "C30", name: "King's Gambit Declined: Classical", moves: "1.e4 e5 2.f4 Bc5", rationale: "Declining the gambit with 2...Bc5 gives Black a solid position and avoids the sharp gambit lines.", confidence: "high", lineType: "main", exploits: "King's Gambit's weakened f2" },
  },
  // Against 1.d4
  {
    matchPattern: "queen's gambit",
    line: { eco: "D58", name: "QGD: Tartakower Defense", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6", rationale: "The Tartakower is the most dynamic response to the QGD. Black fianchettoes the bishop and creates counterplay.", confidence: "high", lineType: "main", exploits: "QGD's passive bishop" },
  },
  {
    matchPattern: "london system",
    line: { eco: "A48", name: "London System: ...Bf5 Counter", moves: "1.d4 Nf6 2.Nf3 d5 3.Bf4 Bf5 4.e3 e6 5.Bd3 Bxd3 6.Qxd3 c5", rationale: "Trading off White's London bishop and immediately attacking the center with c5 gives Black active counterplay.", confidence: "high", lineType: "main", exploits: "London's passive bishop" },
  },
  {
    matchPattern: "king's indian",
    line: { eco: "E97", name: "King's Indian: Orthodox, Aronin-Taimanov", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7", rationale: "The Aronin-Taimanov is the sharpest response to the Classical KID. Black aims for a kingside attack with f5.", confidence: "high", lineType: "main", exploits: "KID's closed center" },
  },
  {
    matchPattern: "nimzo-indian",
    line: { eco: "E32", name: "Nimzo-Indian: Classical, 4.Qc2", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 O-O 5.a3 Bxc3+ 6.Qxc3 b6", rationale: "After 4.Qc2, Black should castle and then play b6 to fianchetto. This gives Black a solid position with the bishop pair.", confidence: "high", lineType: "main", exploits: "Nimzo's doubled pawns" },
  },
  // Against English
  {
    matchPattern: "english",
    line: { eco: "A25", name: "English: Closed, Botvinnik System", moves: "1.c4 e5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.e4", rationale: "The Botvinnik System gives Black a solid position. Black mirrors White's setup and aims for counterplay in the center.", confidence: "medium", lineType: "main", exploits: "English's slow development" },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a move sequence for comparison: lowercase, collapse whitespace */
function normalizeMoves(moves: string): string {
  return moves.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract the first N moves from a PGN string */
function extractMoves(pgn: string, maxMoves = 10): string {
  // Remove PGN headers
  const body = pgn.replace(/\[.*?\]/g, "").trim();
  // Remove annotations, comments, result
  const cleaned = body
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\$\d+/g, "")
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, "")
    .trim();
  // Split into tokens and strip move number prefixes (e.g. "1.e4" → "e4", "2.Nf3" → "Nf3")
  // Also filter out pure move-number tokens like "1." or "2."
  const tokens = cleaned
    .split(/\s+/)
    .map(t => t.replace(/^\d+\.+/, ""))  // strip leading "1." or "1..." etc.
    .filter(t => t.length > 0);
  // Take first maxMoves * 2 half-moves (each side)
  const halfMoves = tokens.slice(0, maxMoves * 2);
  // Rebuild with move numbers
  const result: string[] = [];
  for (let i = 0; i < halfMoves.length; i++) {
    if (i % 2 === 0) result.push(`${Math.floor(i / 2) + 1}.${halfMoves[i]}`);
    else result.push(halfMoves[i]);
  }
  return result.join(" ");
}

/** Classify a game's opening using the ECO book */
export function classifyOpening(pgn: string): OpeningInfo {
  const moveSeq = normalizeMoves(extractMoves(pgn, 12));
  for (const entry of SORTED_ECO) {
    const entryMoves = normalizeMoves(entry.moves);
    if (moveSeq.startsWith(entryMoves)) {
      return { eco: entry.eco, name: entry.name, moves: entry.moves };
    }
  }
  // Fallback: try to identify by first move
  const firstMove = moveSeq.split(" ")[0]?.replace(/\d+\./, "")?.toLowerCase() || "";
  if (firstMove === "e4") return { eco: "B00", name: "King's Pawn Opening", moves: "1.e4" };
  if (firstMove === "d4") return { eco: "D00", name: "Queen's Pawn Game", moves: "1.d4" };
  if (firstMove === "nf3") return { eco: "A04", name: "Reti Opening", moves: "1.Nf3" };
  if (firstMove === "c4") return { eco: "A10", name: "English Opening", moves: "1.c4" };
  return { eco: "A00", name: "Irregular Opening", moves: "" };
}

/** Compute weakness score: 0–100 (high = exploitable) */
function computeWeaknessScore(stat: Omit<OpeningStat, "weaknessScore">): number {
  const totalGames = stat.wins + stat.draws + stat.losses;
  if (totalGames < 3) return 0;
  // Frequency component (0–50): how often they play this
  const freqScore = Math.min(50, (stat.count / 20) * 50);
  // Weakness component (0–50): how bad their win rate is
  const winRatePenalty = Math.max(0, 0.5 - stat.winRate); // penalty if win rate < 50%
  const weaknessScore = Math.min(50, winRatePenalty * 100);
  return Math.round(freqScore + weaknessScore);
}

/** Fetch player games from chess.com archives (up to 100 games, 6 months) */
export async function fetchPlayerGames(
  username: string,
  timeClasses: string[] = ["rapid", "blitz"],
  maxGames = 100
): Promise<ChessComGame[]> {
  const games: ChessComGame[] = [];
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  for (const { year, month } of months) {
    if (games.length >= maxGames) break;
    const mm = String(month).padStart(2, "0");
    const url = `https://api.chess.com/pub/player/${username}/games/${year}/${mm}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "ChessOTB.club PrepEngine/2.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const monthGames: ChessComGame[] = (data.games || [])
        .filter((g: ChessComGame) => timeClasses.includes(g.time_class) && g.rules === "chess")
        .reverse(); // newest first
      games.push(...monthGames);
    } catch {
      // Skip months that fail
    }
  }

  return games.slice(0, maxGames);
}

/** Build opening stats from a list of games for a given color */
function buildOpeningStats(
  games: ChessComGame[],
  username: string,
  color: "white" | "black"
): OpeningStat[] {
  const statsMap = new Map<string, { eco: string; moves: string; wins: number; draws: number; losses: number; count: number }>();

  for (const game of games) {
    const playerSide = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
    if (playerSide !== color) continue;
    const opening = classifyOpening(game.pgn);
    const result = color === "white" ? game.white.result : game.black.result;
    const key = opening.name;
    const existing = statsMap.get(key) || { eco: opening.eco, moves: opening.moves, wins: 0, draws: 0, losses: 0, count: 0 };
    existing.count++;
    if (result === "win") existing.wins++;
    else if (result === "agreed" || result === "repetition" || result === "stalemate" || result === "insufficient" || result === "50move" || result === "timevsinsufficient") existing.draws++;
    else existing.losses++;
    statsMap.set(key, existing);
  }

  return Array.from(statsMap.entries())
    .map(([name, s]) => {
      const winRate = s.count > 0 ? s.wins / s.count : 0;
      const base = { name, eco: s.eco, moves: s.moves, count: s.count, wins: s.wins, draws: s.draws, losses: s.losses, winRate };
      return { ...base, weaknessScore: computeWeaknessScore(base) };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/** Build a move-order tree for the opponent's first 2 moves as white */
function buildMoveOrderTree(games: ChessComGame[], username: string): MoveOrderNode[] {
  const firstMoveMap = new Map<string, { count: number; secondMoves: Map<string, number> }>();

  for (const game of games) {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    if (!isWhite) continue;
    const moveSeq = extractMoves(game.pgn, 3);
    const tokens = moveSeq.split(" ").filter(t => !t.match(/^\d+\.+$/));
    if (tokens.length < 1) continue;
    const first = tokens[0];
    const second = tokens.length >= 3 ? tokens[2] : null; // tokens[1] is black's reply
    const entry = firstMoveMap.get(first) || { count: 0, secondMoves: new Map() };
    entry.count++;
    if (second) entry.secondMoves.set(second, (entry.secondMoves.get(second) || 0) + 1);
    firstMoveMap.set(first, entry);
  }

  const total = Array.from(firstMoveMap.values()).reduce((s, e) => s + e.count, 0);
  return Array.from(firstMoveMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([move, data]) => ({
      move,
      count: data.count,
      pct: total > 0 ? Math.round((data.count / total) * 100) : 0,
      children: Array.from(data.secondMoves.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m, c]) => ({ move: m, count: c, pct: Math.round((c / data.count) * 100) })),
    }));
}

/** Analyze a player's play style from their games */
export function analyzePlayStyle(games: ChessComGame[], username: string): PlayStyleProfile {
  const lc = username.toLowerCase();
  let wins = 0, draws = 0, losses = 0;
  let whiteWins = 0, whiteDraws = 0, whiteLosses = 0, whiteGames = 0;
  let blackWins = 0, blackDraws = 0, blackLosses = 0, blackGames = 0;
  let totalMoves = 0;
  const endgame = { checkmates: 0, resignations: 0, timeouts: 0, draws: 0, total: 0 };
  const ratings: { rapid: number[]; blitz: number[]; bullet: number[] } = { rapid: [], blitz: [], bullet: [] };
  const tcWins: { rapid: number; blitz: number; bullet: number } = { rapid: 0, blitz: 0, bullet: 0 };
  const tcGames: { rapid: number; blitz: number; bullet: number } = { rapid: 0, blitz: 0, bullet: 0 };

  for (const game of games) {
    const isWhite = game.white.username.toLowerCase() === lc;
    const playerData = isWhite ? game.white : game.black;
    const result = playerData.result;
    const tc = game.time_class as "rapid" | "blitz" | "bullet";

    // Rating tracking
    if (tc === "rapid" || tc === "blitz" || tc === "bullet") {
      ratings[tc].push(playerData.rating);
      tcGames[tc]++;
      if (result === "win") tcWins[tc]++;
    }

    // W/D/L
    if (result === "win") wins++;
    else if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(result)) draws++;
    else losses++;

    // By color
    if (isWhite) {
      whiteGames++;
      if (result === "win") whiteWins++;
      else if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(result)) whiteDraws++;
      else whiteLosses++;
    } else {
      blackGames++;
      if (result === "win") blackWins++;
      else if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(result)) blackDraws++;
      else blackLosses++;
    }

    // Endgame profile
    endgame.total++;
    if (result === "checkmated" || (result === "win" && game.pgn.includes("#"))) endgame.checkmates++;
    else if (result === "resigned" || (result === "win" && !game.pgn.includes("#"))) endgame.resignations++;
    else if (result === "timeout" || result === "timevsinsufficient") endgame.timeouts++;
    else endgame.draws++;

    // Game length
    const moveCount = (game.pgn.match(/\d+\./g) || []).length;
    totalMoves += moveCount;
  }

  const total = games.length || 1;
  const avgRating = (arr: number[]) => arr.length > 0 ? arr[arr.length - 1] : null;

  // Dominant time control
  const maxTc = Object.entries(tcGames).sort((a, b) => b[1] - a[1])[0];
  const dominantTimeControl = (maxTc && maxTc[1] > total * 0.6)
    ? (maxTc[0] as "rapid" | "blitz" | "bullet")
    : "mixed";

  // Per-time-control opening stats
  const rapidGames = games.filter(g => g.time_class === "rapid");
  const blitzGames = games.filter(g => g.time_class === "blitz");
  const bulletGames = games.filter(g => g.time_class === "bullet");

  return {
    username,
    gamesAnalyzed: games.length,
    rating: {
      rapid: avgRating(ratings.rapid),
      blitz: avgRating(ratings.blitz),
      bullet: avgRating(ratings.bullet),
    },
    overall: { wins, draws, losses, winRate: wins / total },
    asWhite: { wins: whiteWins, draws: whiteDraws, losses: whiteLosses, winRate: whiteGames > 0 ? whiteWins / whiteGames : 0, games: whiteGames },
    asBlack: { wins: blackWins, draws: blackDraws, losses: blackLosses, winRate: blackGames > 0 ? blackWins / blackGames : 0, games: blackGames },
    whiteOpenings: buildOpeningStats(games, username, "white"),
    blackOpenings: buildOpeningStats(games, username, "black"),
    endgameProfile: endgame,
    firstMoveAsWhite: buildMoveOrderTree(games, username).map(n => ({ move: n.move, count: n.count, pct: n.pct })),
    secondMoveTree: buildMoveOrderTree(games, username),
    avgGameLength: Math.round(totalMoves / total),
    timeControlSplit: {
      rapid: { games: tcGames.rapid, winRate: tcGames.rapid > 0 ? tcWins.rapid / tcGames.rapid : 0 },
      blitz: { games: tcGames.blitz, winRate: tcGames.blitz > 0 ? tcWins.blitz / tcGames.blitz : 0 },
      bullet: { games: tcGames.bullet, winRate: tcGames.bullet > 0 ? tcWins.bullet / tcGames.bullet : 0 },
    },
    whiteOpeningsByTimeControl: {
      rapid: buildOpeningStats(rapidGames, username, "white"),
      blitz: buildOpeningStats(blitzGames, username, "white"),
      bullet: buildOpeningStats(bulletGames, username, "white"),
    },
    blackOpeningsByTimeControl: {
      rapid: buildOpeningStats(rapidGames, username, "black"),
      blitz: buildOpeningStats(blitzGames, username, "black"),
      bullet: buildOpeningStats(bulletGames, username, "black"),
    },
    dominantTimeControl,
  };
}

/** Generate prep lines based on opponent profile */
export function generatePrepLines(
  profile: PlayStyleProfile,
  myColor: "white" | "black"
): PrepLine[] {
  const lines: PrepLine[] = [];
  const opponentOpenings = myColor === "white" ? profile.blackOpenings : profile.whiteOpenings;
  const counterDb = myColor === "white" ? COUNTER_LINES_AS_WHITE : COUNTER_LINES_AS_BLACK;

  // Find counter-lines for opponent's top 3 openings
  for (const opening of opponentOpenings.slice(0, 3)) {
    const lowerName = opening.name.toLowerCase();
    for (const counter of counterDb) {
      if (lowerName.includes(counter.matchPattern.toLowerCase())) {
        // Avoid duplicates
        if (!lines.find(l => l.eco === counter.line.eco)) {
          lines.push({
            ...counter.line,
            exploits: counter.line.exploits || `${opening.name} (${Math.round(opening.winRate * 100)}% win rate)`,
          });
        }
        break;
      }
    }
  }

  // Add a surprise weapon if we have fewer than 3 lines
  if (lines.length < 3) {
    const topOpening = opponentOpenings[0];
    if (topOpening) {
      const lowerName = topOpening.name.toLowerCase();
      for (const counter of counterDb) {
        if (lowerName.includes(counter.matchPattern.toLowerCase()) && counter.line.lineType === "surprise") {
          if (!lines.find(l => l.eco === counter.line.eco)) {
            lines.push(counter.line);
            break;
          }
        }
      }
    }
  }

  // Ensure at least 2 lines
  if (lines.length === 0 && opponentOpenings.length > 0) {
    lines.push({
      eco: "A00",
      name: "Study opponent's main opening",
      moves: opponentOpenings[0]?.moves || "",
      rationale: `Opponent frequently plays ${opponentOpenings[0]?.name}. Study the main counter-lines.`,
      confidence: "low",
      lineType: "main",
    });
  }

  return lines.slice(0, 5);
}

/** Generate human-readable insights from the profile */
export function generateInsights(profile: PlayStyleProfile): string[] {
  const insights: string[] = [];
  const p = profile;

  // Color preference
  const whiteAdv = p.asWhite.winRate - p.asBlack.winRate;
  if (Math.abs(whiteAdv) > 0.1) {
    const stronger = whiteAdv > 0 ? "White" : "Black";
    const weaker = whiteAdv > 0 ? "Black" : "White";
    insights.push(`Significantly stronger with ${stronger} (${Math.round(Math.max(p.asWhite.winRate, p.asBlack.winRate) * 100)}% win rate vs ${Math.round(Math.min(p.asWhite.winRate, p.asBlack.winRate) * 100)}% with ${weaker}).`);
  }

  // Top white opening
  if (p.whiteOpenings.length > 0) {
    const top = p.whiteOpenings[0];
    insights.push(`Plays ${top.name} in ${Math.round((top.count / p.gamesAnalyzed) * 100)}% of White games (${Math.round(top.winRate * 100)}% win rate).`);
  }

  // Top black opening
  if (p.blackOpenings.length > 0) {
    const top = p.blackOpenings[0];
    insights.push(`Favors ${top.name} as Black (${top.count} games, ${Math.round(top.winRate * 100)}% win rate).`);
  }

  // Weakness: low win rate opening
  const weakOpening = [...p.whiteOpenings, ...p.blackOpenings]
    .filter(o => o.count >= 3 && o.winRate < 0.4)
    .sort((a, b) => b.weaknessScore - a.weaknessScore)[0];
  if (weakOpening) {
    insights.push(`Struggles in ${weakOpening.name} (${Math.round(weakOpening.winRate * 100)}% win rate in ${weakOpening.count} games) — high exploitability.`);
  }

  // Endgame profile
  if (p.endgameProfile.timeouts > p.endgameProfile.total * 0.15) {
    insights.push(`Loses ${p.endgameProfile.timeouts} games on time — plays slowly and may be prone to time pressure.`);
  } else if (p.endgameProfile.resignations > p.endgameProfile.total * 0.4) {
    insights.push(`Resigns frequently (${p.endgameProfile.resignations} games) — tends to give up in lost positions rather than fighting.`);
  }

  // Game length
  if (p.avgGameLength < 25) {
    insights.push(`Games average only ${p.avgGameLength} moves — prefers sharp, tactical positions and early decisive outcomes.`);
  } else if (p.avgGameLength > 45) {
    insights.push(`Games average ${p.avgGameLength} moves — comfortable in long positional battles and endgames.`);
  }

  // Time control
  if (p.dominantTimeControl !== "mixed") {
    const tc = p.timeControlSplit[p.dominantTimeControl];
    insights.push(`Primarily plays ${p.dominantTimeControl} (${tc.games} games, ${Math.round(tc.winRate * 100)}% win rate).`);
  }

  // Second move tree
  if (p.secondMoveTree.length > 0 && p.secondMoveTree[0].children && p.secondMoveTree[0].children.length > 0) {
    const top = p.secondMoveTree[0];
    const topChild = top.children![0];
    insights.push(`After 1.${top.move}, most commonly plays 2.${topChild.move} (${topChild.pct}% of the time).`);
  }

  return insights.slice(0, 8);
}

/** Build the full prep report */
export async function buildPrepReport(
  username: string,
  timeClasses: string[] = ["rapid", "blitz"],
  myColor: "white" | "black" = "white"
): Promise<PrepReport> {
  const games = await fetchPlayerGames(username, timeClasses, 100);
  if (games.length === 0) {
    throw new Error(`No ${timeClasses.join("/")} games found for ${username} in the last 6 months.`);
  }
  const profile = analyzePlayStyle(games, username);
  const prepLines = generatePrepLines(profile, myColor);
  const insights = generateInsights(profile);
  return {
    opponent: profile,
    prepLines,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
