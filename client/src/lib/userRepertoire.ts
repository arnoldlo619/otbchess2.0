/**
 * userRepertoire.ts
 *
 * User repertoire profile — stores the user's declared opening preferences
 * and provides collision-scoring utilities to prioritize prep lines based on
 * how likely each line is to arise in a specific matchup.
 *
 * Architecture:
 *   - UserRepertoire: the user's declared opening choices (persisted in localStorage)
 *   - computeCollisionScore(): cross-references user repertoire vs opponent tendencies
 *   - getRepertoireFit(): classifies each prep line as in-repertoire / adjacent / outside
 *   - rankLinesByCollision(): sorts prep lines by collision probability
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** User's declared opening preferences */
export interface UserRepertoire {
  /** First move as White (e.g. "e4", "d4", "c4", "Nf3") */
  whiteFirstMove: string | null;
  /** Black response style to 1.e4 (e.g. "Sicilian", "French", "Caro-Kann", "e5") */
  blackVsE4: string | null;
  /** Black response style to 1.d4 (e.g. "King's Indian", "Nimzo-Indian", "Queen's Gambit Declined") */
  blackVsD4: string | null;
  /** Expected color in the upcoming game (null = unknown) */
  expectedColor: "white" | "black" | null;
  /** chess.com username to auto-fetch repertoire (optional) */
  chesscomUsername: string | null;
}

/** Repertoire fit classification for a prep line */
export type RepertoireFit = "core" | "adjacent" | "outside";

/** Extended prep line with collision intelligence */
export interface EnrichedPrepLine {
  name: string;
  eco: string;
  moves: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
  /** 0–100: how likely this line is to arise given user + opponent repertoires */
  collisionScore: number;
  /** How well this line fits the user's existing repertoire */
  repertoireFit: RepertoireFit;
  /** Which color this line is most relevant for */
  colorContext: "white" | "black" | "both";
  /** Pawn structure / thematic label */
  structureLabel?: string;
  /** Whether this is the top recommended line to study first */
  isTrainFirst?: boolean;
  /** Whether this is a main line or a surprise weapon */
  lineType?: "main" | "surprise";
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "otb_user_repertoire";

/** Default empty repertoire */
export const DEFAULT_REPERTOIRE: UserRepertoire = {
  whiteFirstMove: null,
  blackVsE4: null,
  blackVsD4: null,
  expectedColor: null,
  chesscomUsername: null,
};

/** White first move options */
export const WHITE_FIRST_MOVES = [
  { value: "e4", label: "1.e4", description: "Open games" },
  { value: "d4", label: "1.d4", description: "Closed games" },
  { value: "c4", label: "1.c4", description: "English" },
  { value: "Nf3", label: "1.Nf3", description: "Réti / KIA" },
  { value: "other", label: "Other", description: "Irregular" },
];

/** Black response options vs 1.e4 */
export const BLACK_VS_E4 = [
  { value: "e5", label: "1...e5", description: "Open games" },
  { value: "Sicilian", label: "Sicilian", description: "1...c5" },
  { value: "French", label: "French", description: "1...e6" },
  { value: "Caro-Kann", label: "Caro-Kann", description: "1...c6" },
  { value: "Pirc/Modern", label: "Pirc/Modern", description: "1...d6/g6" },
  { value: "other", label: "Other", description: "Irregular" },
];

/** Black response options vs 1.d4 */
export const BLACK_VS_D4 = [
  { value: "King's Indian", label: "King's Indian", description: "...Nf6, g6, Bg7" },
  { value: "Nimzo-Indian", label: "Nimzo-Indian", description: "...Nf6, e6, Bb4" },
  { value: "Queen's Gambit Declined", label: "QGD", description: "...d5, e6" },
  { value: "Grünfeld", label: "Grünfeld", description: "...Nf6, g6, d5" },
  { value: "Dutch", label: "Dutch", description: "...f5" },
  { value: "other", label: "Other", description: "Irregular" },
];

// ─── Persistence ─────────────────────────────────────────────────────────────

/** Load user repertoire from localStorage */
export function loadUserRepertoire(): UserRepertoire {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REPERTOIRE };
    return { ...DEFAULT_REPERTOIRE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_REPERTOIRE };
  }
}

/** Save user repertoire to localStorage */
export function saveUserRepertoire(repertoire: UserRepertoire): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repertoire));
  } catch {
    // Non-fatal
  }
}

/** Clear user repertoire from localStorage */
export function clearUserRepertoire(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal
  }
}

// ─── Collision Scoring ───────────────────────────────────────────────────────

