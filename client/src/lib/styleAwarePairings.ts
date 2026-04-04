/**
 * OTB Chess — Style-Aware Pairings Engine
 *
 * A premium pairing layer for casual and social club tournaments.
 * Builds on the standard Swiss engine by adding style-signal scoring,
 * pairing-weight tuning, explainability chips, and graceful fallback
 * for players with weak or missing style data.
 *
 * Three pairing modes:
 *   balanced   — strong Elo proximity, style is a minor tiebreaker
 *   style_aware — blends rating parity with style optimization
 *   sharp       — prioritises dynamic/tactical matchup potential within
 *                 an acceptable rating band
 *
 * Design principles:
 *   - No black-box scoring. Every signal is grounded in observable data.
 *   - Broad, believable dimensions over fake precision.
 *   - Degrade gracefully when style data is absent or low-confidence.
 *   - Explanations are concise, trust-building, and readable in the UI.
 */

// ─── Pairing Mode ─────────────────────────────────────────────────────────────

export type PairingMode = "balanced" | "style_aware" | "sharp";

export interface PairingModeConfig {
  id: PairingMode;
  label: string;
  tagline: string;
  description: string;
  /** Weight 0–1 for Elo proximity (1 = pure Elo, 0 = ignore Elo) */
  eloWeight: number;
  /** Weight 0–1 for style compatibility score */
  styleWeight: number;
  /** Weight 0–1 for dynamic/tactical matchup potential */
  dynamismWeight: number;
  /** Max Elo gap allowed before a pairing is invalid */
  eloTolerance: number;
  /** Minimum style-confidence required to apply style scoring (0–1) */
  minStyleConfidence: number;
}

export const PAIRING_MODES: Record<PairingMode, PairingModeConfig> = {
  balanced: {
    id: "balanced",
    label: "Balanced Matchups",
    tagline: "Closest competitive parity",
    description:
      "Prioritises rating fairness above all else. Best for competitive events where equal strength matchups matter most.",
    eloWeight: 0.90,
    styleWeight: 0.05,
    dynamismWeight: 0.05,
    eloTolerance: 400,
    minStyleConfidence: 0.0, // style scoring optional
  },
  style_aware: {
    id: "style_aware",
    label: "Style-Aware Pairings",
    tagline: "Strength meets play-style tendencies",
    description:
      "Combines player strength with recent play-style tendencies. Designed for more engaging casual tournament matchups.",
    eloWeight: 0.65,
    styleWeight: 0.25,
    dynamismWeight: 0.10,
    eloTolerance: 350,
    minStyleConfidence: 0.35,
  },
  sharp: {
    id: "sharp",
    label: "Sharp Games Mode",
    tagline: "Dynamic and tactical matchup potential",
    description:
      "Favours dynamic and tactical matchup potential within a reasonable skill range. Best for organizers who want more volatile and memorable games.",
    eloWeight: 0.50,
    styleWeight: 0.15,
    dynamismWeight: 0.35,
    eloTolerance: 300,
    minStyleConfidence: 0.25,
  },
};

// ─── Style Signals ────────────────────────────────────────────────────────────

/**
 * Raw style signals derived from a player's recent game history.
 * All scores are normalised to [0, 1].
 *
 * aggression     — tendency to play sharp, attacking, open positions
 * tactical       — tactical vs. positional tendency (1 = pure tactical)
 * openingSharpness — how sharp/theoretical the player's opening choices are
 * volatility     — decisive game tendency (wins + losses vs. draws)
 * gameLengthTendency — short games (1) vs. long endgames (0)
 * confidence     — how reliable the profile is (0 = no data, 1 = strong sample)
 */
export interface StyleSignals {
  aggression: number;
  tactical: number;
  openingSharpness: number;
  volatility: number;
  gameLengthTendency: number;
  confidence: number;
}

/**
 * Synthesised style profile shown to organizers.
 */
export interface StyleProfile {
  signals: StyleSignals;
  primaryTag: string;
  secondaryTag: string;
  summary: string;
  confidence: number;
  /** "ready" | "limited" | "low_confidence" | "fallback" */
  status: StyleProfileStatus;
}

