import type {
  ActiveScoutRequest,
  Color,
  DraftScoutRequest,
  Provider,
  ScoutFormat,
  ScoutFormatFilter,
} from "./prepTypes.js";

export const SCOUT_SCHEMA_VERSION = "launch-3";
export const SCOUT_MAX_GAMES = 30 as const;
/** Limits each provider page to a small bounded batch while still allowing 30 eligible games after filtering. */
export const SCOUT_PROVIDER_PAGE_SIZE = 60 as const;
export const SCOUT_ARCHIVE_MONTHS = 24;
export const ALL_SCOUT_FORMATS: ScoutFormat[] = ["rapid", "blitz", "bullet"];


function readProvider(value: string | null | undefined): Provider {
  return value === "lichess" ? "lichess" : "chesscom";
}

function readColor(value: string | null | undefined): Color {
  return value === "black" ? "black" : "white";
}

function readFormat(value: string | null | undefined): ScoutFormatFilter {
  return value === "rapid" || value === "blitz" || value === "bullet" ? value : "all";
}

export function formatsForFilter(filter: ScoutFormatFilter): ScoutFormat[] {
  return filter === "all" ? [...ALL_SCOUT_FORMATS] : [filter];
}

export function formatFilterForFormats(formats: ScoutFormat[]): ScoutFormatFilter {
  return formats.length === 1 ? formats[0] : "all";
}

export function normalizeScoutUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function createActiveScoutRequest(
  draft: DraftScoutRequest,
  requestedAt = new Date().toISOString(),
): ActiveScoutRequest {
  const displayUsername = draft.displayUsername.trim();
  return {
    platform: draft.platform,
    normalizedUsername: normalizeScoutUsername(displayUsername),
    displayUsername,
    formats: formatsForFilter(draft.format),
    mode: "standard",
    maxGames: SCOUT_MAX_GAMES,
    schemaVersion: SCOUT_SCHEMA_VERSION,
    requestedAt,
    ...(draft.explorerColor ?? draft.myColor ? { explorerColor: draft.explorerColor ?? draft.myColor } : {}),
  };
}

export function activeScoutRequestFromQuery(
  username: string,
  query: URLSearchParams | Record<string, string | string[] | undefined>,
  requestedAt = new Date().toISOString(),
): ActiveScoutRequest {
  const read = (key: string): string | undefined => {
    if (query instanceof URLSearchParams) return query.get(key) ?? undefined;
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return createActiveScoutRequest({
    platform: readProvider(read("provider") ?? read("platform")),
    displayUsername: username,
    explorerColor: readColor(read("explorerColor") ?? read("myColor") ?? read("color")),
    format: readFormat(read("tc") ?? read("format")),
  }, requestedAt);
}

export function scoutRequestCacheKey(request: ActiveScoutRequest): string {
  const formatKey = request.formats.join("+");
  return [
    "v5",
    request.platform,
    request.normalizedUsername,
    `f${formatKey}`,
    `m${request.mode}`,
    `g${request.maxGames}`,
    `s${request.schemaVersion}`,
  ].join(":");
}

export function scoutRequestSearchParams(request: ActiveScoutRequest): URLSearchParams {
  const params = new URLSearchParams({
    provider: request.platform,
    tc: formatFilterForFormats(request.formats),
  });
  if (request.explorerColor) params.set("explorerColor", request.explorerColor);
  return params;
}

export function scoutRequestRoute(request: ActiveScoutRequest): string {
  return `/prep/${encodeURIComponent(request.displayUsername)}?${scoutRequestSearchParams(request).toString()}`;
}
