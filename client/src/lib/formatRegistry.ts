/**
 * formatRegistry.ts — Single source of truth for tournament format metadata.
 *
 * All wizard copy, format labels, round defaults, capacity rules, and
 * tiebreak descriptions must be derived from this registry.
 */

export type TournamentFormat =
  | "swiss"
  | "doubleswiss"
  | "roundrobin"
  | "elimination"
  | "swiss_elim"
  | "quads";

export interface FormatConfig {
  /** Canonical format identifier */
  value: TournamentFormat;
  /** Short display label (used in badges, cards, reports) */
  label: string;
  /** Abbreviated label for tight spaces */
  shortLabel: string;
  /** One-line description for wizard selection */
  description: string;
  /** Wizard hero title (shown in the left panel when this format is active) */
  wizardHeroTitle: string;
  /** Wizard hero body copy — format-specific, never mentions another format */
  wizardHeroBody: string;
  /** Default number of rounds (null = computed from player count) */
  defaultRounds: number | null;
  /** Whether rounds are fixed (cannot be changed by director) */
  fixedRounds: boolean;
  /** Minimum players required to start */
  minPlayers: number;
  /** Whether player count must satisfy a divisibility constraint */
  playerDivisor: number | null;
  /** Human-readable capacity note shown in wizard */
  capacityNote: string;
  /** Primary tiebreak method label */
  tiebreakLabel: string;
  /** Secondary tiebreak method label */
  tiebreakSecondaryLabel: string | null;
}

export const FORMAT_REGISTRY: Record<TournamentFormat, FormatConfig> = {
  swiss: {
    value: "swiss",
    label: "Swiss",
    shortLabel: "Swiss",
    description: "Optimal pairings by score — ideal for large open events.",
    wizardHeroTitle: "Start in\nseconds",
    wizardHeroBody:
      "Give your tournament a name and location. We'll set up Swiss pairings, 5 rounds, and 10+5 time control — you can adjust everything later.",
    defaultRounds: 5,
    fixedRounds: false,
    minPlayers: 2,
    playerDivisor: null,
    capacityNote: "2 – ∞ players",
    tiebreakLabel: "Buchholz",
    tiebreakSecondaryLabel: "Sonneborn-Berger",
  },
  doubleswiss: {
    value: "doubleswiss",
    label: "Double Swiss",
    shortLabel: "Dbl Swiss",
    description: "Each player plays both colors in every round.",
    wizardHeroTitle: "Double Swiss\nsetup",
    wizardHeroBody:
      "Give your tournament a name and location. We'll set up Double Swiss pairings with balanced color assignments — you can adjust rounds and time control later.",
    defaultRounds: 5,
    fixedRounds: false,
    minPlayers: 2,
    playerDivisor: null,
    capacityNote: "2 – ∞ players",
    tiebreakLabel: "Buchholz",
    tiebreakSecondaryLabel: "Sonneborn-Berger",
  },
  roundrobin: {
    value: "roundrobin",
    label: "Round Robin",
    shortLabel: "RR",
    description: "Every player faces every other player once.",
    wizardHeroTitle: "Round Robin\nsetup",
    wizardHeroBody:
      "Give your tournament a name and location. We'll generate a full round-robin schedule — every player plays every other player. Best for small groups of 4–12.",
    defaultRounds: null,
    fixedRounds: true,
    minPlayers: 3,
    playerDivisor: null,
    capacityNote: "3 – 12 players (rounds = players − 1)",
    tiebreakLabel: "Sonneborn-Berger",
    tiebreakSecondaryLabel: "Head-to-Head",
  },
  elimination: {
    value: "elimination",
    label: "Elimination",
    shortLabel: "Elim",
    description: "Single-elimination knockout bracket.",
    wizardHeroTitle: "Elimination\nBracket",
    wizardHeroBody:
      "Give your tournament a name and location. We'll seed players into a single-elimination bracket — pure knockout drama from round one.",
    defaultRounds: null,
    fixedRounds: true,
    minPlayers: 2,
    playerDivisor: null,
    capacityNote: "2 – ∞ players (bracket seeded by rating)",
    tiebreakLabel: "N/A (knockout)",
    tiebreakSecondaryLabel: null,
  },
  swiss_elim: {
    value: "swiss_elim",
    label: "Swiss + Elimination",
    shortLabel: "Swiss+Elim",
    description: "Swiss qualification rounds, then a seeded elimination bracket.",
    wizardHeroTitle: "Large Event\nsetup",
    wizardHeroBody:
      "Give your event a name and location. We'll run Swiss qualification rounds, then cut to a seeded elimination bracket — perfect for open events with 30–100 players.",
    defaultRounds: 5,
    fixedRounds: false,
    minPlayers: 4,
    playerDivisor: null,
    capacityNote: "4 – ∞ players (30–100 recommended)",
    tiebreakLabel: "Buchholz (Swiss phase)",
    tiebreakSecondaryLabel: "Bracket seeding",
  },
  quads: {
    value: "quads",
    label: "Quads",
    shortLabel: "Quads",
    description: "4-player rating-grouped sections, 3-round round robin.",
    wizardHeroTitle: "Quads\nsetup",
    wizardHeroBody:
      "Give your Quads event a name and location. Players are grouped into rating-based sections of 4 by rating. Each section plays a 3-round round robin — no algorithmic pairings needed.",
    defaultRounds: 3,
    fixedRounds: true,
    minPlayers: 4,
    playerDivisor: 4,
    capacityNote: "Multiples of 4 (4, 8, 12, 16 …)",
    tiebreakLabel: "Sonneborn-Berger",
    tiebreakSecondaryLabel: "Head-to-Head",
  },
};