export type StyleProfileStatus =
  | "ready"
  | "limited"
  | "low_confidence"
  | "fallback";

export interface StyleProfileStatusMeta {
  label: string;
  description: string;
  color: string; // Tailwind color token
}

export const STYLE_PROFILE_STATUS_META: Record<
  StyleProfileStatus,
  StyleProfileStatusMeta
> = {
  ready: {
    label: "Style Analysis Ready",
    description: "Strong style profile — full style-aware pairing available.",
    color: "#3D6B47",
  },
  limited: {
    label: "Limited Style Data",
    description: "Fewer games than ideal — style scoring applied with reduced weight.",
    color: "#D97706",
  },
  low_confidence: {
    label: "Low Confidence Profile",
    description: "Style signals are noisy. Pairing falls back toward rating-based logic.",
    color: "#EF4444",
  },
  fallback: {
    label: "Fallback to Rating-Based Pairing",
    description: "No usable style data. Standard Elo-based pairing applied.",
    color: "#6B7280",
  },
};

// ─── Style Signal Computation ─────────────────────────────────────────────────

/**
 * Derive StyleSignals from a PlayStyleProfile (from prepEngine.ts).
 * Accepts a loose shape to avoid a hard import dependency.
 */
export interface RawGameStats {
  gamesAnalyzed: number;
  overall: { wins: number; draws: number; losses: number };
  endgameProfile?: {
    checkmates: number;
    resignations: number;
    timeouts: number;
    draws: number;
    total: number;
  };
  avgGameLength?: number;
  /** First-move preferences as white */
  firstMoveAsWhite?: { move: string; count: number; pct: number }[];
  /** Top openings as white */
  whiteOpenings?: { name: string; count: number }[];
  /** Top openings as black */
  blackOpenings?: { name: string; count: number }[];
}

/** Openings considered sharp/tactical */
const SHARP_OPENINGS = new Set([
  "Sicilian Defense",
  "King's Gambit",
  "Latvian Gambit",
  "Budapest Gambit",
  "Alekhine Defense",
  "Modern Defense",
  "Pirc Defense",
  "Dutch Defense",
  "Benoni Defense",
  "Grob Attack",
  "Benko Gambit",
  "Trompowsky Attack",
  "Scandinavian Defense",
  "Caro-Kann Defense", // semi-sharp
  "French Defense",
]);

/** First moves considered aggressive/open */
const AGGRESSIVE_FIRST_MOVES = new Set(["e4", "d4", "f4", "b4", "g4"]);

/**
 * Clamp a value to [0, 1].
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Compute style signals from raw game stats.
 * Returns a StyleSignals object with all scores in [0, 1].
 */
export function computeStyleSignals(stats: RawGameStats): StyleSignals {
  const n = stats.gamesAnalyzed;

  // ── Confidence ──────────────────────────────────────────────────────────────
  // 0 games → 0, 5 games → ~0.4, 15 games → ~0.75, 30+ games → 1.0
  const confidence = clamp01(n / 30);

  if (n === 0) {
    return {
      aggression: 0.5,
      tactical: 0.5,
      openingSharpness: 0.5,
      volatility: 0.5,
      gameLengthTendency: 0.5,
      confidence: 0,
    };
  }

  // ── Volatility ──────────────────────────────────────────────────────────────
  // High volatility = many decisive results (wins + losses), few draws
  const { wins, draws, losses } = stats.overall;
  const total = wins + draws + losses || 1;
  const volatility = clamp01((wins + losses) / total);

  // ── Game Length Tendency ────────────────────────────────────────────────────
  // Short games (< 25 moves) → 1.0, long games (> 50 moves) → 0.0
  const avgLen = stats.avgGameLength ?? 35;
  const gameLengthTendency = clamp01(1 - (avgLen - 15) / 45);

  // ── Aggression via first-move preference ───────────────────────────────────
  let aggression = 0.5;
  if (stats.firstMoveAsWhite && stats.firstMoveAsWhite.length > 0) {
    const topMove = stats.firstMoveAsWhite[0].move;
    aggression = AGGRESSIVE_FIRST_MOVES.has(topMove) ? 0.75 : 0.35;
    // Boost for e4 specifically (most open/aggressive)
    if (topMove === "e4") aggression = 0.80;
    // Soften for d4 (can be positional)
    if (topMove === "d4") aggression = 0.60;
  }

  // ── Opening Sharpness ──────────────────────────────────────────────────────
  let sharpCount = 0;
  let totalOpenings = 0;
  const allOpenings = [
    ...(stats.whiteOpenings ?? []),
    ...(stats.blackOpenings ?? []),
  ];
  for (const op of allOpenings) {
    totalOpenings += op.count;
    if (SHARP_OPENINGS.has(op.name)) sharpCount += op.count;
  }
  const openingSharpness =
    totalOpenings > 0 ? clamp01(sharpCount / totalOpenings) : 0.5;

  // ── Tactical tendency via endgame profile ──────────────────────────────────
  let tactical = 0.5;
  if (stats.endgameProfile && stats.endgameProfile.total > 0) {
    const { checkmates, resignations, draws: endDraws, total: endTotal } =
      stats.endgameProfile;
    // Checkmates + resignations = decisive tactical outcomes
    const decisiveSharp = checkmates + resignations;
    tactical = clamp01(decisiveSharp / endTotal);
    // Penalise if mostly draws (positional)
    if (endDraws / endTotal > 0.5) tactical = Math.max(0.2, tactical - 0.2);
  }

  return {
    aggression,
    tactical,
    openingSharpness,
    volatility,
    gameLengthTendency,
    confidence,
  };
}