/**
 * Compute a collision score (0–100) for a prep line given the user's repertoire
 * and the opponent's play style profile.
 *
 * Factors:
 * 1. Does the line match the expected color context?
 * 2. Does the line address the opponent's most common first move (as White)?
 * 3. Does the line address the opponent's most common Black defense?
 * 4. Does the line fit the user's declared repertoire?
 * 5. How often does the opponent play into this line?
 */
export function computeCollisionScore(
  line: { name: string; eco: string; moves: string; confidence: "high" | "medium" | "low" },
  repertoire: UserRepertoire,
  opponentProfile: {
    firstMoveAsWhite: { move: string; count: number; pct: number }[];
    blackOpenings: { name: string; eco: string; count: number; winRate: number }[];
    whiteOpenings: { name: string; eco: string; count: number; winRate: number }[];
    gamesAnalyzed: number;
  }
): number {
  let score = 0;

  // Base score from confidence
  const baseByConfidence = { high: 40, medium: 25, low: 10 };
  score += baseByConfidence[line.confidence];

  // Color context bonus
  const colorCtx = getColorContext(line);
  if (repertoire.expectedColor === "white" && colorCtx === "white") score += 15;
  if (repertoire.expectedColor === "black" && colorCtx === "black") score += 15;
  if (colorCtx === "both") score += 8;

  // Opponent first-move frequency bonus (when user is Black)
  if (opponentProfile.firstMoveAsWhite.length > 0) {
    const topMove = opponentProfile.firstMoveAsWhite[0];
    const moveKey = `1.${topMove.move}`;
    if (line.moves.startsWith(moveKey) || line.moves.includes(topMove.move)) {
      score += Math.round((topMove.pct / 100) * 20); // Up to +20
    }
  }

  // Opponent black opening frequency bonus (when user is White)
  if (opponentProfile.blackOpenings.length > 0) {
    const topBlack = opponentProfile.blackOpenings[0];
    const nameMatch = line.name.toLowerCase().includes(topBlack.name.toLowerCase().split(":")[0].trim()) ||
                      topBlack.name.toLowerCase().includes(line.name.toLowerCase().split(":")[0].trim());
    if (nameMatch) {
      const freq = topBlack.count / Math.max(opponentProfile.gamesAnalyzed, 1);
      score += Math.round(freq * 20); // Up to +20
    }
  }

  // Repertoire fit bonus
  const fit = computeRepertoireFit(line, repertoire);
  if (fit === "core") score += 15;
  else if (fit === "adjacent") score += 8;
  // outside: no bonus

  return Math.min(100, Math.max(0, score));
}

/**
 * Determine the color context of a prep line from its move sequence.
 */
export function getColorContext(line: { moves: string; name: string }): "white" | "black" | "both" {
  const moves = line.moves.toLowerCase();
  const name = line.name.toLowerCase();

  // Lines starting with 1. are White's opening choices
  if (moves.startsWith("1.e4") || moves.startsWith("1.d4") || moves.startsWith("1.c4") || moves.startsWith("1.nf3")) {
    // But if it's a defense name, it's Black's response
    const defenseKeywords = ["defense", "defence", "sicilian", "french", "caro", "pirc", "modern", "alekhine", "scandinavian", "dutch", "indian", "nimzo", "grünfeld", "grunfeld", "benoni", "benko"];
    if (defenseKeywords.some(k => name.includes(k))) return "black";
    return "white";
  }

  // Lines with "strategy" or "endgame" are color-neutral
  if (name.includes("strategy") || name.includes("endgame") || name.includes("grind") || name.includes("complex")) {
    return "both";
  }

  // Default: if it has a counter-opening name, it's Black
  const blackKeywords = ["defense", "defence", "sicilian", "french", "caro", "pirc", "modern", "indian", "nimzo", "grünfeld", "grunfeld", "dutch"];
  if (blackKeywords.some(k => name.includes(k))) return "black";

  return "white";
}

/**
 * Classify how well a prep line fits the user's declared repertoire.
 */