/** Ordered list for wizard format picker */
export const FORMAT_OPTIONS: FormatConfig[] = [
  FORMAT_REGISTRY.swiss,
  FORMAT_REGISTRY.doubleswiss,
  FORMAT_REGISTRY.roundrobin,
  FORMAT_REGISTRY.quads,
  FORMAT_REGISTRY.elimination,
  FORMAT_REGISTRY.swiss_elim,
];

/** Get format config — falls back to swiss if unknown */
export function getFormatConfig(format: string): FormatConfig {
  return FORMAT_REGISTRY[format as TournamentFormat] ?? FORMAT_REGISTRY.swiss;
}

/**
 * Canonical user-visible tournament format label.
 * Unlike getFormatConfig(), unknown or missing values never fall through to
 * Swiss, which prevents legacy records from being mislabeled in the UI.
 */
export function getTournamentFormatLabel(
  format: unknown,
  options: { short?: boolean; fallback?: string } = {},
): string {
  const config = typeof format === "string"
    ? FORMAT_REGISTRY[format as TournamentFormat]
    : undefined;
  if (!config) return options.fallback ?? "Tournament";
  return options.short ? config.shortLabel : config.label;
}

/** Short label for tight spaces (badges, cards) */
export function getFormatShortLabel(format: string): string {
  return getTournamentFormatLabel(format, { short: true });
}

/** Full label for display */
export function getFormatLabel(format: string): string {
  return getTournamentFormatLabel(format);
}

/**
 * Returns true when the given player count satisfies the format's
 * divisibility constraint (if any). Always true for formats with no constraint.
 */
export function isPlayerCountValid(format: string, playerCount: number): boolean {
  const config = getFormatConfig(format);
  if (playerCount < config.minPlayers) return false;
  if (config.playerDivisor !== null && playerCount % config.playerDivisor !== 0) return false;
  return true;
}

/**
 * Returns a human-readable message explaining why the player count is invalid,
 * or null if valid.
 */
export function getPlayerCountError(format: string, playerCount: number): string | null {
  const config = getFormatConfig(format);
  if (playerCount < config.minPlayers) {
    return `${config.label} requires at least ${config.minPlayers} players.`;
  }
  if (config.playerDivisor !== null && playerCount % config.playerDivisor !== 0) {
    const remainder = playerCount % config.playerDivisor;
    const needed = config.playerDivisor - remainder;
    return `Quads requires groups of ${config.playerDivisor}. You have ${playerCount} players (${remainder} extra). Add ${needed} more or remove ${remainder} for complete sections.`;
  }
  return null;
}