// ─── Style Profile Synthesis ──────────────────────────────────────────────────

/**
 * Convert raw StyleSignals into a human-readable StyleProfile.
 * Produces primary/secondary tags, a concise summary, and a status.
 */
export function synthesiseStyleProfile(signals: StyleSignals): StyleProfile {
  const { aggression, tactical, openingSharpness, volatility, confidence } =
    signals;

  // ── Status ──────────────────────────────────────────────────────────────────
  let status: StyleProfileStatus;
  if (confidence >= 0.7) status = "ready";
  else if (confidence >= 0.4) status = "limited";
  else if (confidence >= 0.15) status = "low_confidence";
  else status = "fallback";

  // ── Composite scores ────────────────────────────────────────────────────────
  const sharpScore = (aggression + tactical + openingSharpness + volatility) / 4;
  const positionalScore = 1 - sharpScore;
  const solidScore = (1 - aggression + (1 - volatility)) / 2;

  // ── Primary tag ─────────────────────────────────────────────────────────────
  let primaryTag: string;
  let summary: string;

  if (sharpScore >= 0.70) {
    primaryTag = "Sharp Tactical Player";
    summary = "Prefers open, dynamic positions and decisive outcomes.";
  } else if (sharpScore >= 0.55 && volatility >= 0.65) {
    primaryTag = "Volatile Gambit-Leaning Player";
    summary = "Plays for imbalanced, high-stakes positions. Expects sharp fights.";
  } else if (tactical >= 0.60 && openingSharpness >= 0.55) {
    primaryTag = "Aggressive Attacker";
    summary = "Favours tactical complications and attacking play from the opening.";
  } else if (positionalScore >= 0.65 && solidScore >= 0.60) {
    primaryTag = "Positional Grind Player";
    summary = "Patient, structure-oriented style. Prefers long strategic battles.";
  } else if (solidScore >= 0.65) {
    primaryTag = "Solid Structure Player";
    summary = "Reliable and consistent. Avoids unnecessary risks.";
  } else {
    primaryTag = "Balanced Flexible Player";
    summary = "Adapts to the position. Comfortable in both tactical and positional games.";
  }

  // ── Secondary tag ───────────────────────────────────────────────────────────
  let secondaryTag: string;
  if (openingSharpness >= 0.65) secondaryTag = "Sharp Opening Repertoire";
  else if (openingSharpness <= 0.30) secondaryTag = "Solid Opening Repertoire";
  else if (signals.gameLengthTendency >= 0.65) secondaryTag = "Quick Finisher";
  else if (signals.gameLengthTendency <= 0.30) secondaryTag = "Endgame Specialist";
  else if (volatility >= 0.75) secondaryTag = "Decisive Results";
  else if (volatility <= 0.30) secondaryTag = "Draw-Prone";
  else secondaryTag = "Versatile";

  return {
    signals,
    primaryTag,
    secondaryTag,
    summary,
    confidence,
    status,
  };
}