export function computeRepertoireFit(
  line: { name: string; eco: string; moves: string },
  repertoire: UserRepertoire
): RepertoireFit {
  const name = line.name.toLowerCase();
  const moves = line.moves.toLowerCase();

  // Check White repertoire fit
  if (repertoire.whiteFirstMove) {
    const wm = repertoire.whiteFirstMove.toLowerCase();
    if (moves.startsWith(`1.${wm}`) || moves.startsWith(`1. ${wm}`)) {
      return "core";
    }
    // Adjacent: same pawn structure family
    if (wm === "e4" && (moves.startsWith("1.e4") || name.includes("e4"))) return "core";
    if (wm === "d4" && (moves.startsWith("1.d4") || name.includes("d4") || name.includes("queen's"))) return "adjacent";
  }

  // Check Black vs e4 fit
  if (repertoire.blackVsE4) {
    const bve4 = repertoire.blackVsE4.toLowerCase();
    if (bve4 !== "other" && name.includes(bve4.split("'")[0])) return "core";
    // Adjacent: same e4 response family
    if (bve4 === "sicilian" && (name.includes("sicilian") || name.includes("najdorf") || name.includes("dragon"))) return "core";
    if (bve4 === "french" && name.includes("french")) return "core";
    if (bve4 === "caro-kann" && (name.includes("caro") || name.includes("caro-kann"))) return "core";
    if (bve4 === "e5" && (name.includes("ruy lopez") || name.includes("italian") || name.includes("open game") || name.includes("petrov") || name.includes("berlin"))) return "core";
  }

  // Check Black vs d4 fit
  if (repertoire.blackVsD4) {
    const bvd4 = repertoire.blackVsD4.toLowerCase();
    if (bvd4 !== "other" && name.includes(bvd4.split("'")[0])) return "core";
    if (bvd4 === "king's indian" && (name.includes("king's indian") || name.includes("kid"))) return "core";
    if (bvd4 === "nimzo-indian" && name.includes("nimzo")) return "core";
    if (bvd4 === "queen's gambit declined" && (name.includes("qgd") || name.includes("queen's gambit"))) return "core";
    if (bvd4 === "grünfeld" && (name.includes("grünfeld") || name.includes("grunfeld"))) return "core";
  }

  // Generic adjacent check: if line ECO range overlaps with common repertoire families
  const eco = line.eco.toUpperCase();
  if (eco.startsWith("B") || eco.startsWith("C")) {
    // e4 territory
    if (repertoire.whiteFirstMove === "e4" || repertoire.blackVsE4) return "adjacent";
  }
  if (eco.startsWith("D") || eco.startsWith("E") || eco.startsWith("A")) {
    // d4/flank territory
    if (repertoire.whiteFirstMove === "d4" || repertoire.whiteFirstMove === "c4" || repertoire.blackVsD4) return "adjacent";
  }

  return "outside";
}

/**
 * Rank prep lines by collision score (descending).
 * Lines with the same collision score are sorted by confidence tier.
 */
export function rankLinesByCollision(lines: EnrichedPrepLine[]): EnrichedPrepLine[] {
  return [...lines].sort((a, b) => {
    if (b.collisionScore !== a.collisionScore) return b.collisionScore - a.collisionScore;
    // Secondary: confidence
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });
}

/**
 * Enrich prep lines with collision scores, repertoire fit, and color context.
 * Marks the top line as "train first".
 */
export function enrichPrepLines(
  lines: Array<{ name: string; eco: string; moves: string; rationale: string; confidence: "high" | "medium" | "low" }>,
  repertoire: UserRepertoire,
  opponentProfile: {
    firstMoveAsWhite: { move: string; count: number; pct: number }[];
    blackOpenings: { name: string; eco: string; count: number; winRate: number }[];
    whiteOpenings: { name: string; eco: string; count: number; winRate: number }[];
    gamesAnalyzed: number;
  }
): EnrichedPrepLine[] {
  const enriched: EnrichedPrepLine[] = lines.map(line => ({
    ...line,
    collisionScore: computeCollisionScore(line, repertoire, opponentProfile),
    repertoireFit: computeRepertoireFit(line, repertoire),
    colorContext: getColorContext(line),
    structureLabel: getStructureLabel(line),
    isTrainFirst: false,
  }));

  const ranked = rankLinesByCollision(enriched);

  // Mark the top-ranked line as "train first" (only if score > 30)
  if (ranked.length > 0 && ranked[0].collisionScore > 30) {
    ranked[0] = { ...ranked[0], isTrainFirst: true };
  }

  return ranked;
}

/**
 * Get a pawn structure / thematic label for a prep line.
 */
