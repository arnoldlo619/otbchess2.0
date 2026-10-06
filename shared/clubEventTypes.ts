export const CLUB_EVENT_TYPES = [
  "tournament",
  "puzzle_relay",
  "casual",
  "lecture",
] as const;

export type ClubEventType = (typeof CLUB_EVENT_TYPES)[number];

const CLUB_EVENT_TYPE_SET = new Set<string>(CLUB_EVENT_TYPES);

/**
 * Legacy values are accepted at API and cache boundaries only. They map into
 * the canonical event taxonomy so stored data and downstream features do not
 * need to understand historical labels.
 */
const LEGACY_EVENT_TYPE_ALIASES: Readonly<Record<string, ClubEventType>> = {
  standard: "casual",
  meetup: "casual",
};

export function parseClubEventType(value: unknown): ClubEventType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (CLUB_EVENT_TYPE_SET.has(normalized)) return normalized as ClubEventType;
  return LEGACY_EVENT_TYPE_ALIASES[normalized] ?? null;
}

/**
 * Tournament-linked events always resolve as tournaments, including legacy
 * records created before the normalized taxonomy was introduced.
 */
export function canonicalizeClubEventType(value: unknown, tournamentId?: unknown): ClubEventType {
  if (typeof tournamentId === "string" && tournamentId.trim()) return "tournament";
  return parseClubEventType(value) ?? "casual";
}