// ─── Pairing Score ────────────────────────────────────────────────────────────

/**
 * A candidate pairing between two players.
 */
export interface CandidatePairing {
  playerAId: string;
  playerBId: string;
  eloGap: number;
  styleCompatScore: number;
  dynamismScore: number;
  totalScore: number;
  explanation: PairingExplanation;
  isValid: boolean;
  invalidReason?: string;
}

/**
 * Human-readable explanation for a pairing.
 */
export interface PairingExplanation {
  label: string;
  chips: string[];
  confidenceNote?: string;
}

/**
 * Minimal player shape needed for style-aware pairing.
 */
export interface StylePairingPlayer {
  id: string;
  name: string;
  elo: number;
  styleProfile?: StyleProfile;
  /** IDs of players this player has already faced */
  previousOpponents?: string[];
}

/**
 * Organizer-configurable pairing settings.
 */
export interface PairingSettings {
  mode: PairingMode;
  /** Override the mode's default Elo tolerance */
  eloTolerance?: number;
  /** Override the mode's default style influence (0 = none, 1 = max) */
  styleInfluence?: number;
  /** Avoid rematches when possible */
  avoidRematches: boolean;
  /** Require minimum style-confidence before applying style scoring */
  requireStyleConfidence?: number;
  /** When style profile is weak, fall back to balanced mode automatically */
  autoFallbackOnWeakData: boolean;
}

export const DEFAULT_PAIRING_SETTINGS: PairingSettings = {
  mode: "balanced",
  avoidRematches: true,
  autoFallbackOnWeakData: true,
};

// ─── Scoring Logic ────────────────────────────────────────────────────────────

/**
 * Compute a style compatibility score between two players.
 * High score = styles are complementary for an interesting game.
 *
 * For style_aware mode: reward contrasting styles (tactical vs. positional)
 * For sharp mode: reward both players having high sharpness/aggression
 */
export function computeStyleCompatScore(
  a: StyleSignals,
  b: StyleSignals,
  mode: PairingMode
): number {
  if (mode === "sharp") {
    // Both players should be sharp/tactical for a dynamic game
    const avgSharpness =
      (a.aggression + a.tactical + b.aggression + b.tactical) / 4;
    const avgVolatility = (a.volatility + b.volatility) / 2;
    return clamp01((avgSharpness * 0.7 + avgVolatility * 0.3));
  }

  if (mode === "style_aware") {
    // Contrasting styles create more interesting games
    const tacticalContrast = Math.abs(a.tactical - b.tactical);
    const aggressionContrast = Math.abs(a.aggression - b.aggression);
    const openingContrast = Math.abs(a.openingSharpness - b.openingSharpness);
    // Reward contrast but not extreme mismatch
    const contrastScore = (tacticalContrast + aggressionContrast + openingContrast) / 3;
    // Sweet spot: 0.2–0.6 contrast is ideal
    const idealContrast = 1 - Math.abs(contrastScore - 0.4) / 0.4;
    return clamp01(idealContrast);
  }

  // balanced: style is a minor tiebreaker — slight preference for similar styles
  const similarity =
    1 -
    (Math.abs(a.tactical - b.tactical) +
      Math.abs(a.aggression - b.aggression)) /
      2;
  return clamp01(similarity);
}

/**
 * Compute a dynamism score for a pairing.
 * High = the game is likely to be sharp and memorable.
 */
export function computeDynamismScore(
  a: StyleSignals,
  b: StyleSignals
): number {
  const combinedAggression = (a.aggression + b.aggression) / 2;
  const combinedTactical = (a.tactical + b.tactical) / 2;
  const combinedVolatility = (a.volatility + b.volatility) / 2;
  const openingClash = Math.abs(a.openingSharpness - b.openingSharpness);
  return clamp01(
    combinedAggression * 0.35 +
      combinedTactical * 0.30 +
      combinedVolatility * 0.20 +
      openingClash * 0.15
  );
}

