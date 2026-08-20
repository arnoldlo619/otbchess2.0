/**
 * Converts raw explorer and ECO labels into familiar opening families.
 * Source providers often include move-by-move variation suffixes that are
 * technically precise but unhelpful for players choosing a repertoire line.
 */
const FIRST_MOVE_FALLBACKS: Record<string, string> = {
  e4: "King's Pawn Opening",
  d4: "Queen's Pawn Opening",
  c4: "English Opening",
  Nf3: "Reti Opening",
  g3: "King's Fianchetto Opening",
  b3: "Nimzo-Larsen Opening",
  b4: "Sokolsky Opening",
  f4: "Bird Opening",
  e3: "Van't Kruijs Opening",
  g4: "Grob Attack",
};

const FAMILY_NAMES: Array<[string, string]> = [
  ["catalan", "Catalan Opening"],
  ["london system", "London System"],
  ["scandinavian", "Scandinavian Defense"],
  ["pirc", "Pirc Defense"],
  ["modern defense", "Modern Defense"],
  ["king's indian", "King's Indian Defense"],
  ["nimzo-indian", "Nimzo-Indian Defense"],
  ["grünfeld", "Grünfeld Defense"],
  ["grunfeld", "Grünfeld Defense"],
  ["queen's gambit accepted", "Queen's Gambit Accepted"],
  ["queen's gambit declined", "Queen's Gambit Declined"],
  ["queen's gambit", "Queen's Gambit"],
  ["king's gambit", "King's Gambit"],
  ["sicilian", "Sicilian Defense"],
  ["caro-kann", "Caro-Kann Defense"],
  ["french", "French Defense"],
  ["italian", "Italian Game"],
  ["ruy lopez", "Ruy Lopez"],
  ["spanish", "Ruy Lopez"],
  ["english", "English Opening"],
  ["réti", "Reti Opening"],
  ["reti", "Reti Opening"],
  ["dutch", "Dutch Defense"],
  ["benoni", "Benoni Defense"],
  ["alekhine", "Alekhine Defense"],
  ["slav", "Slav Defense"],
  ["colle", "Colle System"],
  ["trompowsky", "Trompowsky Attack"],
  ["veresov", "Veresov System"],
];

const PRIMARY_FAMILY_NAMES: Array<[string, string]> = [
  ["catalan", "Catalan Opening"],
  ["london", "London System"],
  ["réti", "Reti Opening"],
  ["reti", "Reti Opening"],
  ["english", "English Opening"],
  ["scandinavian", "Scandinavian Defense"],
  ["pirc", "Pirc Defense"],
  ["king's indian", "King's Indian Defense"],
  ["queen's gambit", "Queen's Gambit"],
  ["king's gambit", "King's Gambit"],
  ["sicilian", "Sicilian Defense"],
  ["french", "French Defense"],
  ["caro-kann", "Caro-Kann Defense"],
  ["italian", "Italian Game"],
  ["ruy lopez", "Ruy Lopez"],
  ["spanish", "Ruy Lopez"],
];

function firstMoveFallback(eco?: string, san?: string): string | undefined {
  if (san && FIRST_MOVE_FALLBACKS[san]) return FIRST_MOVE_FALLBACKS[san];
  if (eco === "B00") return "King's Pawn Opening";
  if (eco === "D00") return "Queen's Pawn Opening";
  if (eco?.startsWith("A2")) return "English Opening";
  if (eco === "A07") return "Reti Opening";
  return undefined;
}

export function formatFriendlyOpeningName(
  rawName?: string,
  eco?: string,
  san?: string
): string | undefined {
  const fallback = firstMoveFallback(eco, san);
  const name = rawName?.replace(/\s+/g, " ").trim();
  if (!name) return fallback;

  const normalized = name.toLowerCase();

  // Generic provider labels such as "Main Setup: d4-Nc3-Bf4" do not teach
  // a useful opening name, so prefer the move/ECO family the player recognizes.
  if (normalized.includes("main setup") || normalized.includes("starting position")) {
    return fallback ?? "Opening setup";
  }

  // A bare "Gambit Accepted" must be qualified by its ECO family.
  if (normalized.startsWith("gambit accepted")) {
    if (eco?.startsWith("C3")) return "King's Gambit Accepted";
    if (eco?.startsWith("D2")) return "Queen's Gambit Accepted";
    return fallback ?? "Gambit Accepted";
  }

  // The source's leading family is the player-facing identity. For example,
  // "Réti: King's Indian Attack" should stay Réti rather than be relabeled
  // as a different defense because of its variation text.
  const primaryFamily = normalized.split(":")[0].trim();
  for (const [pattern, friendlyName] of PRIMARY_FAMILY_NAMES) {
    if (primaryFamily.includes(pattern)) return friendlyName;
  }

  for (const [pattern, friendlyName] of FAMILY_NAMES) {
    if (normalized.includes(pattern)) return friendlyName;
  }

  if (normalized === "king's pawn game" || normalized === "king's pawn opening") {
    return "King's Pawn Opening";
  }
  if (normalized === "queen's pawn game" || normalized === "queen's pawn opening") {
    return "Queen's Pawn Opening";
  }

  // Remove only an obvious raw move suffix while retaining a meaningful family name.
  const withoutMoveSuffix = name.replace(/:\s*(?:\d+\.)?\s*\.{0,3}\s*[a-hNBRQKO][^,;]*$/i, "").trim();
  return withoutMoveSuffix || fallback;
}