export function getStructureLabel(line: { name: string; eco: string; moves: string }): string | undefined {
  const name = line.name.toLowerCase();
  const eco = line.eco.toUpperCase();

  if (name.includes("sicilian") || eco.startsWith("B2") || eco.startsWith("B3") || eco.startsWith("B4") || eco.startsWith("B5") || eco.startsWith("B6") || eco.startsWith("B7") || eco.startsWith("B8") || eco.startsWith("B9")) return "Sicilian structure";
  if (name.includes("french") || eco.startsWith("C0") || eco.startsWith("C1")) return "French structure";
  if (name.includes("caro")) return "Caro-Kann structure";
  if (name.includes("king's indian") || eco.startsWith("E6") || eco.startsWith("E7") || eco.startsWith("E8") || eco.startsWith("E9")) return "KID structure";
  if (name.includes("nimzo") || eco.startsWith("E2") || eco.startsWith("E3") || eco.startsWith("E4")) return "Nimzo structure";
  if (name.includes("queen's gambit") || eco.startsWith("D3") || eco.startsWith("D4") || eco.startsWith("D5")) return "IQP / QGD structure";
  if (name.includes("ruy lopez") || eco.startsWith("C6") || eco.startsWith("C7") || eco.startsWith("C8") || eco.startsWith("C9")) return "Ruy Lopez structure";
  if (name.includes("italian") || eco.startsWith("C5")) return "Italian structure";
  if (name.includes("london") || eco === "A48") return "London structure";
  if (name.includes("english") || eco.startsWith("A1") || eco.startsWith("A2") || eco.startsWith("A3")) return "English structure";
  if (name.includes("endgame") || name.includes("grind")) return "Endgame technique";
  if (name.includes("complex") || name.includes("strategy")) return "Middlegame complexity";
  return undefined;
}

/**
 * Generate a strategic matchup summary based on user repertoire + opponent profile.
 * Returns 2–4 concise strategic sentences.
 */
export function generateMatchupSummary(
  repertoire: UserRepertoire,
  opponentProfile: {
    firstMoveAsWhite: { move: string; count: number; pct: number }[];
    blackOpenings: { name: string; eco: string; count: number; winRate: number; moves: string }[];
    whiteOpenings: { name: string; eco: string; count: number; winRate: number; moves: string }[];
    asWhite: { winRate: number; games: number };
    asBlack: { winRate: number; games: number };
    gamesAnalyzed: number;
  },
  enrichedLines: EnrichedPrepLine[]
): {
  likelyBattle: string;
  studyFirst: string | null;
  prepRisk: string | null;
  colorAdvice: string | null;
} {
  const topLine = enrichedLines.find(l => l.isTrainFirst) ?? enrichedLines[0] ?? null;

  // Likely battle
  let likelyBattle = "Opening battle unclear — not enough data.";
  if (repertoire.expectedColor === "white") {
    if (opponentProfile.blackOpenings.length > 0) {
      const top = opponentProfile.blackOpenings[0];
      likelyBattle = `Expect the ${top.name} (${top.count} games, ${top.winRate}% win rate as Black).`;
    }
  } else if (repertoire.expectedColor === "black") {
    if (opponentProfile.firstMoveAsWhite.length > 0) {
      const top = opponentProfile.firstMoveAsWhite[0];
      likelyBattle = `Opponent plays 1.${top.move} in ${top.pct}% of White games — prepare your ${
        top.move === "e4"
          ? (repertoire.blackVsE4 ?? "response to 1.e4")
          : top.move === "d4"
          ? (repertoire.blackVsD4 ?? "response to 1.d4")
          : "response"
      }.`;
    }
  } else {
    // Unknown color
    if (opponentProfile.firstMoveAsWhite.length > 0 && opponentProfile.blackOpenings.length > 0) {
      const topW = opponentProfile.firstMoveAsWhite[0];
      const topB = opponentProfile.blackOpenings[0];
      likelyBattle = `As White: 1.${topW.move} (${topW.pct}%). As Black: ${topB.name} (${topB.count} games).`;
    }
  }

  // Study first
  const studyFirst = topLine
    ? `Study "${topLine.name}" first — highest collision probability with this opponent.`
    : null;

  // Prep risk
  let prepRisk: string | null = null;
  const outsideLines = enrichedLines.filter(l => l.repertoireFit === "outside" && l.collisionScore > 40);
  if (outsideLines.length > 0) {
    prepRisk = `Watch out: "${outsideLines[0].name}" is outside your usual repertoire but likely to arise.`;
  }

  // Color advice
  let colorAdvice: string | null = null;
  if (opponentProfile.asWhite.games > 5 && opponentProfile.asBlack.games > 5) {
    if (opponentProfile.asWhite.winRate > opponentProfile.asBlack.winRate + 10) {
      colorAdvice = `Opponent is stronger as White (${opponentProfile.asWhite.winRate}% vs ${opponentProfile.asBlack.winRate}%) — if you have Black, be extra prepared.`;
    } else if (opponentProfile.asBlack.winRate > opponentProfile.asWhite.winRate + 10) {
      colorAdvice = `Opponent is stronger as Black (${opponentProfile.asBlack.winRate}% vs ${opponentProfile.asWhite.winRate}%) — if you have White, be extra prepared.`;
    }
  }

  return { likelyBattle, studyFirst, prepRisk, colorAdvice };
}