/**
 * Compute an Elo proximity score (1 = identical Elo, 0 = max gap).
 */
export function computeEloProximityScore(
  eloA: number,
  eloB: number,
  tolerance: number
): number {
  const gap = Math.abs(eloA - eloB);
  return clamp01(1 - gap / tolerance);
}

/**
 * Build a human-readable explanation for a pairing.
 */
export function buildPairingExplanation(
  a: StylePairingPlayer,
  b: StylePairingPlayer,
  eloGap: number,
  styleCompatScore: number,
  dynamismScore: number,
  mode: PairingMode,
  effectiveMode: PairingMode
): PairingExplanation {
  const chips: string[] = [];
  let label: string;
  let confidenceNote: string | undefined;

  const aProfile = a.styleProfile;
  const bProfile = b.styleProfile;
  const hasStyleData =
    aProfile && bProfile &&
    aProfile.status !== "fallback" &&
    bProfile.status !== "fallback";

  // ── Elo chip ──────────────────────────────────────────────────────────────
  if (eloGap <= 50) chips.push("Near-identical rating");
  else if (eloGap <= 150) chips.push("Close rating match");
  else chips.push(`${eloGap}-point rating gap`);

  // ── Style chips ───────────────────────────────────────────────────────────
  if (hasStyleData && aProfile && bProfile) {
    const aSig = aProfile.signals;
    const bSig = bProfile.signals;
    const tacticalContrast = Math.abs(aSig.tactical - bSig.tactical);
    const aggressionContrast = Math.abs(aSig.aggression - bSig.aggression);
    const openingContrast = Math.abs(aSig.openingSharpness - bSig.openingSharpness);

    if (mode === "sharp" || effectiveMode === "sharp") {
      if (dynamismScore >= 0.65) chips.push("High tactical potential");
      if ((aSig.aggression + bSig.aggression) / 2 >= 0.65)
        chips.push("Both players favour open positions");
      if ((aSig.volatility + bSig.volatility) / 2 >= 0.65)
        chips.push("Decisive game tendency");
    } else if (mode === "style_aware" || effectiveMode === "style_aware") {
      if (tacticalContrast >= 0.35) chips.push("Contrasting tactical tendencies");
      if (openingContrast >= 0.35) chips.push("Contrasting opening styles");
      if (aggressionContrast >= 0.35) chips.push("Contrasting aggression levels");
      if (styleCompatScore >= 0.65) chips.push("Strong style fit");
    }

    // Confidence note
    const minConf = Math.min(aProfile.confidence, bProfile.confidence);
    if (minConf < 0.4) {
      confidenceNote = "Limited style data — rating parity weighted more heavily.";
    }
  } else if (!hasStyleData) {
    chips.push("Rating-compatible pairing");
    confidenceNote = "Style data unavailable — standard rating-based pairing applied.";
  }

  // ── Label ─────────────────────────────────────────────────────────────────
  if (effectiveMode !== mode) {
    label = "Rating-compatible pairing (style fallback)";
  } else if (mode === "sharp") {
    if (dynamismScore >= 0.65) label = "Competitive Elo match with high dynamic potential";
    else if (dynamismScore >= 0.45) label = "Balanced strength with dynamic middlegame tendencies";
    else label = "Rating-compatible pairing with tactical overlap";
  } else if (mode === "style_aware") {
    if (styleCompatScore >= 0.65) label = "Rating-compatible pairing with high style confidence";
    else if (chips.some((c) => c.includes("Contrasting")))
      label = "Similar rating, contrasting opening styles";
    else label = "Balanced strength and style tendencies";
  } else {
    label = "Closest competitive parity";
  }

  return { label, chips, confidenceNote };
}

// ─── Candidate Pairing Evaluation ────────────────────────────────────────────

/**
 * Evaluate a single candidate pairing and return a scored CandidatePairing.
 */
