export const OPERATIONAL_ROUTE_SEGMENTS = [
  "404", "admin", "analysis", "analytics", "auth", "board", "blog", "broadcast",
  "broadcast-console", "builder", "checkin", "clubs", "clock", "create",
  "dashboard", "demo", "director-access", "display", "game", "games", "history", "home", "invite",
  "join", "join-club", "league", "league-demo", "leagues", "live", "manage", "meetup", "messages",
  "new", "openings", "otb", "overview", "play", "prep", "pricing", "print", "pro", "profile", "recap",
  "record", "repertoire", "results", "rsvp", "rsvp-form", "staff", "study", "success", "terms", "tools",
  "tournament", "tournaments", "training",
] as const;

const OPERATIONAL_ROUTE_SEGMENT_SET = new Set<string>(OPERATIONAL_ROUTE_SEGMENTS);

export function isKnownOperationalRouteSegment(segment: string): boolean {
  return OPERATIONAL_ROUTE_SEGMENT_SET.has(segment.toLowerCase());
}

export function isOperationalRoutePattern(value: string): boolean {
  if (!value.startsWith("/") || value.length > 200 || /[?#]/.test(value)) return false;
  return value.split("/").filter(Boolean).every((segment) => (
    segment === ":id" || OPERATIONAL_ROUTE_SEGMENT_SET.has(segment)
  ));
}
