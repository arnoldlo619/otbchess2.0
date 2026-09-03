/**
 * Converts provider/ECO opening labels into familiar player-facing families.
 * Matchup Prep deliberately avoids exposing variation-only labels in its brief.
 */
const OPENING_FAMILIES: Array<[string, string]> = [
  ["catalan", "Catalan Opening"],
  ["london", "London System"],
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

function familyFromEco(eco?: string): string | undefined {
  if (!eco || !/^[A-E]\d{2}$/.test(eco)) return undefined;
  const code = Number(eco.slice(1));
  switch (eco[0]) {
    case "A":
      if (code >= 4 && code <= 9) return "Reti Opening";
      if (code >= 10 && code <= 39) return "English Opening";
      if (code >= 40 && code <= 44) return "Queen's Pawn Opening";
      if (code >= 45 && code <= 79) return "Indian Defense";
      if (code >= 80) return "Dutch Defense";
      return undefined;
    case "B":
      if (code === 0) return "King's Pawn Opening";
      if (code === 1) return "Scandinavian Defense";
      if (code <= 5) return "Alekhine Defense";
      if (code <= 9) return "Modern Defense";
      if (code <= 19) return "Caro-Kann Defense";
      return "Sicilian Defense";
    case "C":
      if (code <= 19) return "French Defense";
      if (code <= 29) return "King's Pawn Opening";
      if (code <= 39) return "King's Gambit";
      if (code <= 59) return "Italian Game";
      return "Ruy Lopez";
    case "D":
      if (code <= 5) return "Queen's Pawn Opening";
      if (code <= 69) return "Queen's Gambit";
      return "Grünfeld Defense";
    case "E":
      if (code <= 9) return "Catalan Opening";
      if (code <= 19) return "Queen's Indian Defense";
      if (code <= 59) return "Nimzo-Indian Defense";
      return "King's Indian Defense";
  }
}

export function simpleOpeningName(rawName?: string, eco?: string, firstMove?: string): string {
  const normalized = rawName?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
  const primary = normalized.split(":")[0]?.trim() ?? "";
  for (const [pattern, name] of OPENING_FAMILIES) {
    if (primary.includes(pattern) || normalized.includes(pattern)) return name;
  }

  const ecoName = familyFromEco(eco);
  if (ecoName) return ecoName;
  if (firstMove === "e4") return "King's Pawn Opening";
  if (firstMove === "d4") return "Queen's Pawn Opening";
  if (firstMove === "c4") return "English Opening";
  if (firstMove === "Nf3") return "Reti Opening";
  return "Other opening";
}