export function evaluateCandidatePairing(
  a: StylePairingPlayer,
  b: StylePairingPlayer,
  settings: PairingSettings
): CandidatePairing {
  const modeConfig = PAIRING_MODES[settings.mode];
  const eloTolerance = settings.eloTolerance ?? modeConfig.eloTolerance;
  const eloGap = Math.abs(a.elo - b.elo);

  // ── Validity checks ────────────────────────────────────────────────────────
  if (eloGap > eloTolerance) {
    return {
      playerAId: a.id,
      playerBId: b.id,
      eloGap,
      styleCompatScore: 0,
      dynamismScore: 0,
      totalScore: 0,
      explanation: {
        label: "Rating gap too large",
        chips: [`${eloGap}-point gap exceeds ${eloTolerance}-point tolerance`],
      },
      isValid: false,
      invalidReason: `Elo gap ${eloGap} exceeds tolerance ${eloTolerance}`,
    };
  }

  if (settings.avoidRematches && a.previousOpponents?.includes(b.id)) {
    // Still valid as a fallback, but penalised
  }

  // ── Determine effective mode (fallback if style data is weak) ──────────────
  let effectiveMode = settings.mode;
  const aProfile = a.styleProfile;
  const bProfile = b.styleProfile;
  const minConf =
    aProfile && bProfile
      ? Math.min(aProfile.confidence, bProfile.confidence)
      : 0;
  const requiredConf =
    settings.requireStyleConfidence ?? modeConfig.minStyleConfidence;

  if (
    settings.autoFallbackOnWeakData &&
    settings.mode !== "balanced" &&
    minConf < requiredConf
  ) {
    effectiveMode = "balanced";
  }

  const effectiveConfig = PAIRING_MODES[effectiveMode];

  // ── Style influence multiplier ─────────────────────────────────────────────
  const styleInfluence = settings.styleInfluence ?? 1.0;

  // ── Compute component scores ───────────────────────────────────────────────
  const eloProximity = computeEloProximityScore(a.elo, b.elo, eloTolerance);

  const aSignals: StyleSignals =
    aProfile?.signals ?? neutralSignals();
  const bSignals: StyleSignals =
    bProfile?.signals ?? neutralSignals();

  const styleCompatScore = computeStyleCompatScore(aSignals, bSignals, effectiveMode);
  const dynamismScore = computeDynamismScore(aSignals, bSignals);

  // ── Weighted total ─────────────────────────────────────────────────────────
  const eW = effectiveConfig.eloWeight;
  const sW = effectiveConfig.styleWeight * styleInfluence;
  const dW = effectiveConfig.dynamismWeight * styleInfluence;
  const totalW = eW + sW + dW;

  const totalScore =
    (eloProximity * eW + styleCompatScore * sW + dynamismScore * dW) / totalW;

  // ── Rematch penalty ────────────────────────────────────────────────────────
  const isRematch = settings.avoidRematches && a.previousOpponents?.includes(b.id);
  const finalScore = isRematch ? totalScore * 0.5 : totalScore;

  // ── Explanation ───────────────────────────────────────────────────────────
  const explanation = buildPairingExplanation(
    a,
    b,
    eloGap,
    styleCompatScore,
    dynamismScore,
    settings.mode,
    effectiveMode
  );

  return {
    playerAId: a.id,
    playerBId: b.id,
    eloGap,
    styleCompatScore,
    dynamismScore,
    totalScore: finalScore,
    explanation,
    isValid: true,
  };
}

/**
 * Return neutral (mid-range) style signals for players with no data.
 */
export function neutralSignals(): StyleSignals {
  return {
    aggression: 0.5,
    tactical: 0.5,
    openingSharpness: 0.5,
    volatility: 0.5,
    gameLengthTendency: 0.5,
    confidence: 0,
  };
}

// ─── Pairing Generation ───────────────────────────────────────────────────────

/**
 * Generate style-aware pairings for a set of players.
 *
 * Algorithm:
 * 1. Sort players by Elo (descending) — same as standard Swiss top-half vs bottom-half
 * 2. For each unmatched player, find the best valid candidate from the remaining pool
 * 3. Score candidates using the weighted pairing formula
 * 4. Assign the highest-scoring valid pairing
 * 5. Repeat until all players are matched (odd player gets a bye)
 */
export interface GeneratedPairing {
  boardNumber: number;
  whiteId: string;
  blackId: string;
  score: number;
  explanation: PairingExplanation;
  effectiveMode: PairingMode;
}

export function generateStyleAwarePairings(
  players: StylePairingPlayer[],
  settings: PairingSettings
): { pairings: GeneratedPairing[]; byePlayerId: string | null } {
  // Sort by Elo descending
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const unmatched = new Set(sorted.map((p) => p.id));
  const pairings: GeneratedPairing[] = [];
  let boardNumber = 1;
  let byePlayerId: string | null = null;

  const playerMap = new Map(players.map((p) => [p.id, p]));

  for (const player of sorted) {
    if (!unmatched.has(player.id)) continue;
    unmatched.delete(player.id);

    const candidates = Array.from(unmatched)
      .map((id) => playerMap.get(id)!)
      .filter(Boolean);

    if (candidates.length === 0) {
      // Odd player out — assign bye
      byePlayerId = player.id;
      break;
    }

    // Score all candidates
    const scored = candidates
      .map((candidate) => ({
        candidate,
        result: evaluateCandidatePairing(player, candidate, settings),
      }))
      .filter((x) => x.result.isValid)
      .sort((a, b) => b.result.totalScore - a.result.totalScore);

    // If no valid candidates (all exceed Elo tolerance), relax and take closest
    const best =
      scored.length > 0
        ? scored[0]
        : candidates
            .map((candidate) => ({
              candidate,
              result: evaluateCandidatePairing(player, candidate, {
                ...settings,
                eloTolerance: 9999, // force-match
              }),
            }))
            .sort((a, b) => b.result.totalScore - a.result.totalScore)[0];

    if (!best) {
      byePlayerId = player.id;
      continue;
    }

    unmatched.delete(best.candidate.id);

    // Determine effective mode for this pairing
    const modeConfig = PAIRING_MODES[settings.mode];
    const aProfile = player.styleProfile;
    const bProfile = best.candidate.styleProfile;
    const minConf =
      aProfile && bProfile
        ? Math.min(aProfile.confidence, bProfile.confidence)
        : 0;
    const requiredConf =
      settings.requireStyleConfidence ?? modeConfig.minStyleConfidence;
    const effectiveMode =
      settings.autoFallbackOnWeakData &&
      settings.mode !== "balanced" &&
      minConf < requiredConf
        ? "balanced"
        : settings.mode;

    // Alternate colors: higher Elo gets white on odd boards
    const whiteId =
      boardNumber % 2 === 1 ? player.id : best.candidate.id;
    const blackId =
      boardNumber % 2 === 1 ? best.candidate.id : player.id;

    pairings.push({
      boardNumber,
      whiteId,
      blackId,
      score: best.result.totalScore,
      explanation: best.result.explanation,
      effectiveMode,
    });
    boardNumber++;
  }

  return { pairings, byePlayerId };
}

// ─── Style Profile Status Helpers ────────────────────────────────────────────

export function getStyleProfileStatusMeta(
  status: StyleProfileStatus
): StyleProfileStatusMeta {
  return STYLE_PROFILE_STATUS_META[status];
}

/**
 * Determine the aggregate readiness of the player pool for style-aware pairing.
 */
export function assessPoolReadiness(
  players: StylePairingPlayer[]
): {
  readyCount: number;
  limitedCount: number;
  fallbackCount: number;
  overallStatus: StyleProfileStatus;
  readyPct: number;
} {
  let readyCount = 0;
  let limitedCount = 0;
  let fallbackCount = 0;

  for (const p of players) {
    if (!p.styleProfile || p.styleProfile.status === "fallback") fallbackCount++;
    else if (
      p.styleProfile.status === "ready" ||
      p.styleProfile.status === "limited"
    ) {
      if (p.styleProfile.status === "ready") readyCount++;
      else limitedCount++;
    } else {
      fallbackCount++;
    }
  }

  const total = players.length || 1;
  const readyPct = Math.round(((readyCount + limitedCount) / total) * 100);

  let overallStatus: StyleProfileStatus;
  if (readyPct >= 70) overallStatus = "ready";
  else if (readyPct >= 40) overallStatus = "limited";
  else if (readyPct >= 15) overallStatus = "low_confidence";
  else overallStatus = "fallback";

  return { readyCount, limitedCount, fallbackCount, overallStatus, readyPct };
}
